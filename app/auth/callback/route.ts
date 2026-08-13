import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("terms_agreed_at")
        .eq("id", data.user.id)
        .single();

      const next = profile?.terms_agreed_at ? "/" : "/onboarding";
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
