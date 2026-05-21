import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Newsletter-purpose signed tokens. Signed with UNSUB_SECRET (same key
 * pool as the User-based unsubscribe tokens) but the payload is keyed
 * by a purpose tag so that a token issued for `confirm` cannot be
 * reused to drive `unsubscribe`, and vice-versa.
 *
 *   Format: base64url(purpose:email).base64url(hmac16)
 *   Purpose: "confirm" | "unsubscribe"
 *
 * Confirm tokens are validated against a server-side expiry (stored
 * on the NewsletterSubscriber record). Unsubscribe tokens are not
 * time-limited — a 6-month-old newsletter must still unsubscribe.
 */

const b64url = (buf: Buffer): string =>
  buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

const b64urlDecode = (s: string): Buffer => {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
};

export type Purpose = "confirm" | "unsubscribe";

const payload = (purpose: Purpose, email: string): string =>
  `${purpose}:${email.trim().toLowerCase()}`;

const macFor = (purpose: Purpose, email: string): Buffer =>
  createHmac("sha256", env.UNSUB_SECRET)
    .update(payload(purpose, email))
    .digest()
    .subarray(0, 16);

export const signNewsletterToken = (
  purpose: Purpose,
  email: string,
): string => {
  const data = b64url(Buffer.from(payload(purpose, email), "utf8"));
  const mac = b64url(macFor(purpose, email));
  return `${data}.${mac}`;
};

export const verifyNewsletterToken = (
  purpose: Purpose,
  token: string,
): string | null => {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [dataPart, macPart] = parts;
  if (!dataPart || !macPart) return null;

  let raw: string;
  let providedMac: Buffer;
  try {
    raw = b64urlDecode(dataPart).toString("utf8");
    providedMac = b64urlDecode(macPart);
  } catch {
    return null;
  }

  if (!raw.startsWith(`${purpose}:`)) return null;
  const email = raw.slice(purpose.length + 1);
  if (!email || email.length > 254) return null;

  const expectedMac = macFor(purpose, email);
  if (providedMac.length !== expectedMac.length) return null;
  if (!timingSafeEqual(providedMac, expectedMac)) return null;

  return email;
};

export const newsletterConfirmUrl = (email: string): string =>
  `${env.NEXT_PUBLIC_APP_URL}/api/newsletter/confirm?t=${signNewsletterToken("confirm", email)}`;

export const newsletterUnsubUrl = (email: string): string =>
  `${env.NEXT_PUBLIC_APP_URL}/api/newsletter/unsubscribe?t=${signNewsletterToken("unsubscribe", email)}`;
