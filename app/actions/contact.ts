"use server";

import { z } from "zod";
import { buildMailto, introductionSubject } from "@/lib/deal-detail";
import { getInvestorSession } from "@/lib/investor-session";
import { rateLimit } from "@/lib/rate-limit";

export type ContactCompanyResult = { success: true; mailto: string; notified: boolean } | { success: false; error: string };

const HOUR = 60 * 60 * 1000;

// CS-4 / IN-1 / DI-2: "Contact Company". Everything security-relevant happens in the database
// function `log_investor_contact`: it re-checks that the caller is a verified investor, logs the
// click (clicked_at = now()), notifies the founder at most once per 24 hours, and only then
// releases the contact email. Unverified users can never obtain it, whatever the client sends.
export async function contactCompany(input: unknown): Promise<ContactCompanyResult> {
  const parsed = z.object({ startupId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { success: false, error: "This company is no longer available." };

  const session = await getInvestorSession();
  if (!session) return { success: false, error: "Please sign in with an investor account." };
  const { supabase, user, profile } = session;

  const limit = rateLimit(`contact:${user.id}`, 30, HOUR);
  if (!limit.allowed) return { success: false, error: `Too many contact attempts. Please try again in ${Math.ceil(limit.retryAfter / 60)} minutes.` };

  const { data, error } = await supabase.rpc("log_investor_contact", { p_startup_id: parsed.data.startupId });
  if (error) {
    // 42501 = not a verified investor; P0002 = company gone, or no contact email on file.
    if (error.code === "42501") return { success: false, error: "Direct contact is restricted to verified investors." };
    if (error.code === "P0002") return { success: false, error: error.message };
    console.error("Investor contact error:", error);
    return { success: false, error: "We couldn't open the introduction. Please try again." };
  }

  const row = (Array.isArray(data) ? data[0] : data) as { out_email: string; out_startup_name: string; out_notified: boolean } | undefined;
  if (!row?.out_email) return { success: false, error: "This company has not provided a contact email yet." };

  const investorName = profile.full_name?.trim() || "Investor";
  return { success: true, mailto: buildMailto(row.out_email, introductionSubject(investorName, row.out_startup_name)), notified: row.out_notified };
}
