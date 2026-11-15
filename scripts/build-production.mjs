/** Build crawlable production pages without modifying the tracked GitHub Pages index. */
import { readFileSync, writeFileSync } from 'node:fs';
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
} finally {
  writeFileSync('index.html', originalIndex);
}
