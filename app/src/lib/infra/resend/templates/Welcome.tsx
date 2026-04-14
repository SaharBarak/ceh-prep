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

export type WelcomeProps = {
  readonly displayName: string;
  readonly dashboardUrl: string;
};

const styles = {
  body: {
    backgroundColor: "#0a0a0b",
    color: "#f4f4f6",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  container: { maxWidth: "520px", margin: "0 auto", padding: "40px 24px" },
  heading: {
    fontSize: "28px",
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
} as const;

export const Welcome = ({
  displayName,
  dashboardUrl,
}: WelcomeProps): ReactElement => (
  <Html>
    <Head />
    <Preview>Welcome to CEH Sprint &mdash; Day 01 is ready</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Heading style={styles.heading}>
          {displayName ? `Welcome, ${displayName}.` : "Welcome."}
        </Heading>
        <Text style={styles.text}>
          Your email is verified. Day 01 &mdash; Reconnaissance &mdash; is
          waiting. Thirty focused minutes a day for fourteen days, and
          you&apos;ll walk into the CEH exam ready.
        </Text>
        <Section style={{ margin: "28px 0" }}>
          <Button href={dashboardUrl} style={styles.button}>
            Start Day 01 &rarr;
          </Button>
        </Section>
        <Hr style={styles.hr} />
        <Text style={styles.footer}>
          Days 1-3 are free. Days 4-14 + the exam simulator unlock at $30/mo.
          No beta pricing, no dark patterns.
        </Text>
      </Container>
    </Body>
  </Html>
);
