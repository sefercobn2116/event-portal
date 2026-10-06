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

export async function loginUser(email, password) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .eq('password', password)
    .single();

  if (error || !data) {
    throw new Error('Geçersiz e-posta veya şifre.');
  }

  setSessionUser(data);
  return data;
}

export async function registerUser(username, email, password) {
  const cleanEmail = email.trim().toLowerCase();
  
  // E-posta kontrolü
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (existing) {
    throw new Error('Bu e-posta adresi zaten kullanımda.');
  }

  const { data, error } = await supabase
    .from('users')
    .insert([{
      username: username.trim(),
      email: cleanEmail,
      password: password,
      role: 'user',
      is_admin: false
    }])
    .select()
    .single();

  if (error) throw error;
  setSessionUser(data);
  return data;
}
