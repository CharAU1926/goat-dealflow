// PR-3 Quality & Safety: automated screening that runs when a profile or startup is submitted.
// Everything here is a pure function so it is easy to test; the database lookups and the write
// of the result live in `lib/screening-server.ts`. Flags never block a submission: they surface
// in the operator review queue, and a human decides.

export const SCREENING_FLAG_CODES = ["disposable_email", "invalid_link", "duplicate_suspected", "content_flag"] as const;
export type ScreeningFlagCode = (typeof SCREENING_FLAG_CODES)[number];
export type ScreeningFlag = { code: ScreeningFlagCode; detail: string };

export const SCREENING_FLAG_LABELS: Record<ScreeningFlagCode, string> = {
  disposable_email: "Disposable Email",
  invalid_link: "Invalid Link",
  duplicate_suspected: "Duplicate Suspected",
  content_flag: "Content Flag",
};

/** Narrows the jsonb column read back from the database; anything malformed is dropped. */
export function parseScreeningFlags(value: unknown): ScreeningFlag[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): ScreeningFlag[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { code, detail } = entry as Record<string, unknown>;
    return (SCREENING_FLAG_CODES as readonly string[]).includes(code as string) && typeof detail === "string" ? [{ code: code as ScreeningFlagCode, detail }] : [];
  });
}

// --- 1. Verified email ----------------------------------------------------------------------

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamailblock.com", "sharklasers.com", "grr.la", "pokemail.net", "spam4.me",
  "10minutemail.com", "10minutemail.net", "20minutemail.com", "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmail.net", "tempmailo.com", "tempail.com",
  "throwawaymail.com", "trashmail.com", "trashmail.net", "trashmail.de", "yopmail.com", "yopmail.net", "yopmail.fr", "getnada.com", "nada.email", "maildrop.cc",
  "dispostable.com", "fakeinbox.com", "mailnesia.com", "mintemail.com", "mytemp.email", "emailondeck.com", "burnermail.io", "mohmal.com", "moakt.com", "discard.email",
  "getairmail.com", "mailcatch.com", "mailtemp.net", "inboxkitten.com", "tmail.ws", "tmpmail.org", "tmpmail.net", "spamgourmet.com", "33mail.com", "anonbox.net",
  "harakirimail.com", "mail.tm", "emailfake.com", "fakemail.net", "mailforspam.com", "mvrht.net", "dropmail.me", "fexpost.com", "owlymail.com", "linshiyouxiang.net",
]);

export function normalizeEmailDomain(email: string) {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  return at > 0 ? email.trim().toLowerCase().slice(at + 1) : "";
}

export function checkEmail(email: string | null | undefined): ScreeningFlag[] {
  const domain = normalizeEmailDomain(email ?? "");
  // A real domain has a dot and only DNS-safe labels; anything else is not deliverable.
  if (!domain || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)) return [{ code: "disposable_email", detail: `Email address is missing or its domain is not valid (${email || "none"}).` }];
  const parts = domain.split(".");
  // Match the domain itself and any parent domain, so sub.mailinator.com is caught too.
  const isDisposable = parts.some((_, index) => DISPOSABLE_DOMAINS.has(parts.slice(index).join(".")));
  return isDisposable ? [{ code: "disposable_email", detail: `Known disposable email domain (${domain}).` }] : [];
}

// --- 2. Links and files ---------------------------------------------------------------------

const ALLOWED_FILE_EXTENSIONS = ["pdf", "png", "jpg", "jpeg"];

/**
 * Checks a submitted link is a public HTTPS URL. When it points straight at a file, the file type
 * must be PDF, PNG or JPG (inferred from the extension: the server never fetches submitted URLs,
 * which would let an applicant aim it at internal services).
 */
export function checkLink(label: string, value: string | null | undefined, options: { file?: boolean } = {}): ScreeningFlag[] {
  const raw = value?.trim();
  if (!raw) return [];
  const invalid = (reason: string): ScreeningFlag[] => [{ code: "invalid_link", detail: `${label}: ${reason}` }];
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return invalid("not a valid URL.");
  }
  if (url.protocol !== "https:") return invalid("must use https://.");
  if (url.username || url.password) return invalid("must not contain credentials.");
  const host = url.hostname.toLowerCase();
  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");
  if (isIpLiteral || host === "localhost" || !host.includes(".") || /\.(local|internal|localhost|test)$/.test(host)) return invalid("must point to a public website, not an IP address or internal host.");
  const extension = /\.([a-z0-9]{1,5})$/i.exec(url.pathname)?.[1]?.toLowerCase();
  // A page such as /about.html is a website, not a file; only flag extensions that are clearly documents or media.
  if (options.file && extension && !ALLOWED_FILE_EXTENSIONS.includes(extension) && !["htm", "html", "php", "aspx", "asp"].includes(extension)) return invalid(`file type .${extension} is not allowed (PDF, PNG or JPG only).`);
  return [];
}

