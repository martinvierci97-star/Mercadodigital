// El superadmin genera una clave nueva para quien se la olvidó.
import { randomInt } from 'node:crypto';
import { configurado, supabaseAdmin, quienPide, leerCuerpo } from './_comun.js';

const LETRAS = 'abcdefghjkmnpqrstuvwxyz23456789';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }
  if (!configurado()) { res.status(500).json({ error: 'El sistema no está configurado.' }); return; }
  const yo = await quienPide(req);
  if (!yo || yo.rol !== 'superadmin') { res.status(403).json({ error: 'Solo el superadmin puede cambiar claves.' }); return; }
  const { id } = leerCuerpo(req);
  if (!id || id === yo.id) { res.status(400).json({ error: 'Usuario no válido.' }); return; }

  const clave = Array.from({ length: 10 }, () => LETRAS[randomInt(LETRAS.length)]).join('');
  const { error } = await supabaseAdmin().auth.admin.updateUserById(String(id), { password: clave });
  if (error) { res.status(400).json({ error: 'No se pudo cambiar la clave.' }); return; }
  res.status(200).json({ clave });
}
