# ToolsCresta — Admin Control Center rollout

## What the owner can manage
- **Tool Manager**: enable/disable built-in tool routes, edit public tool labels and descriptions, reorder, feature, remove/re-add installed tools; add **unpublished drafts** for future development. A draft cannot execute tools or create arbitrary external URLs.
- **Website Content**: homepage headline, highlight, description, announcement. Saved as plain text; not executable HTML.
- **Blog CMS**: opt-in one-time migration of 3 built-in posts into Firestore, then create/edit/publish/unpublish articles, SEO title and description, and remove custom articles. Public feeds query only `published == true`.
- **Contact Inbox**: latest 100 visitor-submitted inquiries, filter/search, mark read or resolved, launch an explicit email reply, delete contact messages. Replies use the owner's email client; no claim of automatic sending.
- **Assistant questions**: chat stays private unless a visitor explicitly chooses **Send this question to ToolsCresta support**, reviews the prefilled Contact form and submits it. No passive logging of chats.
- **Ads / AI**: current tabs remain informational while provider approval and backend integration are separately configured. The dashboard cannot itself create new third-party API capabilities.

## Data storage
Firebase project `gen-lang-client-0295520231`. Use the **named Firestore database** from `firebase-applet-config.json`; never silently switch to `(default)`.
- `site_content/tool_catalog`: document with validated `items` (max 60) and `updatedAt`. If missing, compiled catalog of installed tools remains visible.
- `site_content/homepage`: plain-text hero content.
- `site_content/blog_state`: `{ managed: true, updatedAt }`, set **after** successful starter-post migration.
- `blog_posts/{id}`: individual editable published/draft posts.
- `contact_messages/{id}`: visitor-submitted support inquiries, admin-only reads.
- No API keys, passwords, Firebase service-account private keys or OTPs in any Firestore document.

## Security
- Only the authorized owner account after Firebase password + server-verified email OTP can access the admin controls.
- Firestore rules in repository require `request.auth.token.firebase.sign_in_provider == 'custom'` and `request.auth.token.toolscresta_otp == true` for admin writes.
- Owner authorization is checked in the database rules, **not** only in React UI.
- The site uses React escaped text for CMS values; never render CMS content with `dangerouslySetInnerHTML`.
- A tool disable/unlist hides its links and client-side page; it does **not** delete source code, remove a URL from a static sitemap, return HTTP 410 or guarantee immediate Google deindexing. Hard retirement requires a reviewed backend routing/sitemap update.
- This is **not** a replacement for Google Analytics, Search Console or email-provider dashboards. Google search queries require separately authorized Search Console reporting.

## Safe production activation
1. Confirm Cloudflare Worker has an **active** production deployment on `toolscresta.com`, not merely a Ready build.
2. Confirm Gmail/password + 6-digit OTP can open the existing Admin Dashboard; **do not lock yourself out** by publishing stricter rules first.
3. Deploy this repository's `firestore.rules` **to the existing named database**, after comparing with any live rules:
   - Firebase project: `gen-lang-client-0295520231`
   - Firestore database: `ai-studio-ranknova-c6bc0a00-49ea-4084-aede-e1345d18a608` (not `(default)`).
   - In Firebase Console, select the named database, open **Rules**, compare with `firestore.rules`, then **Publish**.
   - Alternatively, from the **repository root**, run `npx firebase-tools@latest login` once, then
     `npx firebase-tools@latest deploy --only firestore --project gen-lang-client-0295520231`.
     The repository's `firebase.json` targets **only this named database**. Verify the command output shows the rules released for that database.
   - **Do not rely only on `--only firestore:rules` for multi-database array configurations** without checking its output: some Firebase CLI versions have silently skipped rules deployment in that configuration.
   - Publishing CLI rules can overwrite rules previously edited in the Console. Inspect the live rules first; never replace them with `allow read, write: if true`.
   - Updating files in GitHub alone **never publishes Firestore rules**.
4. Reload Admin, select **Retest Firebase**. This now checks a public CMS read and an owner-only inbox read directly from Firestore servers. If it reports a permissions error, confirm the correct database's published rules and OTP custom claim before trying any writes.
5. Reload Admin, open Tool Manager, rename a low-risk installed tool, Save changes, and verify the public homepage/nav/footer update in a separate signed-out session. Revert the rename.
6. Temporarily hide a low-risk tool and verify its direct in-app route is unavailable. Restore it.
7. Edit homepage announcement and verify the public change.
8. Activate Blog CMS, confirm starter-post migration, save a draft, publish, then unpublish and confirm public visibility changes.
9. Submit a Contact test inquiry through the public form. Verify it appears in Admin Inbox; mark resolved then delete.
10. Check mobile/tablet layouts, TypeScript, tests, console errors, Cloudflare logs, security rules, page indexing and sitemap. The new CMS is client-rendered, not server-prerendered.

## Operational limits
- Cloudflare Worker code deployment, API keys, domain DNS, Firebase Authentication provider settings, Google AdSense approvals, server routing and new tool implementations still require developer/Cloudflare/Firebase actions.
- Large-scale visitor search analytics is not part of the support inbox.
- Cloudflare and Firebase availability matter; the static tool catalog can remain visible during Firestore outages, so an emergency hard-disable should also be deployed at the edge.
- Publishing from the admin controls is not confirmation of AdSense approval or production API capacity.
