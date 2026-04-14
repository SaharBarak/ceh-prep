import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);

const password = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128, "Max 128 characters");

export const SignupSchema = z.object({
  email,
  password,
  displayName: z.string().trim().max(60).optional(),
});

export const LoginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const SaveAnswerSchema = z.object({
  day: z.coerce.number().int().min(1).max(14),
  questionIndex: z.coerce.number().int().min(0).max(199),
  choice: z.coerce.number().int().min(0).max(9),
});

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type SaveAnswerInput = z.infer<typeof SaveAnswerSchema>;

/**
 * Reset-request form input. One field, enumeration-safe.
 * Note: we do NOT fail fast on parse error — `requestPasswordReset`
 * returns a uniform-timing success regardless of whether parsing fails
 * (see 02-RESEARCH.md §4). The schema exists so we can safely project
 * the email string if it DOES parse.
 */
export const RequestResetSchema = z.object({
  email,
});

/**
 * Reset-confirm form input. Token is an opaque string (43 chars base64url
 * in practice, but we only enforce min/max to catch obvious garbage) and
 * password goes through zxcvbn + HIBP gates inside the action.
 */
export const ConfirmResetSchema = z.object({
  token: z.string().min(32).max(64),
  password,
});

/**
 * Resend-verification form input. Empty object — the user is derived from
 * the session (requireSession inside the action), no user-provided fields.
 * Schema exists for parity with the signup/login pattern and so the resend
 * action's `safeParse` produces a typed empty object.
 */
export const VerifyEmailSchema = z.object({});

export type RequestResetInput = z.infer<typeof RequestResetSchema>;
export type ConfirmResetInput = z.infer<typeof ConfirmResetSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
