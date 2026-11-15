# ToolsCresta Gemini + Adobe PDF Services activation

Production domain: https://toolscresta.com
Cloudflare Worker: `toolscresta` (same-origin /api routes)
GitHub: `mmoavia7861/tools-website`

## Already implemented in source code

- `worker/api.mjs`: Gemini Assistant POST /api/assistant/chat and Gemini Card Design POST /api/cards/generate.
- Adobe PDF Services conversion POST /api/convert/pdf-to-word and POST /api/convert/word-to-pdf.
- GET /api/integrations/status returns `gemini`, `adobe`, `turnstile` booleans. **These only mean bindings exist, not that keys or quotas have been tested.**
- `wrangler.production.toml` invokes the Worker for /api/* and retains static assets for all other requests.
- The existing UI only enables Gemini or Adobe when a public Turnstile sitekey is configured and /api/integrations/status reports the required secrets are present.
- On-device tools continue to work with no API credentials.

## Step 1 — Get credentials from the official providers

1. Google AI Studio: https://aistudio.google.com/api-keys. Create a Gemini API key in the correct Google Cloud project, enable any required billing/quota for your usage.
2. Adobe PDF Services: https://developer.adobe.com/document-services/ . Create a **PDF Services API** project/credential; copy its **Client ID** and **Client Secret**. An ordinary Acrobat subscription is not necessarily an API credential. Review trial limits and paid usage.
3. Cloudflare dashboard > Turnstile > Add widget: name `ToolsCresta Production`, hostname `toolscresta.com`, widget mode Managed. Copy the public **Site Key** and private **Secret Key**.

## Step 2 — Store secrets in Cloudflare Worker (runtime)

Workers & Pages > `toolscresta` > Settings > Variables and Secrets > Add.
Add each item using Type **Secret**, then Deploy the new version:

| Exact variable name | Value |
| --- | --- |
| `GEMINI_API_KEY` | Gemini API key |
| `ADOBE_CLIENT_ID` | Adobe PDF Services client ID |
| `ADOBE_CLIENT_SECRET` | Adobe PDF Services client secret |
| `TURNSTILE_SECRET` | Cloudflare Turnstile secret key |

**Never** paste these four values into GitHub files, an issue, a screenshot, the browser JavaScript console, or a chat. Rotate any value accidentally disclosed.

## Step 3 — Public sitekey as a BUILD variable

Workers & Pages > `toolscresta` > Settings > Build > Environment variables (menu labels may vary), add:

- Name: `VITE_TURNSTILE_SITE_KEY`
- Value: the **public** sitekey from the Turnstile widget. This is not a secret.

The frontend uses same-origin `/api/*` endpoints by default, so **no extra API hostname, domain, or DNS record is needed**. Don't set `VITE_AI_CARD_API_URL` or `VITE_CONVERTER_API_URL` unless an intentionally separate HTTPS backend is deployed.

## Step 4 — Deploy and verify

Retain these GitHub-linked Cloudflare commands:

- Build: `bun run build:production`
- Deploy: `npx wrangler deploy --config wrangler.production.toml`

After entering the build variable, redeploy the latest `main` commit.

Visit https://toolscresta.com/api/integrations/status . It should return JSON:

`{"success":true,"gemini":true,"adobe":true,"turnstile":true}`

The booleans indicate only that the bindings are set. Next, test real requests:

1. Open the homepage assistant, complete Turnstile, ask one question. Check reply really comes from Gemini, not the on-device guide.
2. Generate one AI card. Verify the generated fields are editable and do not invent contact details.
3. Test a small, non-sensitive PDF to DOCX and a small DOCX to PDF. Confirm output file signature, text/layout quality, and Adobe quota usage.

Expected failure behavior: missing credentials return 503, invalid Turnstile 403, provider limits 429; errors must be displayed honestly, never fake a converted document or generated AI answer.

## Security & billing

- Turnstile Siteverify runs in the Worker; a browser widget by itself is insufficient.
- Production requests are same-origin; secrets never enter the published Vite bundle.
- A per-isolate in-memory throttle is only best-effort. Before taking public traffic, configure a Cloudflare zone-level **rate limiting** rule for `/api/*` using the Security Rules interface, and check Gemini and Adobe provider budgets/quotas. Avoid challenging unrelated SEO or tool routes.
- Adobe conversion uploads a user-approved document to Adobe. It is **not** on-device conversion. Never promise unconditional data deletion from Adobe; their storage/retention policy applies.
- No Adobe OCR, PDF editing, or Adobe PDF compression integration is claimed here. Adobe routes are only PDF ↔ DOCX conversion.
- This Worker waits up to 90 seconds for Adobe; longer jobs may need a durable queue/polling architecture. Test in the Cloudflare Worker runtime first.
- The secure API is not operational until the credentials, public sitekey, deployment and live requests are verified.

## Developer smoke test

`npm run test:api`

See official documentation: https://developers.cloudflare.com/workers/configuration/secrets/ , https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ , https://developer.adobe.com/document-services/docs/overview/pdf-services-api/gettingstarted , https://ai.google.dev/gemini-api/docs/generate-content/text-generation
