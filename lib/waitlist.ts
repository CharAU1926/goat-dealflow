export const WAITLIST_ROLES = ["founder", "investor"] as const;
export const WAITLIST_STATUSES = ["pending", "verified", "invited"] as const;

export type WaitlistRole = (typeof WAITLIST_ROLES)[number];
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export type WaitlistRow = {
  id: string;
  email: string;
  role: WaitlistRole;
  status: WaitlistStatus | null;
  created_at: string | null;
  invited_at: string | null;
};

export const WAITLIST_COLUMNS = "id, email, role, status, created_at, invited_at";

// WL-3: shown to anyone who tries to sign in during the closed beta without an invitation.
export const CLOSED_BETA_MESSAGE = "Khora Flow is currently in private closed beta. You are on the waitlist.";

// The gate is on by default; set NEXT_PUBLIC_CLOSED_BETA=false when the beta opens up.
export const isClosedBeta = () => process.env.NEXT_PUBLIC_CLOSED_BETA !== "false";

export type InviteResult = { success: true; message: string } | { success: false; error: string };
