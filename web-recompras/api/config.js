// Datos públicos que necesita el navegador para conectarse a Supabase.
// La "anon key" es pública por diseño: la seguridad está en las reglas de la base.
export default function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    res.status(500).json({ error: 'Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en Vercel.' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json({ url, anonKey, ia: Boolean(process.env.ANTHROPIC_API_KEY) });
}
