import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const SUPABASE_URL = 'https://gzwuaorcfboiwztjpgng.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6d3Vhb3JjZmJvaXd6dGpwZ25nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNzIwODcsImV4cCI6MjEwNjg0ODA4N30.Z4xDS_h6sySGnro7EcUOO5b9S5OcJ61rujsCHLl6Ffc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

export const EMAIL_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycby8j5x6gQ-uK5E0i9t8l7N1V9xZ0yB1_dummy/exec'; // Kendi Apps Script URL'ini koru
