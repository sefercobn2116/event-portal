// modules/auth.js
import { supabase } from '../config.js';

export function getSessionUser() {
  try {
    const raw = localStorage.getItem('portal_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setSessionUser(userData) {
  localStorage.setItem('portal_user', JSON.stringify(userData));
}

export function clearSession() {
  localStorage.removeItem('portal_user');
}

// BÜYÜK/KÜÇÜK HARFE DUYARSIZ (ILIKE) ARAMA
export async function loginUser(usernameOrEmail, password) {
  const cleanInput = usernameOrEmail.trim();

  // ilike ile Sefer, sefer veya SEFER yazılsa da bulur
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .or(`username.ilike.${cleanInput},email.ilike.${cleanInput}`)
    .eq('password', password.trim())
    .maybeSingle();

  if (error || !data) {
    throw new Error('Geçersiz kullanıcı adı veya şifre.');
  }

  setSessionUser(data);
  return data;
}

export async function registerUser(username, email, password) {
  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .or(`username.ilike.${cleanUsername},email.ilike.${cleanEmail}`)
    .maybeSingle();

  if (existing) {
    throw new Error('Bu kullanıcı adı veya e-posta adresi zaten kullanımda.');
  }

  const { data, error } = await supabase
    .from('users')
    .insert([{
      username: cleanUsername,
      email: cleanEmail,
      password: password.trim(),
      role: 'user',
      is_admin: false
    }])
    .select()
    .single();

  if (error) throw error;
  setSessionUser(data);
  return data;
}
