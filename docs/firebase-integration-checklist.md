# ToolsCresta Firebase deployment and verification

Status: repository client code, admin inbox, and Firestore rules have been updated.
**No live Firebase Authentication configuration, database migration, or
Security Rules deployment was performed by these GitHub commits.**

## 1. Verify the intended Firebase project and database

The currently checked-in `firebase-applet-config.json` points at:

- Firebase project: `gen-lang-client-0295520231`
- Firestore database: `ai-studio-ranknova-c6bc0a00-49ea-4084-aede-e1345d18a608`

This is a **named** Firestore database (not `(default)`). Its name resembles
another project. Before changing or deleting it, confirm whether RankNova or
other apps share it. Do not create a new database ID, change the project ID,
or run bulk data migration without explicitly reviewing existing data.

Open [Firebase Console](https://console.firebase.google.com/) and select the
project ID above. In Firestore Database choose the named database and review
its **Data** and **Rules** tabs. If the project does not appear in your console,
the website may be connected to a different account-owned project; obtain
authorized access rather than copying credentials from elsewhere.

## 2. Enable the authorized admin

- Authentication → Sign-in method → Email/Password: **Enable**.
- Authentication → Settings → Authorized domains: include `toolscresta.com`.
- Authentication → Users: locate the authorized owner's existing Firebase
  account. If it already exists as Google-only, link Email/Password or
  securely set a password on the same existing UID. **Do not recreate/delete
  the existing UID**, or copy your actual Gmail password into the website.
- Confirm the Firebase owner email is verified. The admin dashboard only
  accepts a verified email with sign-in provider `password`.

## 3. Protect the real Firestore data

The GitHub `firestore.rules` file enforces:
- Owner-only reads of private `contact_messages` and writes to their status.
- Visitors can only create inquiries with the expected six fields.
- Old `admins/{uid}` documents do not grant admin access.
- Blog/public content rules remain as separately defined.

**The production Firestore rules may differ from GitHub.** Read and back up
the live rules first. If this database is shared with RankNova, review all
apps that will be affected. Firebase rules are not deployed when the website
or Cloudflare Worker is built.

Only after comparing and testing the rules, an authorized operator can run
from the repository root:

```sh
npx firebase-tools login
npx firebase-tools firestore:databases:list --project gen-lang-client-0295520231
npx firebase-tools deploy --only firestore:rules --project gen-lang-client-0295520231
```

The repository `firebase.json` specifically targets the named Firestore
database. These commands use the Firebase project, not the Cloudflare project.
Rules deployment **replaces** the rules for the configured database; it is not
safe without reviewing the existing rules first.

## 4. Deploy the frontend independently

Once Firebase setup is correct, publish the latest React build to the existing
ToolsCresta hosting origin. Do not add Firebase private keys or the admin
password to GitHub or Cloudflare frontend variables.

## 5. End-to-end acceptance checklist

1. On `/admin/`, authorized owner Gmail + Firebase password logs in.
2. Admin overview shows **Firebase Firestore: Connected** (a read-only
   connection probe on the configured database).
3. Public `/contact/` test form genuinely saves an inquiry. Avoid using
   real personal data for tests.
4. Admin → **Contact Inbox** lists the new message and allows **Mark read**
   and **Resolve**.
5. Unauthorized visitors cannot list/read contacts; other Firebase users
   cannot perform admin writes.
6. Firebase wrong password, offline access, and denied permission failures
   produce meaningful error notices without revealing credentials.
7. Sign out and refresh: private inbox must not remain visible.
8. Validate rules with Firebase Emulator or Rules Playground before publishing
   security-rule changes.

## Operational follow-up

- Enable Firebase App Check and/or server-side anti-spam validation for public
  contact submissions when supported by your hosting setup; a browser-only
  honeypot does **not** prevent automated direct Firestore writes.
- Review the public-read `admin_settings` and `site_content` collections
  before placing private information in them. Never store secrets there; use
  restricted server-side Cloudflare/Firebase secrets instead.
- The Blog CMS remains read-only; publishing Firestore blog posts requires
  a separately designed public reader and SEO/SSR route handling.
- Source-code checks do not prove the live Firebase project is accessible.

Official docs:
- https://firebase.google.com/docs/auth/web/password-auth
- https://firebase.google.com/docs/firestore/manage-databases
- https://firebase.google.com/docs/rules/manage-deploy
- https://firebase.google.com/docs/firestore/security/test-rules-emulator
