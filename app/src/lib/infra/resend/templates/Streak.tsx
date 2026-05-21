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
} from "@react-email/components";
import type { ReactElement } from "react";

export type StreakProps = {
  readonly displayName: string;
  readonly daysCompleted: number; // 3 at minimum — variable for future longer streaks
  readonly nextDay: number; // the day they should hit next (1..14)
  readonly nextDayUrl: string;
  readonly upgradeUrl: string;
  readonly tier: "free" | "pro";
  readonly unsubscribeUrl: string;
};

const styles = {
  body: {
    backgroundColor: "#0a0a0b",
    color: "#f4f4f6",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  container: { maxWidth: "520px", margin: "0 auto", padding: "40px 24px" },
  heading: {
    fontSize: "26px",
    fontWeight: 900,
    letterSpacing: "-0.02em",
    margin: "0 0 16px",
  },
  text: {
    fontSize: "15px",
    lineHeight: 1.7,
    color: "#8b8c94",
    margin: "0 0 20px",
  },
  metric: {
    margin: "24px 0",
    padding: "20px",
    border: "1px solid #1d1d22",
    borderRadius: "12px",
    backgroundColor: "#111114",
  },
  metricNumber: {
    fontSize: "42px",
    fontWeight: 900,
    color: "#bef264",
    margin: "0 0 4px",
    letterSpacing: "-0.02em",
  },
  metricLabel: {
    fontSize: "11px",
    color: "#5a5b62",
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
  },
  button: {
    backgroundColor: "#bef264",
    color: "#0a0a0b",
    padding: "14px 28px",
    borderRadius: "10px",
    fontWeight: 700,
    textDecoration: "none",
    fontSize: "13px",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
  },
  hr: { borderColor: "rgba(255,255,255,0.08)", margin: "32px 0" },
  footer: { fontSize: "11px", color: "#5a5b62", lineHeight: 1.6 },
  link: { color: "#8b8c94", textDecoration: "underline" },
  upgrade: {
    fontSize: "13px",
    color: "#a1a1aa",
    margin: "16px 0 0",
    lineHeight: 1.6,
  },
} as const;

export const Streak = ({
  displayName,
  daysCompleted,
  nextDay,
  nextDayUrl,
  upgradeUrl,
  tier,
  unsubscribeUrl,
}: StreakProps): ReactElement => (
  <Html>
    <Head />
    <Preview>{`${daysCompleted} days down. The momentum compounds from here.`}</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Heading style={styles.heading}>
          {displayName ? `${displayName} — three down.` : "Three down."}
        </Heading>
        <Text style={styles.text}>
          You&apos;ve cleared the first {daysCompleted} days of the sprint.
          That&apos;s the hard part — most people drop off in the first 48
          hours. The rest is momentum.
        </Text>
        <Section style={styles.metric}>
          <p style={styles.metricNumber}>{`${daysCompleted} / 14`}</p>
          <p style={styles.metricLabel}>days complete · streak active</p>
        </Section>
        <Text style={styles.text}>
          Day {String(nextDay).padStart(2, "0")} is queued. Keep the rhythm
          — 30 focused minutes a day, the lab in another tab, no slide deck.
        </Text>
        <Section style={{ margin: "28px 0" }}>
          <Button href={nextDayUrl} style={styles.button}>
            Open Day {String(nextDay).padStart(2, "0")} &rarr;
          </Button>
        </Section>
        {tier === "free" && (
          <Text style={styles.upgrade}>
            You&apos;re on the free tier — Days 1-3 are unlocked. Day 4+ and
            the full Day-14 exam simulator unlock at $30/mo, no card to
            start the trial.{" "}
            <a href={upgradeUrl} style={styles.link}>
              Continue with Pro &rarr;
            </a>
          </Text>
        )}
        <Hr style={styles.hr} />
        <Text style={styles.footer}>
          You&apos;re receiving this because you completed Day 3.{" "}
          <a href={unsubscribeUrl} style={styles.link}>
            Stop these emails
          </a>
          .
        </Text>
      </Container>
    </Body>
  </Html>
);
