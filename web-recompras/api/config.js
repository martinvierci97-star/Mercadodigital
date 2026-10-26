// Lo que el navegador necesita para arrancar: datos públicos de Supabase y el estado de la instalación.
// La "anon key" es pública por diseño: la seguridad está en las reglas de la base.
import { SUPABASE_URL, SUPABASE_ANON, configurado, supabaseAdmin } from './_comun.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!configurado()) {
    res.status(200).json({ paso: 'base', error: 'Falta conectar la base de datos (Supabase) en Vercel.' });
    return;
  }
  const { count, error } = await supabaseAdmin().from('perfiles').select('id', { count: 'exact', head: true });
  if (error) { res.status(200).json({ paso: 'instalar', url: SUPABASE_URL, anonKey: SUPABASE_ANON }); return; }
  // Ya instalado: la respuesta es igual para todos y casi nunca cambia, así que Vercel la puede servir desde su caché
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  res.status(200).json({ paso: 'listo', url: SUPABASE_URL, anonKey: SUPABASE_ANON, ia: Boolean(process.env.ANTHROPIC_API_KEY), hayUsuarios: (count || 0) > 0 });
}
