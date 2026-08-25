/**
 * The contact endpoint's actual work, kept free of any host framework so the
 * same code runs behind the Vercel handler in `api/contact.ts`, behind the
 * dev-server middleware in `vite.config.ts`, and behind a Netlify or
 * Cloudflare adapter if this ever moves. It takes a parsed body and returns
 * a status plus a payload; it knows nothing about `req`/`res` shapes.
 *
 * Nothing in this file is reachable from the browser bundle. The API key
 * lives only in the environment of whatever runs this.
 */

export interface ContactPayload {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  phone?: unknown;
  /** Honeypot. Real people never see this field, so anything in it is a bot. */
  company?: unknown;
}

export interface HandlerResult {
  status: number;
  body: { ok: boolean; error?: string };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Generous enough for a real enquiry, small enough to bound the payload. */
const LIMITS = { name: 120, email: 200, phone: 40, message: 5000 } as const;

const RATE_LIMIT = { windowMs: 60_000, max: 3 } as const;
const hits = new Map<string, number[]>();

/**
 * Best-effort rate limiting.
 *
 * Deliberately in-memory: a serverless deployment may run several instances
 * and recycle them, so this bounds a burst from one address against one
 * instance rather than guaranteeing a global cap. That is the right trade
 * here - it costs nothing, needs no external store, and stops the case that
 * actually happens (a script hammering the form). A hard global limit would
 * need Redis or the platform's own gateway limiting.
 */
export function rateLimit(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  if (recent.length >= RATE_LIMIT.max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Keeps the map from growing without bound on a long-lived instance.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= RATE_LIMIT.windowMs)) hits.delete(k);
  }
  return true;
}

/**
 * Strips control characters and clamps length.
 *
 * The header-injection guard is the important part: a newline inside the
 * name would otherwise be interpolated into the Subject line, and a subject
 * containing a newline is how a header gets forged. Length caps stop a
 * multi-megabyte body being relayed.
 */
function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    // Matching control characters is the point here: they are what makes
    // header injection possible. Newline and tab sit outside the range, so
    // a real message keeps its line breaks.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function cleanHeader(value: unknown, max: number): string {
  return clean(value, max).replace(/[\r\n]+/g, " ");
}

export interface BuiltEmail {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  text: string;
}

export function buildEmail(
  fields: { name: string; email: string; phone: string; message: string },
  config: { from: string; to: string },
): BuiltEmail {
  const lines = [
    "New message from your portfolio website",
    "",
    `Name: ${fields.name}`,
    `Email: ${fields.email}`,
  ];
  // Only when the visitor actually gave one - the form has no phone field
  // today, so this stays out of the email rather than printing an empty row.
  if (fields.phone) lines.push(`Phone: ${fields.phone}`);
  lines.push("", "Message:", "", fields.message);

  return {
    from: config.from,
    to: [config.to],
    // The visitor's address cannot be the real `From`: sending as a domain
    // you do not control fails SPF/DKIM alignment and the message is
    // rejected or filed as spam. It goes here instead, so hitting reply in
    // any mail client answers the visitor directly.
    reply_to: fields.email,
    subject: `Connecting via Portfolio from ${fields.name}`,
    text: lines.join("\n"),
  };
}

export interface Env {
  RESEND_API_KEY?: string;
  CONTACT_EMAIL?: string;
  EMAIL_FROM?: string;
}

export async function handleContact(
  payload: ContactPayload,
  env: Env,
  clientKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HandlerResult> {
  // Answered exactly like a success. A bot that filled the honeypot should
  // learn nothing from the response, and no mail is sent.
  if (clean(payload.company, 100)) return { status: 200, body: { ok: true } };

  const name = cleanHeader(payload.name, LIMITS.name);
  const email = cleanHeader(payload.email, LIMITS.email);
  const phone = cleanHeader(payload.phone, LIMITS.phone);
  const message = clean(payload.message, LIMITS.message);

  // Re-validated here, not trusted from the client: the browser check is a
  // convenience, this one is the rule.
  if (name.length < 2) return { status: 400, body: { ok: false, error: "A name is required." } };
  if (!EMAIL_PATTERN.test(email))
    return { status: 400, body: { ok: false, error: "A valid email address is required." } };
  if (message.length < 10)
    return { status: 400, body: { ok: false, error: "A message is required." } };

  if (!rateLimit(clientKey))
    return { status: 429, body: { ok: false, error: "Too many messages. Try again shortly." } };

  const apiKey = env.RESEND_API_KEY;
  const to = env.CONTACT_EMAIL;
  const from = env.EMAIL_FROM;
  if (!apiKey || !to || !from) {
    // Logged for the operator, never described to the caller: a public form
    // should not report which server-side variable is missing.
    console.error("[contact] missing RESEND_API_KEY, CONTACT_EMAIL or EMAIL_FROM");
    return { status: 500, body: { ok: false, error: "Unable to send right now." } };
  }

  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildEmail({ name, email, phone, message }, { from, to })),
  });

  if (!response.ok) {
    console.error("[contact] provider rejected the message", response.status, await response.text());
    return { status: 502, body: { ok: false, error: "Unable to send right now." } };
  }

  return { status: 200, body: { ok: true } };
}
