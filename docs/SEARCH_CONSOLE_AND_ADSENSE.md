# RankNova tools-website: launch checklist (Google Search & AdSense)

Current published site: https://mmoavia7861.github.io/tools-website/

## Ready in the codebase
- Actual published content for About, Contact, Privacy Policy, Terms of Service, Acceptable Use and Copyright.
- Client-side QR, PDF and image utility pages and educational blog pages.
- Sitemap and page-specific static HTML + canonical tags generated for this exact GitHub Pages project URL.
- The build publishes files such as /tools-website/privacy-policy/index.html, so these routes return HTTP 200 (rather than an SPA 404 fallback).
- A Contact form **only confirms success if Firebase Firestore successfully saves the message**.
- Advertising is disabled until monetization, consent requirements and Google publisher policies are addressed.

## Google Search Console: owner action required
1. Visit https://search.google.com/search-console/
2. Choose **URL prefix** and enter: https://mmoavia7861.github.io/tools-website/
3. Verify ownership using a method Google offers that works for your hosting (for example, a verification HTML file in the site build). If Google offers only a method you cannot complete on GitHub Pages, set up a verified custom domain and use its Domain property. Never share your login credentials or verification tokens publicly in chat.
4. Open **Sitemaps** and submit: https://mmoavia7861.github.io/tools-website/sitemap.xml
5. Use **URL Inspection** on your home page, About and core tools. Google chooses whether and when to crawl/index; submitting a sitemap or pressing Request Indexing does not guarantee or expedite it in 24 hours.
6. Check the **Pages** report for indexed pages, redirect issues, canonical conflicts and crawling errors. Make sure public pages return HTTP 200 with unique titles, helpful content and ordinary anchor links.

The project-specific /tools-website/robots.txt is published as a convenience but isn't equivalent to owning github.io's root-level robots.txt. Search Console's sitemap submission is the reliable method for this project URL.

## Before applying for AdSense
- There is **no official fixed requirement of 5-10 tools or a guaranteed 1-4 week approval window**. Google emphasizes original, helpful content, navigation, an accessible website and policy compliance.
- Check each advertised tool with real input files on mobile and desktop, and remove/deactivate unfinished or broken features.
- Review and finalize legal content for the actual business/contact details and jurisdictions with professional advice if necessary; never copy generic policies wholesale or make promises your code cannot support.
- Ensure ad placements are distinguishable from download buttons and not misleading. Keep ads off until the account is accepted and requirements can be met.
- If serving personalized ads to users in regions requiring consent, implement an appropriate certified consent management platform before enabling ads.
- AdSense requires that you can insert verification/ad code into your actual website HTML. GitHub Pages build publishes the generated HTML for this repository, but account signup and verification are actions the owner must perform.
- Search Console indexing and AdSense approval are separate processes. Indexing alone does not approve monetization.

## Reference
- https://support.google.com/adsense/answer/7299563
- https://support.google.com/adsense/answer/9724
- https://support.google.com/adsense/answer/1348695
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
