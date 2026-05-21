import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

/**
 * Resend Audience contact upsert / delete.
 *
 * Dev / no-key path is a no-op that returns null contactId — the
 * NewsletterSubscriber row still lands in Mongo so the list is
 * recoverable on first key-set. Production with RESEND_API_KEY +
 * RESEND_AUDIENCE_ID both present routes through to Resend.
 *
 * Failures are intentionally swallowed (returning null). The subscriber
 * record is the source of truth; an audience sync failure should not
 * block the user-facing flow. A future reconciler job can backfill.
 */

type ContactResult = { contactId: string | null };

const isEnabled = (): boolean =>
  Boolean(env.RESEND_API_KEY && env.RESEND_AUDIENCE_ID);

export const upsertAudienceContact = async (
  email: string,
): Promise<ContactResult> => {
  if (!isEnabled()) return { contactId: null };

  const client = new Resend(env.RESEND_API_KEY);
  try {
    const { data, error } = await client.contacts.create({
      email,
      audienceId: env.RESEND_AUDIENCE_ID!,
      unsubscribed: false,
    });
    if (error || !data) {
      // 422 from Resend usually means "already exists" — that's fine
      // for upsert semantics. Real failures (auth, network) also land
      // here and we just don't sync.
      // eslint-disable-next-line no-console
      console.warn(`[newsletter:audience] upsert failed: ${error?.message ?? "unknown"}`);
      return { contactId: null };
    }
    return { contactId: data.id };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[newsletter:audience] upsert threw: ${err instanceof Error ? err.message : String(err)}`);
    return { contactId: null };
  }
};

export const removeAudienceContact = async (
  email: string,
): Promise<void> => {
  if (!isEnabled()) return;

  const client = new Resend(env.RESEND_API_KEY);
  try {
    // Resend uses contact-by-email under audience scope. Soft-remove
    // = mark unsubscribed (true). Hard-delete is reserved for GDPR.
    await client.contacts.update({
      email,
      audienceId: env.RESEND_AUDIENCE_ID!,
      unsubscribed: true,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[newsletter:audience] remove threw: ${err instanceof Error ? err.message : String(err)}`);
  }
};
