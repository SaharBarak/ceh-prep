import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Marketing-unsubscribe token — single-purpose, signed with UNSUB_SECRET.
 *
 * Format:  base64url(userId).base64url(hmacSha256(userId, UNSUB_SECRET, 16 bytes))
 *
 * The token is intentionally NOT time-limited — an unsub link from a 6-month-old
 * email must still work. It IS scoped to one user; even if leaked it only lets
 * an attacker remove the *target* from marketing, not see their data.
 *
 * Two functions:
 *   sign(userId)       — embed in the email URL
 *   verify(token)      — return the userId on success, null on tampered/invalid
 */

const b64url = (buf: Buffer): string =>
  buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

const b64urlDecode = (s: string): Buffer => {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
};

const macFor = (userId: string): Buffer =>
  createHmac("sha256", env.UNSUB_SECRET).update(userId).digest().subarray(0, 16);

export const signUnsubToken = (userId: string): string => {
  const idPart = b64url(Buffer.from(userId, "utf8"));
  const macPart = b64url(macFor(userId));
  return `${idPart}.${macPart}`;
};

export const verifyUnsubToken = (token: string): string | null => {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [idPart, macPart] = parts;
  if (!idPart || !macPart) return null;

  let userId: string;
  let providedMac: Buffer;
  try {
    userId = b64urlDecode(idPart).toString("utf8");
    providedMac = b64urlDecode(macPart);
  } catch {
    return null;
  }

  const expectedMac = macFor(userId);
  if (providedMac.length !== expectedMac.length) return null;
  if (!timingSafeEqual(providedMac, expectedMac)) return null;

  return userId;
};

export const unsubUrl = (userId: string): string =>
  `${env.NEXT_PUBLIC_APP_URL}/api/unsubscribe?t=${signUnsubToken(userId)}`;
