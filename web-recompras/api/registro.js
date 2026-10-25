// Crear usuario sin correo de confirmación: la persona entra enseguida,
// pero no ve datos hasta que el superadmin la aprueba.
import { configurado, supabaseAdmin, leerCuerpo } from './_comun.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }
  if (!configurado()) { res.status(500).json({ error: 'El sistema no está configurado.' }); return; }
  const { email, password, nombre } = leerCuerpo(req);
  const correo = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) { res.status(400).json({ error: 'Escribí un correo válido.' }); return; }
  if (String(password || '').length < 8) { res.status(400).json({ error: 'La clave tiene que tener al menos 8 caracteres.' }); return; }

  const { error } = await supabaseAdmin().auth.admin.createUser({
    email: correo, password: String(password), email_confirm: true,
    user_metadata: { nombre: String(nombre || '').trim().slice(0, 80) },
  });
  if (error) {
    const existe = /already|registered|exists/i.test(error.message);
    res.status(existe ? 409 : 400).json({ error: existe ? 'Ese correo ya tiene usuario. Entrá con tu clave.' : 'No se pudo crear el usuario: ' + error.message });
    return;
  }
  res.status(200).json({ ok: true });
}
