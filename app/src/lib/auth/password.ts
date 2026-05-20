/**
 * Argon2id password hashing — OWASP-recommended modern KDF.
 *
 * Parameters: m=64MB, t=3 iterations, p=4 parallel lanes. These match the
 * OWASP 2023 recommendation for interactive logins; tune up in Phase 5 if
 * we observe sub-100ms hash times under production load (means hardware
 * outpaced the constants).
 *
 * The @node-rs/argon2 binding is native (Rust), so the runtime cost is real
 * crypto, not pure-JS theater.
 */

import { hash, verify } from "@node-rs/argon2";

// Argon2id = numeric value 2 in the argon2 spec. We avoid importing the
// const enum (`Algorithm.Argon2id`) because TypeScript's isolatedModules
// (required by Next.js) can't resolve ambient const enums across module
// boundaries. The numeric literal is the wire-format value.
const ARGON2ID = 2 as const;

const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 64 * 1024, // 64 MB
  timeCost: 3,
  parallelism: 4,
} as const;

export const hashPassword = async (plaintext: string): Promise<string> => {
  return hash(plaintext, OPTIONS);
};

/**
 * Constant-time verify — argon2's verify is timing-safe by construction.
 * Callers should catch and return false on any throw (malformed hash, etc.)
 * rather than leaking the difference between "wrong password" and "garbage
 * input" via different code paths.
 */
export const verifyPassword = async (
  plaintext: string,
  storedHash: string,
): Promise<boolean> => {
  return verify(storedHash, plaintext);
};
