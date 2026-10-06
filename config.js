// config.js - Merkezi Yapılandırma
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://wzghfdfvysqugtdylyic.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6Z2hmZGZ2eXNxdWd0ZHlseWljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5MjgyOTgsImV4cCI6MjA1OTUwNDI5OH0.w_3i1Q0R3x03t5z2uUe3hM4Z2v6lX-W-w3b8Qy0Y5qA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Arka plan bildirim Webhook adresi (Google Apps Script)
export const EMAIL_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxqO8la--6tIYwBSYShpqvWbDVuGDQTYYb0-uBcFD1HmvH401-GMatlASZk-yancE4feA/exec';
export const ADMIN_EMAIL = 'sefer.coban.2116@gmail.com';
