export type LegalDocument = "privacy" | "terms";

export const DISCLAIMER = "GOAT is an introductions and software workflow platform. GOAT does not provide investment advice, broker transactions, custody funds, or guarantee outcomes. All investment decisions are made independently.";

export const legalContent: Record<LegalDocument, { title: string; paragraphs: string[] }> = {
  privacy: {
    title: "Privacy Policy",
    paragraphs: [
      "GOAT Deal Flow is the data controller for waitlist information collected through this site, with its operating base in Nicosia, Cyprus.",
      "We collect your email address and selected role only to manage early-access invitations and communicate about the GOAT private beta. We do not sell your personal data or use it for unrelated advertising.",
      "You may request access, correction, or deletion of your waitlist information by contacting contact@goatdealflow.eu.",
    ],
  },
  terms: {
    title: "Terms of Service",
    paragraphs: [
      "GOAT is a software workflow and introductions platform. Access is provided on an invitation basis and may change as the product develops.",
      DISCLAIMER,
      "By joining the waitlist, you agree that GOAT may use the submitted contact details only to manage access and relevant product communications.",
    ],
  },
};
