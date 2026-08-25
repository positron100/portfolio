/**
 * Runnable check for the contact endpoint's core.
 *
 *   node --experimental-strip-types api/_contact.test.mjs
 *
 * The provider is stubbed, so this asserts the exact outgoing payload -
 * recipient, sender, Reply-To, subject format and body layout - plus the
 * validation, honeypot and rate-limit branches, without sending real mail or
 * needing an API key.
 */
import assert from "node:assert/strict";
import { handleContact, buildEmail } from "./_contact.ts";

const env = {
  RESEND_API_KEY: "test-key",
  CONTACT_EMAIL: "owner@example.com",
  EMAIL_FROM: "Portfolio <noreply@example.com>",
};

function stubFetch() {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return { ok: true, status: 200, text: async () => "" };
  };
  return { impl, calls };
}

const valid = {
  name: "John Doe",
  email: "john@example.com",
  message: "Hello Mukul, I would like to connect with you regarding a role.",
};

// --- the email that actually goes out -------------------------------------
{
  const { impl, calls } = stubFetch();
  const result = await handleContact(valid, env, "ip-1", impl);
  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);

  const sent = calls[0].body;
  assert.deepEqual(sent.to, ["owner@example.com"], "delivered to the configured address");
  assert.equal(sent.from, "Portfolio <noreply@example.com>", "sent as the verified sender");
  assert.equal(sent.reply_to, "john@example.com", "replying reaches the visitor");
  assert.equal(sent.subject, "Connecting via Portfolio from John Doe", "exact subject format");
  assert.match(sent.text, /^New message from your portfolio website/);
  assert.match(sent.text, /Name: John Doe/);
  assert.match(sent.text, /Email: john@example\.com/);
  assert.ok(sent.text.trimEnd().endsWith(valid.message), "message is the body");
  assert.ok(!sent.text.includes("Phone:"), "no empty phone row when none was given");
  assert.equal(calls[0].init.headers.Authorization, "Bearer test-key");
}

// --- phone appears only when supplied --------------------------------------
{
  const { impl, calls } = stubFetch();
  await handleContact({ ...valid, phone: "+91 90000 00000" }, env, "ip-phone", impl);
  assert.match(calls[0].body.text, /Phone: \+91 90000 00000/);
}

// --- header injection cannot forge a header --------------------------------
{
  const { impl, calls } = stubFetch();
  await handleContact(
    { ...valid, name: "Evil\r\nBcc: victim@example.com" },
    env,
    "ip-inject",
    impl,
  );
  assert.ok(!calls[0].body.subject.includes("\n"), "subject is a single line");
  assert.ok(!calls[0].body.subject.includes("\r"));
  assert.match(calls[0].body.subject, /^Connecting via Portfolio from Evil Bcc: victim@example\.com$/);
}

// --- server-side validation, independent of the browser --------------------
for (const [label, payload] of [
  ["missing name", { ...valid, name: "" }],
  ["bad email", { ...valid, email: "not-an-email" }],
  ["short message", { ...valid, message: "hi" }],
]) {
  const { impl, calls } = stubFetch();
  const result = await handleContact(payload, env, `ip-${label}`, impl);
  assert.equal(result.status, 400, `${label} is rejected`);
  assert.equal(calls.length, 0, `${label} sends nothing`);
}

// --- honeypot: looks like success, sends nothing ---------------------------
{
  const { impl, calls } = stubFetch();
  const result = await handleContact({ ...valid, company: "spam co" }, env, "ip-bot", impl);
  assert.equal(result.status, 200, "a bot learns nothing from the response");
  assert.equal(calls.length, 0, "no mail is sent");
}

// --- rate limiting ---------------------------------------------------------
{
  const { impl, calls } = stubFetch();
  const key = "ip-flood";
  for (let i = 0; i < 3; i++) {
    assert.equal((await handleContact(valid, env, key, impl)).status, 200);
  }
  const blocked = await handleContact(valid, env, key, impl);
  assert.equal(blocked.status, 429, "the fourth in a minute is refused");
  assert.equal(calls.length, 3, "and never reaches the provider");
  // A different visitor is unaffected.
  assert.equal((await handleContact(valid, env, "ip-other", impl)).status, 200);
}

// --- misconfiguration is never described to the caller ---------------------
{
  const { impl, calls } = stubFetch();
  const result = await handleContact(valid, {}, "ip-noenv", impl);
  assert.equal(result.status, 500);
  assert.ok(!/API|KEY|EMAIL_FROM|CONTACT_EMAIL/i.test(result.body.error ?? ""));
  assert.equal(calls.length, 0);
}

// --- provider failure surfaces as a retryable error ------------------------
{
  const failing = async () => ({ ok: false, status: 422, text: async () => "domain not verified" });
  const result = await handleContact(valid, env, "ip-fail", failing);
  assert.equal(result.status, 502);
  assert.equal(result.body.ok, false);
}

// --- the builder itself ----------------------------------------------------
{
  const email = buildEmail(
    { name: "Ada", email: "ada@example.com", phone: "", message: "Hi" },
    { from: "a@b.com", to: "c@d.com" },
  );
  assert.equal(email.subject, "Connecting via Portfolio from Ada");
  assert.equal(email.reply_to, "ada@example.com");
}

console.log("contact endpoint: all checks passed");
