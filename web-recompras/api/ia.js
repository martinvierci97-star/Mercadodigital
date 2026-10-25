// Botón de IA: recomienda qué ofrecer, usando Claude Haiku 5.5 (el modelo más barato).
// Solo responde a usuarios aprobados y arma el pedido a Claude acá, en el servidor,
// para que la página no pueda usarse como un chat general.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const MODELO = 'claude-haiku-5-5';
const LIMITE_POR_HORA = 60;

const anthropic = new Anthropic();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const Recomendacion = z.object({
  recomendaciones: z.array(z.object({ producto: z.string(), cuando: z.string(), por_que: z.string() })),
  mensaje: z.string(),
  nota: z.string(),
});
const Diagnostico = z.object({
  diagnostico: z.string(),
  acciones: z.array(z.object({ accion: z.string(), por_que: z.string(), impacto: z.string() })),
});

const SISTEMA = 'Sos el asesor de recompras de Mercado Digital, un e-commerce de Paraguay con precios en guaraníes. '
  + 'Respondés en español, concreto y breve. Solo usás los datos que te pasan: nunca inventes productos, precios, descuentos ni cifras.';

const cortar = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);

function armarPedido(tipo, d) {
  if (tipo === 'cliente') {
    const c = d.cliente || {};
    return {
      schema: Recomendacion,
      texto: `Hoy es ${d.hoy}. Cliente: ${String(c.nombre || '').slice(0, 80)}. ${c.compras} compras, total Gs ${c.total}, ticket promedio Gs ${c.ticket}, última compra hace ${c.dias} días.\n`
        + `Historial: ${JSON.stringify(cortar(c.historial, 30))}\n`
        + `Duración estimada de consumibles: ${JSON.stringify(cortar(d.ciclos, 20))} (2 unidades duran el doble).\n`
        + `Productos que podés recomendar (elegí SOLO de esta lista): ${JSON.stringify(cortar(d.candidatos, 40))}\n\n`
        + 'Recomendá de 1 a 3 productos para ofrecerle: cuándo ofrecerlo (fecha o "ahora") y por qué, según su historial. '
        + 'Escribí un mensaje corto de WhatsApp, cálido, firmado como Mercado Digital, sin inventar descuentos. En "nota" poné una advertencia si hace falta, o dejala vacía.',
    };
  }
  if (tipo === 'producto') {
    return {
      schema: Recomendacion,
      texto: `Un cliente compró: ${String(d.producto || '').slice(0, 160)} (categoría ${String(d.categoria || '').slice(0, 80)}).\n`
        + `Lo que llevaron otros clientes que compraron ese producto, con cuántos clientes: ${JSON.stringify(cortar(d.coCompras, 20))}\n`
        + `Productos que podés recomendar (elegí SOLO de esta lista): ${JSON.stringify(cortar(d.candidatos, 40))}\n\n`
        + 'Recomendá de 1 a 3 productos para ofrecerle como venta adicional, ordenados por probabilidad de que los compre. '
        + 'En "cuando" decí si conviene en el momento de la compra o unos días después. '
        + 'Escribí un mensaje corto de WhatsApp para ofrecer el primero, firmado como Mercado Digital, sin inventar descuentos. '
        + 'En "nota" aclarás si la evidencia es poca (menos de 3 clientes).',
    };
  }
  if (tipo === 'base') {
    return {
      schema: Diagnostico,
      texto: `Datos reales de pedidos: ${JSON.stringify(d.datos || {}).slice(0, 20000)}\n\n`
        + 'Hacé un diagnóstico de la recompra en 2 o 3 oraciones y proponé de 3 a 5 acciones ordenadas por impacto, '
        + 'cada una con el dato que la justifica y una estimación prudente de impacto usando solo estos datos (o vacío si no se puede).',
    };
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }

  // 1. ¿Quién pide? Tiene que ser un usuario aprobado
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { data: u, error: eu } = await supabase.auth.getUser(token);
  if (eu || !u?.user) { res.status(401).json({ error: 'Iniciá sesión de nuevo.' }); return; }
  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', u.user.id).single();
  if (!perfil || !['usuario', 'admin'].includes(perfil.rol)) { res.status(403).json({ error: 'Tu usuario todavía no está aprobado.' }); return; }

  // 2. Límite de uso para cuidar el costo
  const haceUnaHora = new Date(Date.now() - 3600e3).toISOString();
  const { count } = await supabase.from('consultas_ia').select('id', { count: 'exact', head: true }).eq('usuario', u.user.id).gte('creado', haceUnaHora);
  if ((count || 0) >= LIMITE_POR_HORA) { res.status(429).json({ error: `Llegaste a ${LIMITE_POR_HORA} consultas en la última hora. Probá más tarde.` }); return; }

  // 3. Pedido a Claude
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const p = armarPedido(body.tipo, body.datos || {});
  if (!p) { res.status(400).json({ error: 'Consulta no válida.' }); return; }

  try {
    const r = await anthropic.messages.parse({
      model: MODELO,
      max_tokens: 4000,
      system: SISTEMA,
      output_config: { effort: 'low', format: zodOutputFormat(p.schema) },
      messages: [{ role: 'user', content: p.texto }],
    });
    await supabase.from('consultas_ia').insert({ usuario: u.user.id, tipo: body.tipo, tokens_in: r.usage?.input_tokens, tokens_out: r.usage?.output_tokens });
    if (r.stop_reason === 'refusal') { res.status(422).json({ error: 'La IA no pudo responder esta consulta.' }); return; }
    if (!r.parsed_output) { res.status(502).json({ error: 'La IA respondió en un formato inesperado. Probá de nuevo.' }); return; }
    res.status(200).json(r.parsed_output);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) res.status(429).json({ error: 'La IA está saturada. Probá en un minuto.' });
    else if (e instanceof Anthropic.AuthenticationError) res.status(500).json({ error: 'Falta o es inválida la clave de Anthropic en Vercel.' });
    else if (e instanceof Anthropic.APIError) res.status(502).json({ error: `La IA devolvió un error (${e.status}).` });
    else res.status(500).json({ error: 'No se pudo consultar la IA.' });
  }
}
