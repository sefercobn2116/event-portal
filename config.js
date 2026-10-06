import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const SUPABASE_URL = 'https://gzwuaorcfboiwztjpgng.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6d3Vhb3JjZmJvaXd6dGpwZ25nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNzIwODcsImV4cCI6MjEwNjg0ODA4N30.Z4xDS_h6sySGnro7EcUOO5b9S5OcJ61rujsCHLl6Ffc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
