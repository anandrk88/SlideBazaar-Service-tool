/**
 * The strings the wizard uses to refuse a step, and the map from a stored
 * blocker back to a stable code.
 *
 * Why a code and never the string: WizardAttempt.blocker arrives over
 * POST /api/wizard-attempt, which is unauthenticated by design and caps the
 * field at 200 characters of whatever the caller sent. The admin page renders
 * it through React, which escapes it; a WhatsApp message on somebody's phone
 * does not. Step 5 blockers in particular are server messages that interpolate
 * catalogue names, so they are never forwarded verbatim.
 *
 * No "server-only" here: this is imported by the wizard, which is a client
 * component.
 */
export const BLOCKER = {
  NO_TREATMENT: "Please select a treatment",
  NO_STYLE: "Please choose a style",
  TEMPLATE_REQUIRED: "Please upload your own template",
  NO_SLIDE_COUNT: "Please tell us how many slides you need designed",
  NO_DELIVERY: "Please choose a delivery date",
  NO_FILES: "Please upload your presentation",
  NO_SLIDES_LINK: "Please paste your Google Slides link",
  BRIEF_TOO_SHORT: "Please write a short brief for our designers",
  NOT_SIGNED_IN: "Not signed in",
  NETWORK: "Network error",
} as const;

const BY_MESSAGE = new Map<string, string>(Object.entries(BLOCKER).map(([code, msg]) => [msg, code]));

/**
 * The codes the order endpoint returns. The wizard stores these directly, so
 * they arrive already shaped like a code rather than a sentence.
 */
const SERVER_CODES = new Set([
  "NOT_SIGNED_IN",
  "INVALID_ORDER",
  "TREATMENT_UNAVAILABLE",
  "STYLE_UNAVAILABLE",
  "DELIVERY_UNAVAILABLE",
  "TEXT_SERVICE_UNAVAILABLE",
  "NO_SOURCE",
  "NO_TEMPLATE",
  "FILE_REJECTED",
  "UPLOAD_FAILED",
  "ORDER_FAILED",
]);

/** "Step 4: Please write a short brief..." becomes "STEP4_BRIEF_TOO_SHORT". */
export function blockerCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = /^Step ([1-5]): ([\s\S]*)$/.exec(raw);
  if (!m) return "OTHER";
  const rest = m[2].trim();
  if (SERVER_CODES.has(rest)) return `STEP${m[1]}_${rest}`;
  const code = BY_MESSAGE.get(rest);
  return code ? `STEP${m[1]}_${code}` : `STEP${m[1]}_OTHER`;
}
