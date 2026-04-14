/**
 * Public surface of lib/infra/resend. Domain action files import from here.
 * Internal surfaces (getMailClient, raw templates, Resend SDK) stay module-local.
 */
export {
  sendVerifyEmail,
  sendResetPasswordEmail,
  sendWelcomeEmail,
  type SendKind,
  type SendOutcome,
} from "./send";
