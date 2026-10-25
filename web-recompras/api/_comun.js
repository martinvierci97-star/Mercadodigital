// Configuración compartida por las funciones del servidor.
// Acepta los nombres de variables que crea la integración de Supabase en Vercel.
import { createClient } from '@supabase/supabase-js';

const env = (...nombres) => nombres.map((n) => process.env[n]).find(Boolean) || '';

export const SUPABASE_URL = env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
export const SUPABASE_ANON = env('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
export const SUPABASE_SERVICE = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');
export const POSTGRES_URL = env('POSTGRES_URL_NON_POOLING', 'POSTGRES_URL', 'DATABASE_URL');
export const configurado = () => Boolean(SUPABASE_URL && SUPABASE_ANON && SUPABASE_SERVICE);

let admin = null;
export function supabaseAdmin() {
  admin ||= createClient(SUPABASE_URL, SUPABASE_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

// Devuelve el perfil del usuario que hace el pedido, o null si el token no es válido
export async function quienPide(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: perfil } = await sb.from('perfiles').select('id,email,rol').eq('id', data.user.id).single();
  return perfil || null;
}

export function leerCuerpo(req) {
  if (typeof req.body === 'string') { try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; } }
  return req.body || {};
}
