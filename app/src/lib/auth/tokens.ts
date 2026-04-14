import { createHash, randomBytes } from "node:crypto";

/**
 * Single-use token primitive for email verification and password reset.
 *
 * Design:
 * - 32 random bytes → base64url (43 chars, 256 bits of entropy)
 * - SHA-256 hash stored in Mongo; plaintext only ever lives in the email URL
 * - Purpose-scoped TTL (24h verify, 1h reset) per NIST SP 800-63B / OWASP
 * - Expiry check is pure and null-safe — runs AFTER the hash match so timing
 *   oracles cannot distinguish "expired" from "wrong token"
 *
 * Rationale (locked in 02-CONTEXT.md §"Token primitive"):
 * - Node-native `crypto` only — no nanoid/uuid/crypto-js
 * - SHA-256, not Argon2id — single-use short-lived tokens don't need
 *   memory-hard hashing and Argon2 latency would hurt every reset click
 */

export type TokenPurpose = "verify_email" | "reset_password";

export type Token = {
  readonly plaintext: string; // goes in URL, never stored
  readonly hash: string; // stored in Mongo
  readonly expiresAt: Date;
};

const TTL_MS: Readonly<Record<TokenPurpose, number>> = {
  verify_email: 24 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
} as const;

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

/**
 * Create a single-use token for a given purpose. Returns the plaintext
 * (goes into the URL emailed to the user — never stored) and the SHA-256
 * hash (stored in Mongo, compared on consume). 32 bytes of randomBytes
 * yields 43 base64url characters — 256 bits of entropy.
 */
export const createToken = (purpose: TokenPurpose): Token => {
  const plaintext = randomBytes(32).toString("base64url");
  return {
    plaintext,
    hash: sha256(plaintext),
    expiresAt: new Date(Date.now() + TTL_MS[purpose]),
  };
};

/**
 * Rehash a plaintext token from a URL so we can query Mongo by hash.
 * Caller passes the URL value; we re-derive the stored hash and match.
 */
export const hashToken = (plaintext: string): string => sha256(plaintext);

/**
 * Pure expiry check. Null/undefined counts as expired (no token stored).
 * Check runs AFTER the hash match so timing oracles can't distinguish
 * "expired" from "wrong token".
 */
export const isExpired = (expiresAt: Date | null | undefined): boolean =>
  !expiresAt || expiresAt.getTime() < Date.now();
