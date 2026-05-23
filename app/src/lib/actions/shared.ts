import { headers } from "next/headers";
import { AuditModel } from "@/lib/db/models/audit";
import { env } from "@/lib/env";

/**
 * Shared non-action primitives for server-side auth flows.
 *
 * This module is intentionally NOT marked `"use server"` because Next.js 15
 * enforces at build time that every top-level export from a `"use server"`
 * file is an async function (a server action). Types, sync helpers, and
 * plain-object metadata capture cannot live alongside action exports.
 *
 * `lib/actions/auth.ts` (and its sibling action files: `email.ts`, `reset.ts`)
 * carry the `"use server"` directive and export ONLY async action functions;
 * every shared primitive — `ClientMeta`, `ActionErrorCode`, `ActionState`,
 * `captureClientMeta`, `verifyOrigin`, `audit` — is re-imported from here.
 *
 * Route handlers (e.g. `app/api/verify/route.ts`) also import directly from
 * this module to avoid crossing the `"use server"` boundary.
 */

export type ActionErrorCode =
  | "invalid_input"
  | "weak_password"
  | "pwned_password"
  | "email_taken"
  | "invalid_credentials"
  | "rate_limited"
  | "forbidden_origin"
  | "locked"
  | "server_error"
  | "email_send_failed"
  | "token_invalid"
  | "token_expired"
  | "already_verified";

export type ActionState = { error?: ActionErrorCode; ok?: boolean };

/**
 * Request-scoped client metadata captured once at the entry point of every
 * server action, BEFORE any `await` that could tear down the Next.js
 * AsyncLocalStorage request scope (notably `connectDB()` against a slow or
 * unreachable Mongo host). Downstream helpers (`audit`, `rateLimit`,
 * `verifyOrigin`) receive this object explicitly and never re-enter the
 * request headers API themselves — that's the whole point of the pattern.
 */
export type ClientMeta = {
  readonly ip: string;
  readonly ua: string;
  readonly origin: string;
};

/* ─────────────────────────────
   Security helpers
   ───────────────────────────── */

/**
 * Read the request headers exactly once, synchronously at action entry, and
 * freeze the values into a plain object. This is the ONLY function in this
 * module that touches `next/headers`. Every other helper takes a `ClientMeta`
 * parameter so the async tail of an action never re-enters AsyncLocalStorage.
 */
export const captureClientMeta = async (): Promise<ClientMeta> => {
  const h = await headers();
  return {
    ip:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      "unknown",
    ua: h.get("user-agent")?.slice(0, 256) ?? "unknown",
    origin: h.get("origin") ?? "",
  };
};

/**
 * Reject requests whose Origin header doesn't match our app URL. Works in
 * concert with SameSite=Strict cookies to kill CSRF for server actions.
 */
export const verifyOrigin = (origin: string): boolean => {
  if (!origin) return false;
  try {
    const appUrl = new URL(env.NEXT_PUBLIC_APP_URL);
    const reqUrl = new URL(origin);
    return appUrl.host === reqUrl.host;
  } catch {
    return false;
  }
};

/**
 * Pure audit sink. Takes the pre-captured `ClientMeta` as its first argument
 * and never touches the Next.js request headers API. Must never throw —
 * audit failures are swallowed so they can't cascade into the auth flow.
 */
export const audit = async (
  meta: ClientMeta,
  event: string,
  outcome: "ok" | "deny" | "error",
  payload: Record<string, unknown>,
  userId?: string,
): Promise<void> => {
  try {
    await AuditModel.create({
      event,
      outcome,
      ip: meta.ip,
      ua: meta.ua,
      meta: payload,
      userId: userId ?? null,
    });
  } catch {
    // Audit failures must never break the auth flow
  }
};
