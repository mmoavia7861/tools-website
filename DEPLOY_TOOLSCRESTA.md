# ToolsCresta production domain setup

Production hostname: https://toolscresta.com. Repository: mmoavia7861/tools-website.

The existing GitHub Pages site and toolcresta-preview Cloudflare Worker stay unchanged. This is a separate production configuration.

1. Add toolscresta.com to Cloudflare. Copy the exact two assigned Cloudflare nameservers; do not guess them.
2. In Spaceship, verify the new domain is active. Record and preserve any mail-related DNS records. Go to Advanced DNS > Nameservers > Change > Custom nameservers; enter the Cloudflare-assigned hosts and save.
3. When Cloudflare marks the zone Active, install dependencies, then run: npm run build:production. Check dist/index.html, dist/sitemap.xml, dist/robots.txt and some dist/<route>/index.html files. All published canonical URLs should use https://toolscresta.com/ without a /tools-website/ prefix.
4. Deploy with: npx wrangler deploy --config wrangler.production.toml. Run under your own authorized Cloudflare account. Do not deploy before the custom domain is ready.
5. Configure www.toolscresta.com to redirect to https://toolscresta.com with a Cloudflare proxied DNS record and Redirect Rule. The production Worker is attached to the bare hostname only.
6. Verify HTTPS, homepage, PDF editor, background remover, QR generator, card generator, AI assistant (if backend configured), legal pages, admin access, mobile experience, sitemap and robots. Then add https://toolscresta.com to Search Console and submit the sitemap.

Committing these files does not change DNS or deploy to Cloudflare. Do not modify GitHub Pages or its current live URLs until the production domain is tested.
