import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { consumeAuthIntent, destinationForRole, syncProfile } from "@/lib/auth";
import { saveDeal } from "@/lib/deals";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const loginError = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));

  const supabase = await createClient();

  // PKCE code from Google OAuth or the default magic-link email; token_hash covers custom email templates.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return loginError("link");
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return loginError("link");
  } else {
    return loginError(searchParams.has("error") ? "link" : "auth");
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return loginError("auth");

  const intent = await consumeAuthIntent();
  const profile = await syncProfile(supabase, user, intent);
  const role = profile?.role ?? null;

  // AU-3: a deal flagged before sign-in is saved now, and the user lands on its detail page
  // (after role selection, for a first-time user).
  if (intent?.flag && (await saveDeal(supabase, user.id, intent.flag.startupId, intent.flag.campaign))) {
    const dealPath = `/deals/${intent.flag.startupId}`;
    return NextResponse.redirect(new URL(role ? dealPath : `/onboarding?next=${encodeURIComponent(dealPath)}`, request.url));
  }

  // A requested destination is only honoured once onboarding is done.
  const destination = role && intent?.next ? intent.next : destinationForRole(role);
  return NextResponse.redirect(new URL(destination, request.url));
}
