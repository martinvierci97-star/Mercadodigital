// Crea las tablas y las reglas de seguridad la primera vez que se abre la web.
// Si ya están creadas, no hace nada.
import pg from 'pg';
import schema from './_schema.js';
import { POSTGRES_URL, configurado, supabaseAdmin } from './_comun.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }
  if (!configurado() || !POSTGRES_URL) { res.status(500).json({ error: 'Falta conectar la base de datos (Supabase) en Vercel.' }); return; }

  const ya = await supabaseAdmin().from('perfiles').select('id', { count: 'exact', head: true });
  if (!ya.error) { res.status(200).json({ ok: true, yaEstaba: true }); return; }

  // Supabase exige SSL; su certificado no está en la lista estándar de Node
  const url = POSTGRES_URL.replace(/[?&]sslmode=[^&]*/g, '');
  const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await db.connect();
    await db.query(schema);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo crear la base: ' + e.message });
  } finally {
    await db.end().catch(() => {});
  }
}
