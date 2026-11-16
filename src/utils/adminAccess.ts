/** ToolsCresta owner-only admin authorization.
 * This UI guard is NOT the security boundary: Firestore Security Rules must
 * require a Worker-issued toolscresta_otp custom claim too.
 */
export const OWNER_EMAIL = 'moaviah760@gmail.com';

export function isOwnerOtpSession(
  email: string | null | undefined,
  emailVerified: boolean,
  signInProvider: string | null | undefined,
  otpClaim: unknown
): boolean {
  return typeof email === 'string' &&
    email.toLowerCase() === OWNER_EMAIL &&
    emailVerified === true &&
    signInProvider === 'custom' &&
    otpClaim === true;
}
