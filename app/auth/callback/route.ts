import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] exchangeCodeForSession failed:", error.message, error);
    }

    if (!error && data.user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("terms_agreed_at")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        console.error("[auth/callback] profile lookup failed:", profileError.message, profileError);
      }

      const next = profile?.terms_agreed_at ? "/" : "/onboarding";
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else {
    console.error("[auth/callback] no code param in callback URL:", request.url);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
