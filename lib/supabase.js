import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Checked here rather than left to createClient, which throws "supabaseUrl is
// required" from inside a dependency — true, but it doesn't say that the fix is
// a .env file at the project root, or that Expo only reads one at startup.
if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    !supabaseUrl && 'EXPO_PUBLIC_SUPABASE_URL',
    !supabaseAnonKey && 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  ].filter(Boolean);

  throw new Error(
    `Missing ${missing.join(' and ')}. Copy .env.example to .env, fill in your ` +
      'Supabase project URL and anon key, and restart the dev server — Expo ' +
      'reads .env once, at startup.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
