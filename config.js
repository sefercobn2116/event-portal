import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Supabase Bilgilerin
export const SUPABASE_URL = 'https://gzwuaorcfboiwztjpgng.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6d3Vhb3JjZmJvaXd6dGpwZ25nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNzIwODcsImV4cCI6MjEwNjg0ODA4N30.Z4xDS_h6sySGnro7EcUOO5b9S5OcJ61rujsCHLl6Ffc';

// Google Drive API & Webhook Bilgilerin
export const GOOGLE_API_KEY = 'AIzaSyDvOEy6F-vLnC3jef2kaq1pFtgwXCXTogU';
export const UPLOAD_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwg1jDMRhvzCwxw0Mow6P22HqMgiIcI63bF5ppA6rZeK320HjQ61dFGrXUetpy4TB33/exec';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
