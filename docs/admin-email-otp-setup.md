# ToolsCresta owner admin: Gmail/password -> one-time email code -> dashboard

**Status: implementation committed, NOT yet activated on production.**
This is a mandatory second step and a Firestore access control, not a
cosmetic email-code dialog. No fake OTP or client-only bypass is permitted.

## How it works

1. Owner `moaviah760@gmail.com` signs in using existing verified Firebase
   Email/Password credentials; no other Firebase UID/email may start OTP.
2. ToolsCresta's same-origin Cloudflare Worker checks the **Google-signed
   Firebase password ID token**, correct Firebase project, owner email,
   verified email, password sign-in provider and a fresh authentication time.
3. It generates a cryptographically random **six-digit code**, emails it to
   the owner, stores only a server-secret HMAC digest in a **SQLite-backed
   Durable Object** for five minutes and applies 60-second resend cooldown,
   at most five sends per hour, five failures and a 15-minute lockout.
4. A correct, unused code is consumed exactly once. The Worker then signs
   a **Firebase custom token for the existing UID**, with
   `toolscresta_otp: true`.
5. Frontend calls `signInWithCustomToken`; Firestore rules permit admin
   reads and writes ONLY to the verified owner with
   `firebase.sign_in_provider == 'custom'` and
   `toolscresta_otp == true`. A password-only session has NO admin rights.
6. Firebase browser-session persistence is used, so the admin signs in again
   after the browser session ends. Never store passwords or OTP in localStorage.

Firebase's built-in MFA supports SMS/TOTP second factors, **not an email-code
second factor**, so this is a custom server-verified flow. Do not confuse
Firebase's email-verification link or password reset with login OTP.

## Production activation prerequisites

**Do not replace production Firestore rules yet.** Before any deployment,
confirm all these requirements are fulfilled:

### A. Configure email delivery on a verified ToolsCresta domain

1. In [Resend](https://resend.com/) create an account (can begin with its free
   tier, subject to its current limits). Verify your sending domain
   `toolscresta.com` or an appropriate sending subdomain in Resend using the
   DNS records they provide. Use a sender address on that verified domain,
   e.g. `security@toolscresta.com`. Do not change existing MX records for
   your personal/incoming mail unless instructed by your actual mail host.
2. Create a **Sending access** Resend API key. Keep it off GitHub and out
   of browser or chat messages. The Worker sends OTP only to the owner;
   it does not accept user-provided email recipients.
3. In Cloudflare Workers & Pages → `toolscresta` → Settings →
   **Runtime variables and secrets** (Production), add:
   - `RESEND_API_KEY` as **Secret**.
   - `OTP_FROM_EMAIL` as **Text**: `security@toolscresta.com`
     (change to exactly your verified sending address).
   - `OTP_HASH_SECRET` as **Secret**, an unpredictable random value with
     at least 32 characters. Generate outside ChatGPT, e.g. local:
     `openssl rand -base64 48`. Do not expose or reuse passwords.
4. Check domain verification and a successful transactional test from Resend.

### B. Firebase custom token signing key

This implementation signs a Firebase custom token **only after** verifying
the password session and the email OTP. The Worker needs a dedicated Google
service account for Firebase project `gen-lang-client-0295520231`. Key
storage is security-sensitive: if compromised, a service account signing key
can mint login tokens without the OTP. Prefer the smallest IAM privileges,
a dedicated account, rotate it and keep it **only in Worker Runtime Secrets**.

If your organization allows service-account key creation, obtain a dedicated
service account's `client_email` and PEM `private_key` securely from Google
Cloud IAM; never upload its JSON to GitHub or paste keys into chat. Configure:

- `FIREBASE_SERVICE_ACCOUNT_EMAIL`: **Secret** or variable (email of the
  dedicated Google service account, e.g. `name@project.iam.gserviceaccount.com`).
- `FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY`: **Secret** (complete PEM private key,
  keeping line breaks or escaped `\\n`).

