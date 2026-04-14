/**
 * Vendor SDK boundary re-exports land here. Phase 2 adds Resend; Phase 3 adds Google;
 * Phase 4 adds Paddle. See ./README.md for the boundary contract.
 */
export {
  sendVerifyEmail,
  sendResetPasswordEmail,
  sendWelcomeEmail,
  type SendKind,
  type SendOutcome,
} from "./resend";
