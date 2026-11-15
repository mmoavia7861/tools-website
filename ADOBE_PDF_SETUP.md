# ToolsCresta — Activate Adobe PDF Services (PDF ↔ DOCX)

Website: https://toolscresta.com/
Backend: Cloudflare Worker `toolscresta` in `worker/api.mjs`.
This uses Adobe's official PDF Services REST API, **not** a personal Adobe Acrobat web account subscription.

## What is already implemented

- `POST /api/convert/pdf-to-word`: uploads a PDF to Adobe PDF Services, converts to DOCX and streams DOCX back.
- `POST /api/convert/word-to-pdf`: uploads a DOCX to Adobe PDF Services, converts to PDF and streams PDF back.
- `GET /api/integrations/status`: reports whether Adobe and Turnstile environment bindings **exist** (does not validate the credentials or quota).
- Adobe mode is optional in the PDF-to-Word and Word-to-PDF pages; browser conversion remains available.
- Client uploads are limited to 10 MB and checked by extension and file signature. Turnstile must pass server-side before upload to Adobe.
- Worker credentials never appear in client JavaScript.
- Rate-limited best-effort per isolate; configure Cloudflare zone-level rate limiting for `/api/convert/*` before significant public use.
- Adobe API is configured for US default region. Files are processed on Adobe's infrastructure; Adobe's own retention/security policies apply.

## Step 1 — Get Adobe PDF Services API credentials

1. Open https://developer.adobe.com/document-services/pricing/main .
2. In **Adobe Acrobat Services API > Free Tier**, choose **Start for free**.
3. Sign in with an Adobe ID, follow the **Adobe PDF Services API** credential creation wizard.
4. Copy **Client ID** and **Client Secret** (or retrieve them from the downloaded `pdfservices-api-credentials.json`).
5. Adobe currently advertises **500 free Document Transactions per month**, no credit card required. Beyond that, review the Adobe plan/quotas before increasing traffic.

Do not confuse Adobe PDF Embed API or Acrobat desktop subscriptions with PDF Services API developer credentials.

## Step 2 — Configure runtime secrets in Cloudflare

Cloudflare dashboard > **Workers & Pages > toolscresta > Settings > Variables and secrets > Runtime variables and secrets**.

Add as **Secret** (not plain-text Variable and not Build variable):

| Runtime secret | Paste from |
| --- | --- |
| `ADOBE_CLIENT_ID` | Adobe PDF Services API credential Client ID |
| `ADOBE_CLIENT_SECRET` | Adobe PDF Services API credential Client Secret |

The following existing integration must also remain:
- `TURNSTILE_SECRET` — private Turnstile Secret Key for the **same** ToolsCresta Production widget
- `VITE_TURNSTILE_SITE_KEY` — public Site Key in **Build** environment variables

Never share these secrets in screenshots, GitHub, chat, or browser JavaScript. If disclosed, rotate them with the provider.

## Step 3 — Deploy latest code

The production project uses:
- Build: `bun run build:production`
- Deploy: `npx wrangler deploy --config wrangler.production.toml`

The Worker serves `/api/*` and static site assets on the same domain. No second domain or DNS record is needed.

Check https://toolscresta.com/api/integrations/status in a private browser window. It should show `"adobe": true` and `"turnstile": true`, meaning variables exist **only**. It does not prove the credentials, quota, or conversion work.

## Step 4 — Test real conversion

1. Open https://toolscresta.com/pdf-to-word/ with a **small nonsensitive** PDF. Select **Adobe PDF Services cloud conversion**.
2. Complete Turnstile and click **Convert with Adobe & download**. Check the downloaded `.docx` opens and contains the expected content.
3. Open https://toolscresta.com/word-to-pdf/ with a **small nonsensitive** `.docx` and repeat. Confirm that the PDF opens correctly.
4. Review Adobe usage and quota in the developer account.

**Do not claim Adobe is live until the real conversions succeed.**
If either tool remains disabled, confirm latest Cloudflare deployment, runtime secrets and public Turnstile build sitekey.
If conversion errors, inspect the error label and Cloudflare Worker logs **without exposing secret values or uploaded documents**.

## Important constraints

- These Adobe credentials currently power **PDF to Word and Word to PDF**, not Adobe PDF editing, compression, or OCR independently. Browser PDF editor/compressor remain separate tools.
- The Free Worker external-subrequest cap is 50/request; code uses bounded polling every four seconds to avoid exceeding it.
- A single conversion can take up to roughly 90 seconds in the Worker. Longer jobs need asynchronous job polling or a durable queue.
- Uploaded documents leave the browser and are processed by Adobe with Adobe's retention/data policies; don't claim local-only processing.
- For public traffic, add Cloudflare WAF rate limiting and use provider usage/budget controls.
- Mock API tests: `npm run test:api`. Real Adobe conversion cannot be tested without valid runtime credentials.

Official sources:
- https://developer.adobe.com/document-services/docs/overview/pdf-services-api/gettingstarted
- https://developer.adobe.com/document-services/pricing/main
- https://developer.adobe.com/document-services/docs/overview/limits
- https://developers.cloudflare.com/workers/platform/limits/
