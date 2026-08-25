import type { ContactFormValues } from "@/types";

/**
 * Posts the form to the site's own contact endpoint, which sends the mail.
 *
 * This used to open the visitor's mail client with a prefilled `mailto:`,
 * because there was no server. There is one now: `api/contact.ts`, with the
 * work in `api/_contact.ts`. Nothing secret passes through here - the API
 * key, the destination address and the verified sender all live in the
 * endpoint's environment, and the browser only ever sees this JSON body and
 * an ok/error back.
 *
 * Throws on failure so `ContactForm`'s existing try/catch drives its error
 * state exactly as it already did.
 */
export async function submitContactForm(values: ContactFormValues): Promise<void> {
  const response = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    // The endpoint returns a message safe to show; anything else falls back
    // to a generic one rather than surfacing a status code to the visitor.
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error ?? "Unable to send right now.");
  }
}
