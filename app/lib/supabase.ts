import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let browserClient: any;

// Client-side usage (components): singleton, so we don't spawn multiple
// GoTrueClient instances fighting over the same browser storage.
export function createClient() {
  if (!browserClient) {
    browserClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}

// Server-side usage only (API routes): a fresh client per request, scoped
// to the user's access token so RLS policies see them as the authenticated user.
export function createServerClient(accessToken: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    }
  );
}