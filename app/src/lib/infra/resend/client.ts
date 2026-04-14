import "server-only";
import { Resend } from "resend";
import type { ReactElement } from "react";
import { env } from "@/lib/env";

export type SendInput = {
  readonly to: string;
  readonly subject: string;
  readonly react: ReactElement;
};

export type SendResult = { readonly id: string };

export type MailClient = {
  readonly send: (input: SendInput) => Promise<SendResult>;
};

/**
 * Dev stub — used when RESEND_API_KEY is absent OR NODE_ENV is
 * development. Never throws, never contacts Resend, logs a single
 * line to stdout with a partial-email redaction and returns a fake
 * id. This is the ONLY code path in the entire project allowed to
 * skip the audit/send contract — the action layer will still write
 * the audit event on top of the fake id so local dev matches prod
 * audit cardinality.
 */
const devStub: MailClient = {
  send: async ({ to, subject }) => {
    // eslint-disable-next-line no-console
    console.log(`[resend:dev] to=${to.slice(0, 4)}*** subject="${subject}"`);
    return { id: `dev-${Date.now()}` };
  },
};

/**
 * Returns the active MailClient — dev stub in development or when
 * RESEND_API_KEY is unset, real Resend-backed client in production.
 *
 * Domain layers NEVER call this function directly. Plan 02-04's
 * lib/infra/resend/send.ts owns the narrow, audited wrappers that
 * domain actions will import.
 */
export const getMailClient = (): MailClient => {
  if (!env.RESEND_API_KEY || env.NODE_ENV === "development") return devStub;

  const client = new Resend(env.RESEND_API_KEY);

  return {
    send: async ({ to, subject, react }) => {
      const { data, error } = await client.emails.send({
        from: env.RESEND_FROM_ADDRESS,
        to,
        subject,
        react,
      });
      if (error || !data) {
        throw new Error(
          `resend_send_failed: ${error?.message ?? "unknown"}`,
        );
      }
      return { id: data.id };
    },
  };
};
