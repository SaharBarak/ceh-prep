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

export type ResetPasswordProps = { readonly link: string };

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
  linkText: { color: "#bef264", wordBreak: "break-all" as const },
} as const;

export const ResetPassword = ({
  link,
}: ResetPasswordProps): ReactElement => (
  <Html>
    <Head />
    <Preview>Reset your CEH Sprint password</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Heading style={styles.heading}>Reset your password.</Heading>
        <Text style={styles.text}>
          Click the link below to set a new password. This link expires in 1
          hour and can only be used once.
        </Text>
        <Section style={{ margin: "28px 0" }}>
          <Button href={link} style={styles.button}>
            Reset password &rarr;
          </Button>
        </Section>
        <Text style={styles.text}>
          Or paste this into your browser:
          <br />
          <span style={styles.linkText}>{link}</span>
        </Text>
        <Hr style={styles.hr} />
        <Text style={styles.footer}>
          Didn&apos;t request this? Ignore this email. Your password has not
          changed. If you see repeated reset emails you didn&apos;t request,
          check your account security.
        </Text>
      </Container>
    </Body>
  </Html>
);
