import { COMMITMENTS, ROLES_SOUGHT, SKILL_TAXONOMY, type Commitment, type RoleSought, type Skill } from "@/lib/founder-profile";

// CF-13: co-founder browse opens once this many profiles are approved. Override per
// environment with COFOUNDER_OPENING_THRESHOLD (e.g. a low number while testing).
export const DEFAULT_OPENING_THRESHOLD = 20;
export function getOpeningThreshold() {
  const configured = Number(process.env.COFOUNDER_OPENING_THRESHOLD);
  return Number.isInteger(configured) && configured >= 0 ? configured : DEFAULT_OPENING_THRESHOLD;
}

export const NOTE_MAX_LENGTH = 300;
export const MESSAGE_MAX_LENGTH = 2000;
export const BROWSE_LIMIT = 60;

export type InterestStatus = "pending" | "accepted" | "declined" | "withdrawn";

export type InterestRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  note: string | null;
  status: InterestStatus;
  created_at: string;
};
export const INTEREST_COLUMNS = "id, from_user_id, to_user_id, note, status, created_at";

export type MessageRow = { id: string; match_id: string; sender_id: string; content: string; created_at: string };
export const MESSAGE_COLUMNS = "id, match_id, sender_id, content, created_at";

// What a browse card shows. Links and contact details are deliberately left out.
export type CofounderCard = {
  user_id: string;
  name: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  languages: string[] | null;
  skills: string[] | null;
  roles_sought: string[] | null;
  commitment: string | null;
};
export const CARD_COLUMNS = "user_id, name, headline, bio, location, languages, skills, roles_sought, commitment";

/** How the viewer relates to another founder, derived from the interest between them (if any). */
export type InterestState =
  | { kind: "none" }
  | { kind: "sent"; interestId: string }
  | { kind: "received"; interestId: string; note: string | null }
  | { kind: "matched"; interestId: string }
  | { kind: "closed" };

export function interestStateFor(viewerId: string, otherId: string, interests: InterestRow[]): InterestState {
  const between = interests.filter((interest) => (interest.from_user_id === viewerId && interest.to_user_id === otherId) || (interest.from_user_id === otherId && interest.to_user_id === viewerId));
  const matched = between.find((interest) => interest.status === "accepted");
  if (matched) return { kind: "matched", interestId: matched.id };
  const received = between.find((interest) => interest.status === "pending" && interest.to_user_id === viewerId);
  if (received) return { kind: "received", interestId: received.id, note: received.note };
  const sent = between.find((interest) => interest.from_user_id === viewerId);
  if (!sent || sent.status === "withdrawn") return { kind: "none" };
  return sent.status === "pending" ? { kind: "sent", interestId: sent.id } : { kind: "closed" };
}

export type BrowseFilters = { role: RoleSought | null; skills: Skill[]; commitment: Commitment | null; location: string };

const ALL_SKILLS = Object.values(SKILL_TAXONOMY).flat() as string[];
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/** CF-2: reads the hard filters from the URL, ignoring anything that is not a known option. */
export function parseBrowseFilters(params: Record<string, string | string[] | undefined>): BrowseFilters {
  const role = first(params.role);
  const commitment = first(params.commitment);
  const skills = [params.skills ?? []].flat().filter((skill) => ALL_SKILLS.includes(skill)) as Skill[];
  return {
    role: (ROLES_SOUGHT as readonly string[]).includes(role) ? (role as RoleSought) : null,
    skills: [...new Set(skills)],
    commitment: (COMMITMENTS as readonly string[]).includes(commitment) ? (commitment as Commitment) : null,
    // Letters, digits, spaces and a few separators only, so the value is safe inside a LIKE pattern.
    location: first(params.location).replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 60),
  };
}

export const hasActiveFilters = (filters: BrowseFilters) => Boolean(filters.role || filters.commitment || filters.location || filters.skills.length);

// Fixed locale and time zone, so the server and the browser always render the same text.
const timeFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Nicosia" });
export const formatMessageTime = (value: string) => timeFormatter.format(new Date(value));
