// Lets any client component tell the install prompt that the user just did something meaningful
// (saved a deal, submitted a profile). PRD v1.6 §7: the prompt only appears after such an action.
export const MEANINGFUL_ACTION_EVENT = "khora:meaningful-action";

export function notifyMeaningfulAction() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MEANINGFUL_ACTION_EVENT));
}
