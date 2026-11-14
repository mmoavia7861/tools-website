# RankNova card AI gateway (Cloudflare Workers)

## 0. GitHub-only deployment control (recommended)

The backend **code is already committed to GitHub** in `mmoavia7861/tools-website/card-ai-worker`. Its production runtime is still a separate HTTPS Cloudflare Worker because GitHub Pages only serves static files.

You do **not** need to import/link a GitHub repository inside the Cloudflare dashboard. The *publishing* repository `mmoavia7861/RankNova` has a GitHub Actions workflow `.github/workflows/deploy-card-ai.yml` that checks out this code and deploys it using encrypted GitHub Actions secrets.

### A. Add four GitHub repository Secrets (not Variables or source files)

Open [RankNova GitHub Actions secrets](https://github.com/mmoavia7861/RankNova/settings/secrets/actions), then create:

| GitHub secret | Where to obtain |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) — create a restricted token allowed to create/manage this Worker |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account overview |
| `GEMINI_API_KEY` | [Google AI Studio API Keys](https://aistudio.google.com/api-keys) |
| `TURNSTILE_SECRET` | [Cloudflare Turnstile](https://dash.cloudflare.com/) — widget secret for `mmoavia7861.github.io` |

Keep all four values **private**. Add them using GitHub's encrypted Actions *Secrets* interface, **not repository files, issues, pull requests, chat messages, or public variables**.

### B. Run backend deployment from GitHub

Open [Deploy RankNova Gemini Card Backend](https://github.com/mmoavia7861/RankNova/actions/workflows/deploy-card-ai.yml), select **Run workflow**, and view its summary. It runs unit tests and publishes the backend with `cloudflare/wrangler-action@v4`; Gemini and Turnstile secrets are installed on the Worker, not exposed in the frontend.

You still need a Cloudflare account and a Turnstile widget. GitHub Actions handles deployment; it does not turn GitHub Pages into a backend server.

### C. Connect its public URL to the frontend

Open [RankNova Actions Variables](https://github.com/mmoavia7861/RankNova/settings/variables/actions) and create:

| GitHub variable | Value |
| --- | --- |
| `RANKNOVA_CARD_API_URL` | The real HTTPS `workers.dev` URL printed by successful backend deployment (no `/api/cards/generate` suffix) |
| `RANKNOVA_TURNSTILE_SITE_KEY` | The **public** Turnstile site key (not the secret) |

Then run [Deploy RankNova frontend to GitHub Pages](https://github.com/mmoavia7861/RankNova/actions/workflows/deploy-pages.yml). The public card pages will now show Turnstile and enable **Generate with Gemini** only after the API URL and site key exist.

### D. Verification

Visit `<your real Worker URL>/health` and verify `status: "ok"`, `aiConfigured: true`. Then complete Turnstile, generate a card, edit and download. Monitor Gemini quota and Worker requests.

**Current status:** The code and workflow can be committed without an API key, but live Gemini generation is **not activated** until the four private secrets and two public variables are configured and both deployments succeed.

---


This is a **separate optional Gemini backend** for /ai-card-generator/, /wedding-card-maker/, /birthday-card-maker/.
The React pages work for free in **local template mode** even without a backend. GitHub Pages cannot run server-side Gemini calls.

## Safety and limitations
- Never commit or place a Gemini API key in Vite, React, HTML, GitHub Pages, or screenshots.
- The Worker validates a Turnstile response server-side, validates the exact browser Origin, limits calls (approximate per Cloudflare location), caps prompt length and only returns allowlisted card data.
- Turnstile is not a globally strict quota, and Cloudflare's rate limiting is approximate per location. Gemini quotas are separate. Watch usage, set account caps and review logs. No key or secrets are saved by the frontend.
- A free Worker and an available Gemini free-tier model are **not guaranteed indefinitely**. Never promise unlimited generation.
- The worker has not been deployed until you run the Cloudflare commands with an account you control.

## 1. Cloudflare free setup
1. Create/login to Cloudflare, go to Workers & Pages. Use the free Workers plan; do not switch to paid.
2. Install Node.js >=22 locally. Clone this repository.
3. In this folder, run `npx wrangler login` then `npx wrangler deploy`.
4. In Cloudflare Turnstile dashboard create a managed widget for hostname `mmoavia7861.github.io`. Record PUBLIC sitekey and SECRET private key. Cloudflare Turnstile has free and paid plans.
5. In this folder set secrets using terminal prompts:
   ```sh
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put TURNSTILE_SECRET
   ```
   For Gemini key get your own from Google AI Studio; enable an available model (change `GEMINI_MODEL` in wrangler.toml as needed). **Never paste a key in ChatGPT or GitHub.**

## 2. Connect GitHub Pages
Cloudflare deploy returns https://ranknova-card-ai.<account>.workers.dev — use your **actual** URL, not this placeholder.
In the **RankNova deployment repository** (mmoavia7861/RankNova), set Repository Settings -> Secrets and variables -> Actions -> Variables:
- `RANKNOVA_CARD_API_URL` = the exact Worker HTTPS origin (without /api/cards/generate)
- `RANKNOVA_TURNSTILE_SITE_KEY` = Turnstile PUBLIC sitekey

Do NOT put the Gemini API key or Turnstile secret in GitHub Actions variables. These belong only in Cloudflare Worker secrets.
The RankNova deploy workflow maps variables to `VITE_AI_CARD_API_URL` and `VITE_TURNSTILE_SITE_KEY` during build.

## 3. Verify
- Browse `https://<actual-worker-host>/health` (should show `{"status":"ok","aiConfigured":true}` after secrets and rate limiter binding installed).
- Re-run the RankNova GitHub Pages workflow.
- In the new AI Card Generator UI, pass Turnstile, enter details and click **Generate with Gemini**.
- On API errors, the form displays a real error. **Create Free Template** continues to function locally. This is not an AI fallback.

## Development tests
Run from repository root: `node --test card-ai-worker/worker.test.mjs`.
