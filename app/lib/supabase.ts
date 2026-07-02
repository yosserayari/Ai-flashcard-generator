import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// We create a single instance of the database connection so it doesn't "forget" you
let supabase: any;

export function createClient() {
  if (!supabase) {
    supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return supabase;
}