> **Email OTP migration (Nov 16, 2026):** This file documents the older password-only phase. New admin access requires a server-verified six-digit email code and Worker-signed Firebase custom token. See [admin-email-otp-setup.md](./admin-email-otp-setup.md) for the current authoritative deployment procedure. Do **not** publish the new Firestore rules without also configuring OTP delivery and signing; otherwise admin access will be blocked.

# ToolsCresta admin: Gmail + password (single-owner)

The /admin page now uses Firebase **Email/Password** sign-in rather than Google OAuth popups.
Only the verified Firebase owner account using the password sign-in method may
access the administration UI and protected Firestore content. No public signup
route is provided. The password is handled by Firebase Authentication and is
**not** stored in GitHub, Firestore, or a Cloudflare variable.

## Important account setup before enabling the new login

1. In [Firebase Console](https://console.firebase.google.com/) choose project
   `gen-lang-client-0295520231`. Confirm this is the intended project for
   ToolsCresta: the app's `firebase-applet-config.json` currently references it.
2. Open **Authentication → Sign-in method** and enable **Email/Password**.
   The separate Email-link option is NOT required.
3. Open **Authentication → Users** and locate the single authorized Gmail
   account, `moaviah760@gmail.com`. Use a **different, unique password** from
   the Gmail account password. Never enter the actual Google/Gmail password into
   the ToolsCresta admin login.
   - If that Firebase user does **not** exist, a project owner may create
     an Email/Password user in Firebase Console → Authentication → Users.
   - If the same email **already exists as Google-only**, DO NOT delete/re-create
     the user because existing UID associations may matter. Instead link an
     Email/Password credential to the existing Firebase account, as described in
     the [official Firebase linking guide](https://firebase.google.com/docs/auth/web/account-linking),
     or have an authorized administrator set the password for that **existing UID**
     securely with Firebase Admin SDK `updateUser` on a trusted machine.
     The Firebase Admin SDK is **not** for deployment to the website.
   - If the user is not email verified, the admin login has a **Send verification
     email** and **Refresh verification** flow.
4. Ensure `toolscresta.com` is under Firebase Authentication → Settings →
   **Authorized domains**.
5. Firebase Security Rules protect actual admin data and are REQUIRED even when
   the admin UI is hidden. ToolsCresta currently uses **a named Firestore
   database**, NOT `(default)`:
   - Project: `gen-lang-client-0295520231`
   - Database: `ai-studio-ranknova-c6bc0a00-49ea-4084-aede-e1345d18a608`
   - Source file: `firestore.rules`

   **CAUTION:** The database name suggests it may be shared with another
   project. Confirm ownership and audit any other application that relies on
   this database BEFORE deploying restrictive rules. Do not overwrite a shared
   ruleset without comparing current production rules to the repository file.

6. After reviewing those live rules, deploy to the **correct named database**
   (the repository's `firebase.json` references only that database) from
   a trusted local machine logged into the authorized Firebase project:

   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules --project gen-lang-client-0295520231
   ```

   This can overwrite existing rules for the named database. Confirm exact
   target database and diff before executing. Deploying the website to
   Cloudflare alone does NOT deploy Firestore Security Rules.
7. Deploy the updated ToolsCresta frontend to its production site and check
   `https://toolscresta.com/admin/`.

## Security details

- The admin UI accepts the configured owner's Gmail address + a **Firebase**
  password only. An existing Google OAuth browser session is signed out.
- Sessions are browser-session scoped; closing the browser ends the session.
- The owner must have `email_verified=true` and a token with
  `firebase.sign_in_provider == "password"`.
- Firestore Rules independently require both conditions and exactly the
  owner email. Old `admins/{uid}` documents can no longer grant additional
  privileges.
- Public tool pages, published blog reading, and public contact-message
  submissions are not changed by this auth migration.
- Email enumeration protection and tighter Identity Toolkit sign-in endpoint
  quotas should be configured in Firebase/Google Cloud. Firebase provides
  built-in abuse protection, but client-side checks alone do not stop
  brute-force attempts.
- Cloudflare `/api/admin/status` currently exposes *configuration status
  only*, not protected Firebase data. Any future admin write APIs must verify
  Firebase ID tokens server-side; a hidden button is not authentication.

## Acceptance checks

1. Verify the owner Gmail + correct Firebase password can sign in.
2. Verify an **unverified** email cannot view admin data.
3. Verify another Gmail account cannot access /admin or protected Firestore.
4. Verify an old Google OAuth session is forced back to the password form.
5. Verify wrong password returns a generic message and does not sign in.
6. Verify Forgot Password sends a reset link to the owner and does not reveal
   account existence to other users.
7. Verify logging out removes access, including on browser refresh.
8. Test admin message and CMS reads with Firestore Security Rules *live*.

## References

- https://firebase.google.com/docs/auth/web/password-auth
- https://firebase.google.com/docs/auth/web/account-linking
- https://firebase.google.com/docs/auth/admin/manage-users
- https://firebase.google.com/docs/rules/manage-deploy
- https://firebase.google.com/support/guides/security-checklist
