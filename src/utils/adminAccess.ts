/** ToolsCresta admin access policy.
 * This UI-side check is a usability guard, NOT the security boundary.
 * Firestore rules must independently enforce the same verified owner email
 * and Firebase password sign-in provider.
 */
export const OWNER_EMAIL = 'moaviah760@gmail.com';

export function isOwnerPasswordSession(
  email: string | null | undefined,
  emailVerified: boolean,
  signInProvider: string | null | undefined
): boolean {
  return typeof email === 'string' &&
    email.toLowerCase() === OWNER_EMAIL &&
    emailVerified === true &&
    signInProvider === 'password';
}
