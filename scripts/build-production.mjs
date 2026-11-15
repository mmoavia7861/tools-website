/** Build crawlable production pages without modifying the tracked GitHub Pages index. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const originalIndex = readFileSync('index.html');
const sourceIndex = readFileSync('index.source.html');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
try {
  writeFileSync('index.html', sourceIndex);
  execFileSync(npm, ['run', 'build'], { stdio: 'inherit' });
  execFileSync(process.execPath, ['scripts/prepare-pages-seo.mjs'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      TOOLCRESTA_SITE_ORIGIN: 'https://toolscresta.com',
      TOOLCRESTA_PAGES_BASE: '/',
      GITHUB_PAGES: 'false',
    },
  });
  // Fail closed before deployment if HTML points to missing CSS/JS assets.
  // On slow mobile browsers the SEO fallback otherwise appears as plain text.
  const html = readFileSync('dist/index.html', 'utf8');
  const assetUrls = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]))];
  if (!assetUrls.some((url) => url.endsWith('.js')) || !assetUrls.some((url) => url.endsWith('.css'))) {
    throw new Error('Production HTML is missing JavaScript or stylesheet assets.');
  }
  for (const url of assetUrls) {
    if (!existsSync('dist' + url)) {
      throw new Error('Production HTML references a missing asset: ' + url);
    }
  }
  if (!html.includes('class="tc-static"')) {
    throw new Error('Mobile-friendly static fallback was not generated.');
  }
  console.log('Verified production HTML, mobile fallback and', assetUrls.length, 'initial asset files.');
} finally {
  writeFileSync('index.html', originalIndex);
}
