import { createClient } from '@supabase/supabase-js';

// Vite injects env variables prefixed with VITE_ at build time.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fbrgnhdcsqnsqesafqbp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZicmduaGRjc3Fuc3Flc2FmcWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTUxNTMsImV4cCI6MjEwNDM3MTE1M30.55eNHzG8SMg-vh_wPCxZqOamp0X2KJIa6am9ssQm4o8';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Supabase URL or anon key missing – using configured default credentials.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
