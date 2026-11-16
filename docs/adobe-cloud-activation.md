# ToolsCresta Adobe cloud conversion — deployment checklist

The PDF to Word and Word to PDF pages have TWO independent modes:
- Free browser conversion (local, no Adobe account needed)
- Optional Adobe PDF Services cloud conversion (requires authenticated Adobe API credentials)

## Architecture

- Production UI: https://toolscresta.com/pdf-to-word/ and /word-to-pdf/
- Cloud API: same-origin https://toolscresta.com/api/convert/pdf-to-word and /api/convert/word-to-pdf
- Readiness endpoint: https://toolscresta.com/api/integrations/status
- Backend: worker/api.mjs deployed using the EXISTING wrangler.production.toml.
- Turnstile validation requires the hostname to be exactly toolscresta.com.
- Adobe OAuth Server-to-Server credentials authenticate at https://ims-na1.adobelogin.com/ims/token/v3 using grant_type=client_credentials and comma-separated scopes. The resulting bearer token is then used for Adobe PDF Services assets, operations, async polling, and signed upload/download URLs.

## Production activation

1. In Adobe Developer Console, create/inspect a PDF Services project that has permission to call Export PDF and Create PDF. Confirm that the Client ID and Client Secret belong to the same project. Adobe quotas and billing terms apply.
2. In Cloudflare Turnstile, create a widget for toolscresta.com. Keep the **Site Key** (PUBLIC) distinct from the **Secret Key** (PRIVATE). Also allow any alternate production hostname actually in use.
3. From a trusted developer machine with Wrangler authenticated, configure the following values as encrypted Worker runtime secrets (not in the repository or in VITE_* variables):

   `npx wrangler secret put ADOBE_CLIENT_ID --config wrangler.production.toml`

   `npx wrangler secret put ADOBE_CLIENT_SECRET --config wrangler.production.toml`

   `npx wrangler secret put TURNSTILE_SECRET --config wrangler.production.toml`

   `npx wrangler secret put TURNSTILE_SITE_KEY --config wrangler.production.toml`

   TURNSTILE_SITE_KEY is PUBLIC, but setting it as a Worker secret avoids a separate public build-time configuration. Never put TURNSTILE_SECRET into the Site Key field.
   If your Adobe Developer Console lists OAuth Server-to-Server scopes such as `openid,AdobeID,DCAPI,additional_info.projectedProductContext`, the Worker uses these by default. For a different credential scope set, configure optional `ADOBE_OAUTH_SCOPES` (comma-separated, *non-secret*) in Cloudflare. Never paste an access token into `ADOBE_CLIENT_SECRET`.
4. **Do not attach a competing Worker route.** Existing production Worker deployment/domain mapping must be checked before making Cloudflare routing changes.
   - If the site is already hosted on the production Worker, make sure its /api/* paths run worker/api.mjs.
   - If the site is still hosted externally, configure a proxied Cloudflare route for `toolscresta.com/api/*` to the appropriate Worker, without changing the public website's root routing.
   - Keep the preview Worker and existing working tools intact.
5. After reviewing existing deployment settings, build the app and deploy the existing Worker:

   `npm install`

   `npm run build:production`

   `npx wrangler deploy --config wrangler.production.toml`

   Ensure the current domain binding is preserved. Deploying the production Worker does not automatically attach or verify a domain.
6. Verify that `GET https://toolscresta.com/api/integrations/status` returns JSON with `adobe: true`, `turnstile: true`, and a nonempty **public** `turnstileSiteKey`. This response must not contain Adobe credentials or the Turnstile secret.
7. Test both directions with NON-SENSITIVE test files. Complete a fresh Turnstile verification for each conversion (tokens are single-use). Inspect real DOCX/PDF download headers and open the downloaded documents. Also test a bad file and a rejected token. Do not declare production healthy from mock API tests alone.

## Troubleshooting

- Adobe mode disabled: /api/integrations/status unavailable, returns HTML instead of JSON, or required runtime credentials/site key are missing.
- Verification 403: token expired/used, wrong Turnstile secret, or Turnstile widget hostname mismatch.
- Adobe IMS OAuth 400 now provides a SAFE classified error when Adobe returns `invalid_client`, `invalid_scope`, `invalid_request`, `unauthorized_client` or `invalid_grant`; raw Adobe response bodies and credentials are never shown.
  - `invalid_client`: click **Generate access token** in Adobe Developer Console. If Console succeeds but ToolsCresta fails, both Cloudflare runtime secrets must be replaced using the *same* Adobe OAuth Server-to-Server credential; a saved secret might be stale or a different application's secret.
  - `invalid_scope`: compare requested scopes with your credential's exact **Scopes** field and set optional Cloudflare variable `ADOBE_OAUTH_SCOPES` to that comma-separated list (e.g., `openid,AdobeID,DCAPI,additional_info.projectedProductContext`).
  - `invalid_request`: check grant_type, URL encoding, and Server-to-Server project type.
  - If Adobe only reports HTTP 400 without a recognized code, test Console's access-token generator and contact Adobe support with the *request correlation ID*, not your secret.
- Upload size: PDF to Word and Word to PDF accept input documents up to **50 MiB** in both browser and Adobe cloud modes. Adobe documents a 100 MB file-size limit and Cloudflare's standard Free/Pro zone upload limit is 100 MB; individual conversions can still fail due to browser memory, Workers Free 128 MB memory, quota, or document complexity.
- For 50 MiB Cloudflare uploads, the Worker inspects only the first 5 bytes and streams the File to Adobe S3 rather than copying the entire file again. This minimizes Worker memory duplication but does not remove the provider limits.
- Adobe 429: provider quota reached; cannot be bypassed by the frontend.
- Adobe upload/download 502: inspect Worker logs for status category and signed S3 host compatibility (do NOT log signed URLs or document contents).
- Cloudflare API calls 404: confirm the real domain routes /api/* to worker/api.mjs.
- Never replace Adobe output with mock data or misleading "conversion succeeded" UI.

References:
- https://developer.adobe.com/developer-console/docs/guides/authentication/ServerToServerAuthentication/ims
- https://developer.adobe.com/document-services/docs/overview/pdf-services-api/gettingstarted
- https://developer.adobe.com/document-services/docs/overview/pdf-services-api/howtos/export-pdf
- https://developer.adobe.com/document-services/docs/overview/pdf-services-api/howtos/create-pdf
