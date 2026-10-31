/**
 * Prepare static, indexable HTML entrypoints for GitHub Pages.
 * A React SPA's 404 fallback returns HTTP 404 to crawlers for deep URLs.
 * These generated directories return HTTP 200 and expose meaningful page
 * titles, descriptions and crawlable links even before React loads.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const origin = 'https://mmoavia7861.github.io';
const base = '/tools-website/';
const root = 'dist';
const homeHtml = readFileSync(join(root, 'index.html'), 'utf8');
const routes = [
  ['/', 'RankNova — Free Online QR, PDF & Image Tools', 'Free online tools for creating QR codes, compressing PDFs, converting images to PDF, editing PDFs and removing image backgrounds.', 'Choose a free browser tool below.'],
  ['/qr-code-generator/', 'Free QR Code Generator | RankNova', 'Generate URL, Wi-Fi, text and vCard QR codes in your browser. Export high-resolution PNG or SVG.', 'Generate static QR codes using custom content, then download your code.'],
  ['/compress-pdf/', 'PDF Compressor Online | RankNova', 'Try on-device PDF structure optimization, view real before-and-after file sizes and download the result.', 'Compress PDF files with actual measured results; some already-optimized files will not shrink.'],
  ['/image-to-pdf/', 'Image to PDF Converter | RankNova', 'Convert JPG, PNG and WebP images into downloadable PDFs with options for page size, rotation and order.', 'Add your images, customize the page layout, and export a PDF in your browser.'],
  ['/edit-pdf/', 'PDF Editor and Organizer | RankNova', 'Reorder, rotate or remove PDF pages, and add watermarks or page numbers in your browser.', 'Select a PDF and use page rotation, ordering and export tools.'],
  ['/background-remover/', 'Image Background Remover | RankNova', 'Remove photo backgrounds with browser-based neural processing and manual refinement tools.', 'Try photo background removal with transparent PNG or solid-background JPG exports.'],
  ['/visiting-card-generator/', 'Visiting Card Maker | RankNova', 'Create personalized visiting cards, add a QR code, and export print-friendly image or PDF files.', 'Customize your business card and choose a download format.'],
  ['/blog/', 'RankNova Guides and Tutorials', 'Read guides explaining QR codes, PDF optimization, transparent images and private online tools.', 'Browse educational articles on QR codes, documents and image formats.'],
  ['/blog/how-qr-codes-work-and-when-to-use-them/', 'How QR Codes Work and When to Use Them | RankNova', 'An introduction to QR codes, their uses and how to create a safe static code.', 'Learn the basics of static QR codes and everyday use cases.'],
  ['/blog/how-to-reduce-pdf-file-size-without-ruining-readability/', 'How to Reduce PDF File Size Without Ruining Readability | RankNova', 'Learn why PDFs can be difficult to compress and how to preserve readable document quality.', 'Understand PDF file structure and sensible compression tradeoffs.'],
  ['/blog/transparent-png-vs-jpeg-which-format-should-you-use/', 'Transparent PNG vs JPEG: Which Should You Use? | RankNova', 'Compare PNG transparency and JPEG compression for images and background removal.', 'Understand the advantages and limitations of PNG and JPEG.'],
  ['/about/', 'About RankNova | Online Tools', 'Learn about RankNova, our online utility tools, local browser processing and clear limitations.', 'Learn about our tools, browser-first design and our approach to privacy.'],
  ['/contact/', 'Contact RankNova | Support and Privacy Requests', 'Contact RankNova about tool issues, copyright questions, privacy requests or website feedback.', 'Send a support inquiry using our contact form. Messages are saved to Firebase when submission succeeds.'],
  ['/privacy-policy/', 'Privacy Policy | RankNova', 'Read how RankNova processes tool files, contact messages, cookies, Firebase data and optional AI services.', 'Our policy describes local versus cloud processing, contact data, optional advertising and your choices.'],
  ['/terms/', 'Terms of Service | RankNova', 'Understand the terms governing RankNova online tools, user responsibilities and service limitations.', 'Review the conditions and limitations for using RankNova tools.'],
  ['/acceptable-use/', 'Acceptable Use Policy | RankNova', 'Read guidelines against malware, phishing, unauthorized exploitation and other misuse of RankNova.', 'Review acceptable use requirements that apply to this website.'],
  ['/copyright-dmca/', 'Copyright and DMCA Information | RankNova', 'Learn how to report a suspected copyright issue involving RankNova website content.', 'Learn how to report concerns about copyrighted content on this site.']
];

const escapeText = str => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const absoluteUrl = route => origin + base + route.replace(/^\/|\/$/g, '') + (route === '/' ? '' : '/');
const navigation = routes.filter(([path]) => !path.startsWith('/blog/')).map(([path, title]) =>
  '<li><a href="' + escapeText(absoluteUrl(path)) + '">' + escapeText(title.split(' | ')[0]) + '</a></li>').join('\n');

for (const [route, title, description, introduction] of routes) {
  const loc = absoluteUrl(route);
  // Use real initial content in generated HTML for crawlers and visitors with JS unavailable.
  const fallback = '<div id="root"><main><h1>' + escapeText(title.split(' | ')[0]) +
    '</h1><p>' + escapeText(introduction) +
    '</p><nav aria-label="RankNova pages"><ul>' + navigation + '</ul></nav></main></div>';
  let html = homeHtml
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>' + escapeText(title) + '</title>')
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/i, '<meta name="description" content="' + escapeText(description) + '" />')
    .replace('<div id="root"></div>', fallback)
    .replace('</head>', '<link rel="canonical" href="' + escapeText(loc) + '" />\n  </head>');
  if (route === '/') {
    writeFileSync(join(root, 'index.html'), html);
  } else {
    const relative = route.replace(/^\/|\/$/g, '');
    const dir = join(root, relative);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
  }
}
copyFileSync(join(root, 'index.html'), join(root, '404.html'));

const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  routes.map(([route]) => '  <url><loc>' + escapeText(absoluteUrl(route)) + '</loc></url>').join('\n') +
  '\n</urlset>\n';
writeFileSync(join(root, 'sitemap.xml'), xml);
writeFileSync(join(root, 'robots.txt'), 'User-agent: *\nAllow: /tools-website/\nDisallow: /tools-website/admin/\n\nSitemap: ' + origin + base + 'sitemap.xml\n');
console.log('Prepared', routes.length, 'crawlable route entrypoints, sitemap.xml and robots.txt for GitHub Pages.');