export function checkEvidenceFile(path: string | null | undefined): ScreeningFlag[] {
  if (!path) return [];
  const extension = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
  return extension && ALLOWED_FILE_EXTENSIONS.includes(extension) ? [] : [{ code: "invalid_link", detail: "Evidence document is not a PDF, PNG or JPG file." }];
}

// --- 3. Duplicates --------------------------------------------------------------------------

const COMPANY_SUFFIXES = /\b(ltd|limited|inc|incorporated|llc|llp|plc|gmbh|sa|ag|bv|co|corp|corporation|company|startup|labs?)\b/g;

/** Lower-cases and strips punctuation, spacing and legal suffixes, so "Acme Ltd." equals "acme". */
export function normalizeName(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(COMPANY_SUFFIXES, " ").replace(/[^a-z0-9]/g, "");
}

export function normalizeCopy(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

const MIN_COPY_LENGTH = 40;

export type DuplicateCandidate = { name?: string | null; copy?: string | null };

/** Compares one submission against every other applicant's startup name and pitch copy. */
export function checkDuplicates(subject: DuplicateCandidate, others: DuplicateCandidate[]): ScreeningFlag[] {
  const flags: ScreeningFlag[] = [];
  const name = subject.name ? normalizeName(subject.name) : "";
  const copy = subject.copy ? normalizeCopy(subject.copy) : "";
  if (name.length >= 2 && others.some((other) => other.name && normalizeName(other.name) === name)) flags.push({ code: "duplicate_suspected", detail: "Another applicant has submitted a startup with the same name." });
  if (copy.length >= MIN_COPY_LENGTH && others.some((other) => other.copy && normalizeCopy(other.copy) === copy)) flags.push({ code: "duplicate_suspected", detail: "The pitch copy is identical to another submission." });
  return flags;
}

// --- 4. Safe content ------------------------------------------------------------------------

const CONTENT_RULES: { reason: string; pattern: RegExp }[] = [
  { reason: "token or crypto speculation", pattern: /\b(token\s*(pre-?sale|sale|launch)|ico|ido|airdrops?|meme\s*coins?|shitcoins?|pump\s*(and|&)\s*dump|moon(ing)?\s+soon|(buy|invest\s+in)\s+(our\s+)?(token|coin)s?|crypto\s+(giveaway|doubler)|(token|coin)\s+price\s+(will|to)\s+(rise|increase|go))\b/i },
  { reason: "guaranteed financial returns", pattern: /\b(guarantee[sd]?\s+(\w+\s+){0,3}(returns?|profits?|roi|income|gains?)|(risk|loss)[\s-]*free\s+(investment|returns?|profits?)|(100\s*%|sure|certain)\s+(returns?|profits?|roi)|double\s+your\s+(money|investment)|get\s+rich\s+quick|passive\s+income\s+guaranteed)\b/i },
  { reason: "adult content", pattern: /\b(porn\w*|xxx|nsfw|escorts?|erotic\w*|onlyfans|sex\s*cams?|adult\s+entertainment|hentai)\b/i },
];

export function checkContent(fields: Record<string, string | null | undefined>): ScreeningFlag[] {
  const flags: ScreeningFlag[] = [];
  for (const [label, value] of Object.entries(fields)) {
    if (!value) continue;
    for (const rule of CONTENT_RULES) {
      const match = rule.pattern.exec(value);
      if (match) flags.push({ code: "content_flag", detail: `${label} mentions ${rule.reason} (“${match[0].trim().slice(0, 40)}”).` });
    }
  }
  return flags;
}

/** One flag per code and detail; the screening checks can otherwise repeat themselves. */
export function dedupeFlags(flags: ScreeningFlag[]): ScreeningFlag[] {
  const seen = new Set<string>();
  return flags.filter((flag) => {
    const key = `${flag.code}:${flag.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
