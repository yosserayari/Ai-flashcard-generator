import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { anonymousRatelimit, authenticatedRatelimit } from "@/app/lib/ratelimit";
const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function middleware(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let userId: string | null = null;

  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      userId = data.user.id;
    }
  }

  const { success, limit, remaining, reset } = userId
    ? await authenticatedRatelimit.limit(userId)
    : await anonymousRatelimit.limit(getClientIp(req));

  if (!success) {
    return NextResponse.json(
      {
        error: userId
          ? "You've hit the generation limit for now — please slow down a bit."
          : "You've hit the limit for anonymous generation. Sign in with Google for a higher limit.",
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/generate",
};