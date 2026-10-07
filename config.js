import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const SUPABASE_URL = 'https://gzwuaorcfboiwztjpgng.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOi...'; // senin anon key'in

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

export const EMAIL_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycby.../exec';