If Google Cloud blocks private-key creation by policy, **do not bypass that
policy**. Use a Google-managed signing service with Workload Identity/IAM
instead of deploying a key, and adapt the signing implementation before
activation. Never put an admin key in client-side Vite environment variables.

### C. Durable Object binding and Worker deployment

The repository's `wrangler.production.toml` declares:

```toml
[[durable_objects.bindings]]
name = "ADMIN_OTP"
class_name = "AdminOtpState"

[[migrations]]
tag = "toolscresta-admin-otp-v1"
new_sqlite_classes = ["AdminOtpState"]
```

The Worker exports `AdminOtpState`. New Durable Object namespaces must
use SQLite; this is compatible with Workers Free. Run the source and
security tests before deployment:

```sh
npm ci
npm run lint
npm test
npm run test:api
npm run build:production
npx wrangler deploy --config wrangler.production.toml
```

If any test/build fails, **do not deploy**. Deploy this Worker only after its
Runtime Secrets exist. Check status:
`https://toolscresta.com/api/admin/otp/status` should return
`{"success":true,"configured":true}`. It must never return secrets.

### D. Firestore rules: prepare the cutover safely

The new repository `firestore.rules` requires:

```text
request.auth.token.email == 'moaviah760@gmail.com'
request.auth.token.email_verified == true
request.auth.token.firebase.sign_in_provider == 'custom'
request.auth.token.toolscresta_otp == true
```

This is a SECURITY-CRITICAL difference from previous password-only rules.
After verifying the Worker is configured and sender email can be delivered:

1. Back up the presently active Ruleset in Google Cloud Firestore → Security
   for named database `ai-studio-ranknova-c6bc0a00-49ea-4084-aede-e1345d18a608`.
2. Confirm other apps are not relying on its old rules. This named database
   exists in the **apps** project but might still be shared.
3. Validate new `firestore.rules` in the emulator/Rules Simulator.
4. **Publish the new rules** to the correct named database, not default.
5. Deploy the updated frontend and test immediately. Publishing new rules
   before the Worker is functional temporarily prevents admin access.
6. If tests fail, restore the previous ruleset only as a controlled incident
   response; never intentionally leave sensitive admin reads open.

## Acceptance checklist: MUST pass before calling live

- [ ] Password-only admin Firebase token receives **permission denied** for
      `contact_messages` reads.
- [ ] A Google OAuth token and any other Firebase user cannot access admin data.
- [ ] Admin password success automatically triggers one OTP email to the
      authorized Gmail. Wrong password cannot trigger an email.
- [ ] 6-digit OTP arrives, is valid for no more than 5 minutes.
- [ ] Wrong OTP rejected; fifth wrong attempt locks the challenge.
- [ ] Reusing an OTP after success fails; resend is rate-limited.
- [ ] Correct OTP switches Firebase to a verified custom-token session **for
      the existing owner UID** and permits the admin inbox.
- [ ] Browser sign-out and subsequent new login require a NEW code.
- [ ] The Firebase project, named Firestore DB, contact form, PDF tools,
      analytics and public pages continue working unchanged.
- [ ] No service account private key, password, email OTP, JWT or email provider
      key appears in logs, source code, analytics, or user-visible errors.

### Notes

- Email OTP proves control of the *same inbox* as the owner account; an
  authenticator app or passkey is stronger against email-account compromise.
- A Firebase custom-token session remains valid until the user signs out,
  its refresh token is revoked, or the configured browser session ends.
- This implementation assumes the original Gmail account has a verified
  email and an existing Firebase password (already enabled by the owner).
- Setup is not automatic: credentials and Firestore rules require privileged
  user action in Firebase, Cloudflare and the email service.

Official references:
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
- https://firebase.google.com/docs/auth/admin/create-custom-tokens
- https://developers.cloudflare.com/durable-objects/
- https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/
