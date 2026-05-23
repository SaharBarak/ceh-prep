import { Types } from "mongoose";
import { UserModel } from "@/lib/db/models/user";
import { ProgressModel } from "@/lib/db/models/progress";
import { EmailDispatchModel } from "@/lib/db/models/email-dispatch";
import { NewsletterSubscriberModel } from "@/lib/db/models/newsletter";
import { AuditModel } from "@/lib/db/models/audit";

/**
 * Pure builder for the GDPR-export JSON archive.
 *
 * Lives in `lib/` (not `app/api/`) so vitest can call it directly with a
 * mongodb-memory-server-backed Mongoose without needing to spin up the
 * full Next.js route layer (cookies, headers, ALS scope).
 *
 * Shape contract — this is the wire-format frozen for the export
 * endpoint. Vitest in `export-builder.test.ts` asserts every field is
 * present + the correct type. Extend by adding new fields; never rename
 * or remove without a SCHEMA_VERSION bump.
 */

export const SCHEMA_VERSION = 1;

export type AccountExportArchive = {
  schemaVersion: number;
  exportedAt: string;
  account: {
    id: string;
    email: string;
    displayName: string;
    tier: string;
    role: string;
    createdAt: string | null;
    lastLoginAt: string | null;
    emailVerifiedAt: string | null;
    googleSub: string | null;
    paddleCustomerId: string | null;
    marketingOptOut: boolean;
    marketingNudgeOptOut: boolean;
    timezone: string;
    completedDays: number[];
    completedDrills: string[];
    lastActiveAt: string | null;
  };
  progress: ReadonlyArray<{
    day: number;
    correctCount: number;
    completedAt: string | null;
    updatedAt: string | null;
    answers: Record<string, number>;
  }>;
  emailDispatches: ReadonlyArray<{
    kind: string;
    day: number | null;
    articleSlug: string | null;
    sentAt: string | null;
    outcome: string;
  }>;
  newsletter: {
    source: string | null;
    status: string | null;
    confirmedAt: string | null;
    unsubscribedAt: string | null;
    createdAt: string | null;
  } | null;
  audit: ReadonlyArray<{
    at: string | null;
    event: string;
    outcome: string;
    ip: string;
    ua: string;
    meta: Record<string, unknown>;
  }>;
};

export const buildAccountExport = async (
  userId: string,
): Promise<AccountExportArchive | null> => {
  if (!Types.ObjectId.isValid(userId)) return null;
  const userOid = new Types.ObjectId(userId);

  const [user, progress, dispatches, auditRows] = await Promise.all([
    UserModel.findOne({ _id: { $eq: userOid } })
      .select(
        "_id email displayName tier role createdAt lastLoginAt emailVerifiedAt googleSub paddleCustomerId marketingOptOut marketingNudgeOptOut timezone completedDays completedDrills lastActiveAt",
      )
      .lean<{
        _id: Types.ObjectId;
        email: string;
        displayName?: string;
        tier?: string;
        role?: string;
        createdAt?: Date;
        lastLoginAt?: Date | null;
        emailVerifiedAt?: Date | null;
        googleSub?: string | null;
        paddleCustomerId?: string | null;
        marketingOptOut?: boolean;
        marketingNudgeOptOut?: boolean;
        timezone?: string;
        completedDays?: number[];
        completedDrills?: string[];
        lastActiveAt?: Date;
      } | null>(),
    ProgressModel.find({ userId })
      .select("day correctCount completedAt updatedAt answers")
      .lean(),
    EmailDispatchModel.find({ userId })
      .select("kind day articleSlug sentAt outcome")
      .lean(),
    AuditModel.find({ userId: userOid })
      .select("at event outcome ip ua meta")
      .lean(),
  ]);

  if (!user) return null;

  const newsletter = await NewsletterSubscriberModel.findOne({
    email: user.email,
  })
    .select("source status confirmedAt unsubscribedAt createdAt")
    .lean<{
      source?: string;
      status?: string;
      confirmedAt?: Date | null;
      unsubscribedAt?: Date | null;
      createdAt?: Date;
    } | null>();

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    account: {
      id: user._id.toString(),
      email: user.email,
      displayName: user.displayName ?? "",
      tier: user.tier ?? "free",
      role: user.role ?? "user",
      createdAt: user.createdAt?.toISOString() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      googleSub: user.googleSub ?? null,
      paddleCustomerId: user.paddleCustomerId ?? null,
      marketingOptOut: user.marketingOptOut ?? false,
      marketingNudgeOptOut: user.marketingNudgeOptOut ?? false,
      timezone: user.timezone ?? "UTC",
      completedDays: user.completedDays ?? [],
      completedDrills: user.completedDrills ?? [],
      lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    },
    progress: progress.map((p) => ({
      day: p.day,
      correctCount: p.correctCount ?? 0,
      completedAt: p.completedAt ? new Date(p.completedAt).toISOString() : null,
      updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : null,
      answers: serializeAnswers(p.answers),
    })),
    emailDispatches: dispatches.map((d) => ({
      kind: d.kind,
      day: d.day ?? null,
      articleSlug: d.articleSlug ?? null,
      sentAt: d.sentAt ? new Date(d.sentAt).toISOString() : null,
      outcome: d.outcome,
    })),
    newsletter: newsletter
      ? {
          source: newsletter.source ?? null,
          status: newsletter.status ?? null,
          confirmedAt: newsletter.confirmedAt?.toISOString() ?? null,
          unsubscribedAt: newsletter.unsubscribedAt?.toISOString() ?? null,
          createdAt: newsletter.createdAt?.toISOString() ?? null,
        }
      : null,
    audit: auditRows.map((a) => ({
      at: a.at ? new Date(a.at).toISOString() : null,
      event: a.event,
      outcome: a.outcome,
      ip: a.ip ?? "",
      ua: a.ua ?? "",
      meta: (a.meta ?? {}) as Record<string, unknown>,
    })),
  };
};

const serializeAnswers = (raw: unknown): Record<string, number> => {
  if (!raw) return {};
  if (raw instanceof Map) {
    return Object.fromEntries(raw.entries()) as Record<string, number>;
  }
  if (typeof raw === "object") {
    return raw as Record<string, number>;
  }
  return {};
};
