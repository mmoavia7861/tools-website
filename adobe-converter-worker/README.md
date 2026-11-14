# RankNova Adobe PDF Services conversion gateway

This Cloudflare Worker runs Adobe's official REST flow to convert **PDF → DOCX** and **DOCX → PDF**. The source is stored in GitHub; the live Worker (separate from GitHub Pages) hosts the API. It never embeds Adobe Client ID or Client Secret in the website.

## Current state

- Source and tests: GitHub `mmoavia7861/tools-website/adobe-converter-worker`.
- Deployment entrypoint: GitHub `mmoavia7861/RankNova/.github/workflows/deploy-adobe-converter.yml`.
- The Adobe credentials you created are stored as encrypted GitHub Actions Secrets: `ADOBE_CLIENT_ID` and `ADOBE_CLIENT_SECRET`.
- **Important: credentials alone do not deploy a server.** Worker runtime deployment also needs Cloudflare API token/account ID and a Turnstile widget secret.
- Without the live URL, RankNova keeps its pre-existing *basic browser conversion*; do not tell visitors Adobe is already active.

## Secure GitHub Actions activation

1. Open [RankNova GitHub Secrets](https://github.com/mmoavia7861/RankNova/settings/secrets/actions). Add encrypted repository secrets if not yet added:
   - `ADOBE_CLIENT_ID`, `ADOBE_CLIENT_SECRET` (you already supplied these to GitHub; do not send them in chat).
   - `CLOUDFLARE_API_TOKEN` (restricted to Workers Script Edit for your account; create at [Cloudflare Tokens](https://dash.cloudflare.com/profile/api-tokens)).
   - `CLOUDFLARE_ACCOUNT_ID` (find your Cloudflare Account ID from its dashboard).
   - `TURNSTILE_SECRET` ([Cloudflare Turnstile](https://dash.cloudflare.com/), create widget authorized for `mmoavia7861.github.io`).
2. Run [Deploy RankNova Adobe Converter Backend](https://github.com/mmoavia7861/RankNova/actions/workflows/deploy-adobe-converter.yml) → **Run workflow**. The workflow runs isolated tests, validates secret presence and deploys to Cloudflare.
3. After success, copy the **actual** workers.dev HTTPS origin displayed in the run summary. Check `<origin>/health` returns `status:"ok",adobeConfigured:true`.
4. Set these **PUBLIC GitHub Actions Variables** at [RankNova Actions Variables](https://github.com/mmoavia7861/RankNova/settings/variables/actions):
   - `RANKNOVA_CONVERTER_API_URL`: exact worker origin, e.g. `https://<your-actual-worker>.workers.dev` (no trailing API path).
   - `RANKNOVA_TURNSTILE_SITE_KEY`: public site key from the SAME Cloudflare Turnstile widget. Do NOT put the secret here.
5. Re-run [Deploy RankNova Frontend](https://github.com/mmoavia7861/RankNova/actions/workflows/deploy-pages.yml).
6. Open [PDF to Word](https://mmoavia7861.github.io/RankNova/pdf-to-word/) or [Word to PDF](https://mmoavia7861.github.io/RankNova/word-to-pdf/), choose **Adobe cloud conversion**, check the third-party upload notice, complete Turnstile, then upload a small document and test the output.

## How the API actually works

Browser `POST /api/convert/pdf-to-word` or `POST /api/convert/word-to-pdf` with multipart form fields `file` and `turnstileToken` → Worker validates file, anti-bot token, rate limit and credentials → server fetches Adobe token, registers an asset, uploads to Adobe's signed storage URL, starts `exportpdf` or `createpdf` job, polls completion, downloads and validates the document, and streams the result back with a `no-store` response. It does not save uploaded files in GitHub or a persistent Worker database.

Request limits: 10 MB input, 24 MB output, 4 jobs/minute per client IP and Cloudflare colo (approximate, not a hard global quota), 24 polling attempts. Adobe API free-tier and usage quotas apply. Browser times out after around 120 seconds.

## Security and privacy

- **Do not paste API keys into React source or GitHub files**, even private files. Use encrypted Actions Secrets only.
- Files are **sent to Adobe** for processing. The website must clearly disclose this in its privacy policy and before Adobe conversion. File processing and retention follow Adobe's terms; the Worker does not retain files.
- Use narrow Cloudflare API token permissions, Turnstile, rate limiting, size caps, exact `Origin` validation, strict signed Adobe storage hostname allowlist and no caching. Monitor usage and abuse. CORS alone is not authentication.
- Worker requests fail closed when credentials, rate limiting or Turnstile are unavailable. Adobe requests and credentials are never logged. Adobe OCR and exact fidelity are not guaranteed.
- Any future custom domain requires updates to `APP_ORIGIN`, Turnstile allowed hostname and worker redeployment, followed by a frontend rebuild.

## Official Adobe REST documentation
- [Authentication and asset upload](https://developer.adobe.com/document-services/docs/overview/pdf-services-api/gettingstarted/)
- [PDF to Word](https://developer.adobe.com/document-services/docs/overview/pdf-services-api/howtos/export-pdf)
- [Word to PDF](https://developer.adobe.com/document-services/docs/overview/pdf-services-api/howtos/create-pdf)

## Run tests locally
```sh
node --test adobe-converter-worker/worker.test.mjs
```
