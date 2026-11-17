export const REVIEW_ACTIONS = ["approve", "request_changes", "reject"] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];
export type ReviewTarget = "investor" | "founder" | "startup";

// Quick reason checklist. The code is stored in `operator_audit_logs.reason_code`; the label is
// what the applicant sees as the reviewer's note.
export const REASON_CODES: Record<ReviewTarget, Record<string, string>> = {
  investor: {
    evidence_unreadable: "The evidence document is unreadable or incomplete.",
    evidence_mismatch: "The evidence does not support the investor type you selected.",
    identity_mismatch: "The name on the evidence does not match your account.",
    more_proof_needed: "Additional proof is required to confirm your investor status.",
    not_eligible: "The application does not meet GOAT's investor criteria.",
  },
  founder: {
    profile_unclear: "Your headline or bio needs more detail about what you are building.",
    linkedin_mismatch: "The LinkedIn profile could not be matched to your account.",
    skills_unsupported: "The listed skills are not supported by your profile or links.",
    content_guidelines: "Parts of the profile do not meet GOAT's content guidelines.",
  },
  startup: {
    evidence_unreadable: "The uploaded document is unreadable or incomplete.",
    registration_mismatch: "The registration details do not match the uploaded document.",
    student_status_unclear: "The document does not confirm student or incubator status.",
    claims_unsupported: "The one-liner or traction signal makes claims we could not support.",
    not_raising: "The company does not appear to be actively raising.",
  },
};

// IV-4: once an application is decided, its evidence only needs to be kept this long.
export const EVIDENCE_RETENTION_DAYS_AFTER_DECISION = 30;

export type ReviewActionResult = { success: true } | { success: false; error: string };
export type SignedUrlResult = { success: true; url: string; expiresInSeconds: number } | { success: false; error: string };
