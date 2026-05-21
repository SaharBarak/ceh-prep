import { z } from "zod";

/**
 * Env is validated at boot. App refuses to start on missing or weak secrets.
 * Never reference process.env directly outside this file.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGO_URI: z
    .string()
    .min(1)
    .default("memory://")
    .refine(
      (v) =>
        v.startsWith("memory://") ||
        v.startsWith("mongodb://") ||
        v.startsWith("mongodb+srv://"),
      { message: "MONGO_URI must be memory://, mongodb://, or mongodb+srv://" },
    ),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters")
    .refine(
      (s) => s !== "change-me-to-a-real-48-byte-random-string-before-running",
      "SESSION_SECRET must be changed from the example value",
    ),
  SESSION_COOKIE_NAME: z.string().default("ceh_session"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  // ── Resend (Phase 2) ───────────────────────────────────
  // API key is optional in dev (stubbed console log path) but required in prod.
  // FROM address default uses localhost; the refinement blocks that default
  // from ever shipping to production.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_ADDRESS: z
    .string()
    .default("CEH Sprint <no-reply@localhost>")
    .refine(
      (v) => process.env.NODE_ENV !== "production" || !v.includes("localhost"),
      "RESEND_FROM_ADDRESS must be a real verified sender in production",
    ),
  // ── Email Engagement (Phase 10 + 11) ───────────────────
  // CRON_SECRET gates the /api/cron/* routes — Vercel Cron sets this
  // header on every invocation. Without it, the routes 401 silently.
  // 32+ chars to make brute-force pointless; production requires a
  // non-default value, dev gets a fixed placeholder.
  CRON_SECRET: z
    .string()
    .min(16, "CRON_SECRET must be at least 16 characters")
    .default("dev-cron-secret-do-not-use-in-prod")
    .refine(
      (v) =>
        process.env.NODE_ENV !== "production" ||
        v !== "dev-cron-secret-do-not-use-in-prod",
      "CRON_SECRET must be set in production",
    ),
  // Marketing-unsubscribe token signing key. Separate from SESSION_SECRET
  // so unsub links survive session-secret rotation.
  UNSUB_SECRET: z
    .string()
    .min(16, "UNSUB_SECRET must be at least 16 characters")
    .default("dev-unsub-secret-do-not-use-in-prod"),

  // ── Analytics (GA4) ────────────────────────────────────
  // Public — embedded in client bundles. Falsy disables tracking entirely
  // (CI / preview builds run without it). Format: G-XXXXXXXXXX.
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: z
    .string()
    .regex(/^G-[A-Z0-9]+$/, "Must look like G-XXXXXXXX")
    .optional(),

  // ── Newsletter (Phase 11.5 — separate from product drip) ──
  // Resend Audience ID for the public marketing list. If unset the newsletter
  // form persists subscribers to Mongo only; with this set we sync to Resend
  // for broadcast campaigns. Format: aud_xxxxxxxx-xxxx-... (Resend UUID).
  RESEND_AUDIENCE_ID: z.string().optional(),

  // ── Billing (Phase 4 — Paddle) ──────────────────────────
  // Three secrets. All optional in dev — pricing page falls back to the
  // honest "billing rolls out with Phase 4" state when any is missing.
  // Production refinement: if any one is set, all three must be set
  // (partial Paddle config is worse than none — it produces dead checkouts).
  PADDLE_API_KEY: z.string().optional(),
  PADDLE_WEBHOOK_SECRET: z.string().optional(),
  PADDLE_PRO_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: z.string().optional(),
  NEXT_PUBLIC_PADDLE_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
}).superRefine((env, ctx) => {
  const paddleKeys = [
    env.PADDLE_API_KEY,
    env.PADDLE_WEBHOOK_SECRET,
    env.PADDLE_PRO_PRICE_ID,
    env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
  ];
  const anySet = paddleKeys.some(Boolean);
  const allSet = paddleKeys.every(Boolean);
  if (anySet && !allSet) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Paddle config is partial — set all four (PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET, PADDLE_PRO_PRICE_ID, NEXT_PUBLIC_PADDLE_CLIENT_TOKEN) or none.",
      path: ["PADDLE_API_KEY"],
    });
  }
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  MONGO_URI: process.env.MONGO_URI,
  SESSION_SECRET: process.env.SESSION_SECRET,
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_ADDRESS: process.env.RESEND_FROM_ADDRESS,
  CRON_SECRET: process.env.CRON_SECRET,
  UNSUB_SECRET: process.env.UNSUB_SECRET,
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
  RESEND_AUDIENCE_ID: process.env.RESEND_AUDIENCE_ID,
  PADDLE_API_KEY: process.env.PADDLE_API_KEY,
  PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET,
  PADDLE_PRO_PRICE_ID: process.env.PADDLE_PRO_PRICE_ID,
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
  NEXT_PUBLIC_PADDLE_ENV: process.env.NEXT_PUBLIC_PADDLE_ENV,
});

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed");
}

export const env: Env = parsed.data;
