import { describe, it, expect } from "vitest";
import {
  signNewsletterToken,
  verifyNewsletterToken,
} from "./newsletter-token";

describe("newsletter-token", () => {
  const email = "alice@example.com";

  it("round-trips a confirm token", () => {
    const token = signNewsletterToken("confirm", email);
    expect(verifyNewsletterToken("confirm", token)).toBe(email);
  });

  it("round-trips an unsubscribe token", () => {
    const token = signNewsletterToken("unsubscribe", email);
    expect(verifyNewsletterToken("unsubscribe", token)).toBe(email);
  });

  it("normalizes email to lowercase on signing", () => {
    const t = signNewsletterToken("confirm", "ALICE@Example.COM");
    expect(verifyNewsletterToken("confirm", t)).toBe(email);
  });

  it("rejects cross-purpose token reuse — confirm token can't drive unsubscribe", () => {
    const t = signNewsletterToken("confirm", email);
    expect(verifyNewsletterToken("unsubscribe", t)).toBeNull();
  });

  it("rejects cross-purpose the other direction", () => {
    const t = signNewsletterToken("unsubscribe", email);
    expect(verifyNewsletterToken("confirm", t)).toBeNull();
  });

  it("rejects a tampered MAC", () => {
    const t = signNewsletterToken("confirm", email);
    const [data] = t.split(".");
    const bad = `${data}.AAAAAAAAAAAAAAAAAAAAAA`;
    expect(verifyNewsletterToken("confirm", bad)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyNewsletterToken("confirm", "")).toBeNull();
    expect(verifyNewsletterToken("confirm", "no-dot")).toBeNull();
    expect(verifyNewsletterToken("confirm", "..")).toBeNull();
  });

  it("rejects a token with a swapped email", () => {
    const t = signNewsletterToken("confirm", email);
    const [, mac] = t.split(".");
    const otherData = Buffer.from("confirm:bob@example.com").toString(
      "base64url",
    );
    expect(verifyNewsletterToken("confirm", `${otherData}.${mac}`)).toBeNull();
  });
});
