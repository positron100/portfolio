import { handleContact, type ContactPayload } from "./_contact";

/**
 * The deployed contact endpoint.
 *
 * Written against the Web `Request`/`Response` API rather than a
 * platform-specific signature, so it runs as-is on Vercel (which is what a
 * Vite SPA with an `api/` directory deploys to with no configuration) and
 * ports to Netlify or Cloudflare by re-exporting it from their entry point
 * instead of rewriting it. All of the actual work lives in `_contact.ts`,
 * which has no host dependencies at all.
 *
 * `_contact.ts` is prefixed with an underscore so the platform treats it as
 * a private module rather than publishing it as its own route.
 */
export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed." }, { status: 405 });
  }

  let payload: ContactPayload;
  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return Response.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  // Behind a proxy the socket address is the proxy's, so the forwarded
  // header is the visitor. First entry only: the rest can be spoofed by the
  // client, and the last is the proxy itself.
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const clientKey = forwarded.split(",")[0].trim() || "unknown";

  const result = await handleContact(payload, process.env, clientKey);
  return Response.json(result.body, { status: result.status });
}
