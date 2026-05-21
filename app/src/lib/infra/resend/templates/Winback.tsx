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

export type WinbackProps = {
  readonly displayName: string;
  readonly lastDay: number; // 1..14 — where they left off
  readonly resumeUrl: string;
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
  daypill: {
    display: "inline-block",
    padding: "4px 10px",
    border: "1px solid #1d1d22",
    borderRadius: "999px",
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
    fontSize: "11px",
    color: "#bef264",
    letterSpacing: "0.08em",
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
} as const;

export const Winback = ({
  displayName,
  lastDay,
  resumeUrl,
  unsubscribeUrl,
}: WinbackProps): ReactElement => (
  <Html>
    <Head />
    <Preview>The sprint paused. Want to pick it back up?</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Heading style={styles.heading}>
          {displayName ? `Hey ${displayName} —` : "Hey —"}
        </Heading>
        <Text style={styles.text}>
          It&apos;s been about a week since you last opened CEH Prep. You
          stopped on <span style={styles.daypill}>Day {String(lastDay).padStart(2, "0")}</span>.
          The next module is queued and the WebVM keeps your shell session
          across reloads — so you can pick up exactly where you left it.
        </Text>
        <Text style={styles.text}>
          The 14-day sprint works when it stays a sprint. If life happened,
          no judgement — the curriculum doesn&apos;t expire and your progress
          is intact. One 30-minute window puts you back on track.
        </Text>
        <Section style={{ margin: "28px 0" }}>
          <Button href={resumeUrl} style={styles.button}>
            Resume Day {String(lastDay).padStart(2, "0")} &rarr;
          </Button>
        </Section>
        <Hr style={styles.hr} />
        <Text style={styles.footer}>
          You&apos;re receiving this because it&apos;s been roughly seven days
          since your last lesson view. We&apos;ll send at most two of these.{" "}
          <a href={unsubscribeUrl} style={styles.link}>
            Stop these emails
          </a>
          .
        </Text>
      </Container>
    </Body>
  </Html>
);
