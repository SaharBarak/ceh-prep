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

export type NewsletterConfirmProps = {
  readonly confirmUrl: string;
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

export const NewsletterConfirm = ({
  confirmUrl,
}: NewsletterConfirmProps): ReactElement => (
  <Html>
    <Head />
    <Preview>Confirm your CEH Prep newsletter subscription</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Heading style={styles.heading}>Confirm the subscription.</Heading>
        <Text style={styles.text}>
          You&apos;re one click from joining the CEH Prep newsletter &mdash;
          a roughly-weekly digest of practitioner writeups, new bonus repos,
          and what we shipped. No fluff, no upsell, no &ldquo;hot off the
          press&rdquo; manipulation.
        </Text>
        <Section style={{ margin: "28px 0" }}>
          <Button href={confirmUrl} style={styles.button}>
            Confirm &amp; subscribe &rarr;
          </Button>
        </Section>
        <Hr style={styles.hr} />
        <Text style={styles.footer}>
          If you didn&apos;t request this, ignore the email. We won&apos;t
          send anything else unless you click the button.
        </Text>
      </Container>
    </Body>
  </Html>
);
