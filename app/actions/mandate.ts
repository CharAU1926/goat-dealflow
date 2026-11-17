"use server";

import { revalidatePath } from "next/cache";
import { getInvestorSession } from "@/lib/investor-session";
import { mandateSchema, mandateValuesToRow, type MandateFormField } from "@/lib/mandate";

export type SaveMandateResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Partial<Record<MandateFormField, string>> };

// CS-5: stores the investor's deal-filtering mandate on `public.investor_profiles`.
export async function saveMandate(input: unknown): Promise<SaveMandateResult> {
  const parsed = mandateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<MandateFormField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as MandateFormField;
      fieldErrors[field] ??= issue.message;
    }
    return { success: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const values = parsed.data;

  const session = await getInvestorSession();
  if (!session) return { success: false, error: "Please sign in with an investor account." };
  const { supabase, user } = session;

  const { data: existing, error: readError } = await supabase.from("investor_profiles").select("user_id, funds_student_companies").eq("user_id", user.id).maybeSingle<{ user_id: string; funds_student_companies: boolean }>();
  if (readError) {
    console.error("Mandate read error:", readError);
    return { success: false, error: "We couldn't save your mandate. Please try again." };
  }

  // Student companies are only offered to investors who said they fund them.
  if (values.companyType === "include_student" && !existing?.funds_student_companies) {
    return { success: false, error: "Please fix the highlighted fields.", fieldErrors: { companyType: "Student companies are only available to investors who fund them. Update this in your verification details." } };
  }

  const row = mandateValuesToRow(values);
  // Only mandate columns are written, so verification state is never touched from here.
  const { error } = existing
    ? await supabase.from("investor_profiles").update(row).eq("user_id", user.id)
    : await supabase.from("investor_profiles").insert({ user_id: user.id, ...row });

  if (error) {
    console.error("Mandate save error:", error);
    return { success: false, error: "We couldn't save your mandate. Please try again." };
  }

  revalidatePath("/investor/mandate");
  return { success: true };
}
