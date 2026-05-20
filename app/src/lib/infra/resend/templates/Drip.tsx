import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
  Section,
  Link as EmailLink,
} from "@react-email/components";
import type { ReactElement } from "react";
import type { Day } from "@/lib/content";

/**
 * Daily drip email template.
 *
 * Two variants:
 *   variant="standard" — the Day-N email for every day the recipient has
 *                        unlocked. Shows the day blurb + a sample question
 *                        (random pick from day.quiz) + "Open Day N" CTA.
 *   variant="upsell"   — the Day-4 email for free-tier users. Replaces the
 *                        sample question with a Pro-tier value pitch +
 *                        upgrade CTA. The recipient already saw Days 1-3;
 *                        this is the conversion moment.
 *
 * Both variants share the same shell + footer (one-click unsub link in
 * the header `List-Unsubscribe` headers is set by send.ts, the visible
 * unsub line at the bottom is rendered here).
 */

export type DripProps = {
  readonly variant: "standard" | "upsell";
  readonly day: Day;
  readonly dayLink: string;
  readonly unsubscribeUrl: string;
  /** Optional sample question — derived deterministically from `day` upstream so retries are stable. */
  readonly sampleQuestion?: { readonly q: string; readonly choices: readonly string[] };
};

const styles = {
  body: {
    backgroundColor: "#0a0a0c",
    color: "#f4f4f5",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    margin: 0,
    padding: 0,
  } as const,
  container: {
    margin: "0 auto",
    padding: "40px 24px",
    maxWidth: "600px",
  } as const,
  monoTag: {
    color: "#52525b",
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
    fontSize: "11px",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    margin: "0 0 16px",
  } as const,
  h1: {
    color: "#f4f4f5",
    fontSize: "32px",
    lineHeight: "1.1",
    margin: "0 0 16px",
    fontWeight: 700,
  } as const,
  accent: { color: "#bef264" } as const,
  body_text: {
    color: "#a1a1aa",
    fontSize: "15px",
    lineHeight: 1.6,
    margin: "0 0 16px",
  } as const,
  card: {
    backgroundColor: "#111114",
    border: "1px solid #1d1d22",
    borderRadius: "12px",
    padding: "24px",
    margin: "24px 0",
  } as const,
  cardLabel: {
    color: "#52525b",
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
    fontSize: "10px",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    margin: "0 0 12px",
  } as const,
  cardQ: {
    color: "#f4f4f5",
    fontSize: "15px",
    lineHeight: 1.5,
    margin: "0 0 16px",
  } as const,
  choice: {
    color: "#a1a1aa",
    fontSize: "14px",
    margin: "4px 0",
  } as const,
  cta: {
    backgroundColor: "#bef264",
    color: "#0a0a0c",
    padding: "12px 24px",
    borderRadius: "999px",
    textDecoration: "none",
    fontWeight: 500,
    display: "inline-block",
  } as const,
  hr: { borderColor: "#1d1d22", margin: "32px 0" } as const,
  footer: {
    color: "#52525b",
    fontSize: "11px",
    lineHeight: 1.6,
  } as const,
  footerLink: { color: "#a1a1aa", textDecoration: "underline" } as const,
};

export const Drip = (props: DripProps): ReactElement => {
  const { variant, day, dayLink, unsubscribeUrl, sampleQuestion } = props;
  const isUpsell = variant === "upsell";
  const preview = isUpsell
    ? `Day 4: where Pro picks up. ${day.title}.`
    : `Day ${String(day.n).padStart(2, "0")} of your CEH sprint: ${day.title}.`;

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.monoTag}>
            CEH v13 · Day {String(day.n).padStart(2, "0")} of 14
            {isUpsell ? " · Pro preview" : ""}
          </Text>

          {isUpsell ? (
            <>
              <Heading style={styles.h1}>
                You finished the <span style={styles.accent}>free run</span>.
                <br />
                Day 4 is where Pro starts.
              </Heading>
              <Text style={styles.body_text}>
                Days 1-3 covered the foundations. Day 4 ({day.title}) and the
                10 days after it are Pro-tier: the full curriculum, the graded
                WebVM drills, the 16-article bonus library, and the
                125-question timed exam simulator.
              </Text>
              <Section style={styles.card}>
                <Text style={styles.cardLabel}>// what unlocks today</Text>
                <Text style={styles.cardQ}>
                  Day {String(day.n).padStart(2, "0")}: <strong>{day.title}</strong>
                </Text>
                <Text style={styles.choice}>· {day.blurb}</Text>
              </Section>
              <Button href={`${dayLink.split("/course/")[0]}/pricing?from=drip-day${day.n}`} style={styles.cta}>
                Unlock Pro · $30/mo →
              </Button>
              <Text
                style={{ ...styles.body_text, marginTop: "16px", fontSize: "13px" }}
              >
                Or{" "}
                <EmailLink href={dayLink} style={styles.footerLink}>
                  open Day {day.n} read-only
                </EmailLink>{" "}
                — the lesson HTML stays free; quiz + lab are Pro.
              </Text>
            </>
          ) : (
            <>
              <Heading style={styles.h1}>
                Day {String(day.n).padStart(2, "0")}:{" "}
                <span style={styles.accent}>{day.title}</span>
              </Heading>
              <Text style={styles.body_text}>{day.blurb}</Text>
              {sampleQuestion && (
                <Section style={styles.card}>
                  <Text style={styles.cardLabel}>// a question from today</Text>
                  <Text style={styles.cardQ}>{sampleQuestion.q}</Text>
                  {sampleQuestion.choices.map((choice, i) => (
                    <Text key={i} style={styles.choice}>
                      {String.fromCharCode(65 + i)}. {choice}
                    </Text>
                  ))}
                </Section>
              )}
              <Button href={dayLink} style={styles.cta}>
                Open Day {day.n} →
              </Button>
            </>
          )}

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            You&apos;re getting this because you signed up for the CEH Sprint
            curriculum drip — one email per day for 14 days. Not transactional.
            <br />
            <br />
            <EmailLink href={unsubscribeUrl} style={styles.footerLink}>
              Unsubscribe from marketing email
            </EmailLink>
            . Transactional email (verify, password reset) will still reach you.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};
