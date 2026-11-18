/**
 * Prepare static, indexable HTML entrypoints for GitHub Pages.
 * A React SPA's 404 fallback returns HTTP 404 to crawlers for deep URLs.
 * These generated directories return HTTP 200 and expose meaningful page
 * titles, descriptions and crawlable links even before React loads.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

// The publishing workflow sets these only after the Pages custom domain is configured.
const origin = process.env.TOOLCRESTA_SITE_ORIGIN || 'https://mmoavia7861.github.io';
const base = process.env.TOOLCRESTA_PAGES_BASE || '/tools-website/';
if (!/^https:\/\/[a-z0-9.-]+$/i.test(origin) || !/^\/(?:[a-zA-Z0-9-]+\/)?$/.test(base)) {
  throw new Error('Invalid Pages origin or base path.');
}
const root = 'dist';
const homeHtml = readFileSync(join(root, 'index.html'), 'utf8');
const routes = [
  ['/', 'ToolsCresta — Free Online QR, PDF & Image Tools', 'Free online tools for creating QR codes, compressing PDFs, converting images to PDF, editing PDFs and removing image backgrounds.', 'Choose a free browser tool below.'],
  ['/qr-code-generator/', 'Free QR Code Generator | ToolsCresta', 'Generate URL, Wi-Fi, text and vCard QR codes in your browser. Export high-resolution PNG or SVG.', 'Generate static QR codes using custom content, then download your code.'],
  ['/compress-pdf/', 'PDF Compressor Online | ToolsCresta', 'Try on-device PDF structure optimization, view real before-and-after file sizes and download the result.', 'Compress PDF files with actual measured results; some already-optimized files will not shrink.'],
  ['/image-to-pdf/', 'Image to PDF Converter | ToolsCresta', 'Convert JPG, PNG and WebP images into downloadable PDFs with options for page size, rotation and order.', 'Add your images, customize the page layout, and export a PDF in your browser.'],
  ['/edit-pdf/', 'PDF Editor and Signature Tool | ToolsCresta', 'Reorder, rotate, sign and annotate PDF pages in the browser. Preview pages and export the actual edited file.', 'Upload a PDF, add text or signature annotations, organize pages and download the edited document.'],
  ['/background-remover/', 'Image Background Remover | ToolsCresta', 'Remove photo backgrounds with browser-based neural processing and manual refinement tools.', 'Try photo background removal with transparent PNG or solid-background JPG exports.'],
  ['/visiting-card-generator/', 'Visiting Card Maker | ToolsCresta', 'Create personalized visiting cards, add a QR code, and export print-friendly image or PDF files.', 'Customize your business card and choose a download format.'],
  ['/ai-card-generator/', 'AI Card Generator — Visiting Wedding Birthday | ToolsCresta', 'Design visiting, wedding and birthday cards with free editable templates; optional Gemini AI when configured. Download real PNG JPG or PDF.', 'Create editable cards from guided prompts and download print-ready designs.'],
  ['/wedding-card-maker/', 'Wedding Invitation Card Maker | ToolsCresta', 'Create and download elegant editable wedding invitation cards with free templates.', 'Customize names, date, time and location, then download the wedding invitation.'],
  ['/birthday-card-maker/', 'Birthday Invitation Card Maker | ToolsCresta', 'Make birthday invitation cards with adjustable colors and layouts. Export JPG PNG or PDF.', 'Enter birthday details, preview and download an invitation.'],
  ['/pdf-to-word/', 'PDF to Word Converter | ToolsCresta', 'Convert text-based PDF documents to editable DOCX files. Scanned PDFs require OCR and complex layouts may change.', 'Extract selectable PDF text to DOCX in your browser. Scanned PDFs and complex layouts are not supported.'],
  ['/word-to-pdf/', 'Word to PDF Converter | ToolsCresta', 'Convert basic DOCX text to PDF in your browser. Complex formatting and some Unicode scripts are not supported.', 'Convert basic Word document text into a PDF without uploading files.'],
  ['/compress-video/', 'Video Compressor Online | ToolsCresta', 'Compress videos in your browser with real output size feedback. Processing and format support depend on your device and browser.', 'Select a video, choose compression settings, and verify the real resulting file size before saving.'],
  ['/blog/', 'ToolsCresta Guides and Tutorials', 'Read guides explaining QR codes, PDF optimization, transparent images and private online tools.', 'Browse educational articles on QR codes, documents and image formats.'],
  ['/blog/how-qr-codes-work-and-when-to-use-them/', 'How QR Codes Work and When to Use Them | ToolsCresta', 'An introduction to QR codes, their uses and how to create a safe static code.', 'Learn the basics of static QR codes and everyday use cases.'],
  ['/blog/how-to-reduce-pdf-file-size-without-ruining-readability/', 'How to Reduce PDF File Size Without Ruining Readability | ToolsCresta', 'Learn why PDFs can be difficult to compress and how to preserve readable document quality.', 'Understand PDF file structure and sensible compression tradeoffs.'],
  ['/blog/transparent-png-vs-jpeg-which-format-should-you-use/', 'Transparent PNG vs JPEG: Which Should You Use? | ToolsCresta', 'Compare PNG transparency and JPEG compression for images and background removal.', 'Understand the advantages and limitations of PNG and JPEG.'],
  ['/about/', 'About ToolsCresta | Online Tools', 'Learn about ToolsCresta, our online utility tools, local browser processing and clear limitations.', 'Learn about our tools, browser-first design and our approach to privacy.'],
  ['/contact/', 'Contact ToolsCresta | Support and Privacy Requests', 'Contact ToolsCresta about tool issues, copyright questions, privacy requests or website feedback.', 'Send a support inquiry using our contact form. Messages are saved to Firebase when submission succeeds.'],
  ['/privacy-policy/', 'Privacy Policy | ToolsCresta', 'Read how ToolsCresta processes tool files, contact messages, cookies, Firebase data and optional AI services.', 'Our policy describes local versus cloud processing, contact data, optional advertising and your choices.'],
  ['/terms/', 'Terms of Service | ToolsCresta', 'Understand the terms governing ToolsCresta online tools, user responsibilities and service limitations.', 'Review the conditions and limitations for using ToolsCresta tools.'],
  ['/acceptable-use/', 'Acceptable Use Policy | ToolsCresta', 'Read guidelines against malware, phishing, unauthorized exploitation and other misuse of ToolsCresta.', 'Review acceptable use requirements that apply to this website.'],
  ['/copyright-dmca/', 'Copyright and DMCA Information | ToolsCresta', 'Learn how to report a suspected copyright issue involving ToolsCresta website content.', 'Learn how to report concerns about copyrighted content on this site.']
];

const escapeText = str => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// The primary indexable domain is toolscresta.com (not its GitHub mirror).
const canonicalOrigin = 'https://toolscresta.com';
const absoluteUrl = route => canonicalOrigin + '/' + route.replace(/^\/|\/$/g, '') + (route === '/' ? '' : '/');
// Honest, route-specific plain text for visitors who have JavaScript disabled.
// These details explain functions and limitations, not fictional performance claims.
const routeGuidance = {
  '/qr-code-generator/': ['Choose URL, Wi-Fi, plain text or contact details and preview a static QR code.', 'Adjust its colors and size, then download PNG or SVG. Test printed codes before using them publicly.'],
  '/compress-pdf/': ['Select a PDF and review its original byte size before processing.', 'The resulting size is measured, not estimated. Some already optimized files cannot be compressed further.'],
  '/image-to-pdf/': ['Add JPG, PNG or WebP images, select a page layout and choose their order.', 'Preview the PDF before downloading it; very large source images can exhaust memory on older devices.'],
  '/edit-pdf/': ['Upload a PDF to arrange pages, add text and signature annotations, and preview edits.', 'Download the resulting PDF and check changes in a PDF reader.'],
  '/background-remover/': ['Select a photo and allow the browser to process its background; first-time AI model downloads may be large.', 'Refine difficult edges manually if necessary. PNG supports transparency, while JPEG does not.'],
  '/visiting-card-generator/': ['Enter business contact details and select a layout, typography and card size.', 'Check QR codes, spelling and print dimensions before exporting the design.'],
  '/ai-card-generator/': ['Use editable card templates for visiting, wedding and birthday designs.', 'Optional AI assistance needs an available provider and is not required for free templates.'],
  '/wedding-card-maker/': ['Choose a wedding invitation design, enter names, date and venue, then preview the result.', 'Verify event details and print dimensions before sharing.'],
  '/birthday-card-maker/': ['Select a birthday invitation layout and customize the event details.', 'Export a card after checking the date, location and message.'],
  '/pdf-to-word/': ['Convert text-based PDFs to editable DOCX files; the source PDF should contain selectable text.', 'Scanned documents need OCR and intricate page layouts may change during extraction.'],
  '/word-to-pdf/': ['Convert basic Word document text into a downloadable PDF.', 'Complex tables, fonts and some non-Latin formatting are not guaranteed to match the source.'],
  '/compress-video/': ['Choose a supported video and set the available size or quality options.', 'Compression depends on browser codecs and device memory. Verify playback and actual output size.'],
  '/blog/': ['Read practical tutorials about QR codes, PDF compression and image formats.', 'Browse guides for real scenarios and follow links to related online tools.']
};
const navigation = routes.filter(([path]) => !path.startsWith('/blog/')).map(([path, title]) =>
  '<li><a href="' + escapeText(absoluteUrl(path)) + '">' + escapeText(title.split(' | ')[0]) + '</a></li>').join('\n');

for (const [route, title, description, introduction] of routes) {
  const loc = absoluteUrl(route);
  const help = routeGuidance[route] || [];
  const usefulText = help.length
    ? '<section><h2>How this works</h2>' + help.map(paragraph => '<p>' + escapeText(paragraph) + '</p>').join('') + '</section>' : '';
  const fallback = '<div id="root"><main><h1>' + escapeText(title.split(' | ')[0]) +
    '</h1><p>' + escapeText(introduction) + '</p>' + usefulText +
    '<nav aria-label="ToolsCresta pages"><h2>More tools and guides</h2><ul>' + navigation + '</ul></nav></main></div>';
  // The schema mirrors visible page content. No review counts or fictitious ratings.
  const webPageSchema = {
    '@context': 'https://schema.org', '@type': 'WebPage',
    name: title, description, url: loc,
    isPartOf: { '@type': 'WebSite', name: 'ToolsCresta', url: canonicalOrigin + '/' }
  };
  const crumbs = route.startsWith('/blog/') && route !== '/blog/'
    ? [['/', 'Home'], ['/blog/', 'Guides'], [route, title.split(' | ')[0]]]
    : [['/', 'Home'], ...(route === '/' ? [] : [[route, title.split(' | ')[0]]])];
  const crumbSchema = route === '/' ? '' : '<script type="application/ld+json">' +
    JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: crumbs.map(([path, name], i) => ({
        '@type': 'ListItem', position: i + 1, name, item: absoluteUrl(path)
      }))
    }).replace(/</g, '\\u003c') + '</script>';
  const tags = [
    '<link rel="canonical" href="' + escapeText(loc) + '" />',
    '<meta property="og:title" content="' + escapeText(title) + '" />',
    '<meta property="og:description" content="' + escapeText(description) + '" />',
    '<meta property="og:url" content="' + escapeText(loc) + '" />',
    '<meta property="og:site_name" content="ToolsCresta" />',
    '<meta property="og:type" content="' + (route.startsWith('/blog/') && route !== '/blog/' ? 'article' : 'website') + '" />',
    '<meta name="twitter:card" content="summary" />',
    '<meta name="twitter:title" content="' + escapeText(title) + '" />',
    '<meta name="twitter:description" content="' + escapeText(description) + '" />',
    '<script type="application/ld+json">' + JSON.stringify(webPageSchema).replace(/</g, '\\u003c') + '</script>',
    crumbSchema
  ].join('\n');
  const htmlWithoutOldSocialTags = homeHtml
    .replace(/<meta property="og:(?:title|description|type)"[^>]*>\s*/gi, '')
    .replace(/<meta name="twitter:card"[^>]*>\s*/gi, '');
  let html = htmlWithoutOldSocialTags
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>' + escapeText(title) + '</title>')
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/i, '<meta name="description" content="' + escapeText(description) + '" />')
    .replace('<div id="root"></div>', fallback)
    .replace('</head>', tags + '\n</head>');

  if (route === '/') {
    writeFileSync(join(root, 'index.html'), html);
  } else {
    const relative = route.replace(/^\/|\/$/g, '');
    const dir = join(root, relative);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
  }
}
// The private admin route needs a real 200 entrypoint on GitHub Pages.
// It is deliberately omitted from the public sitemap and navigation.
const adminHtml = homeHtml
  .replace(/<title>[\s\S]*?<\/title>/i, '<title>ToolsCresta Admin Sign-in</title>')
  .replace('<div id="root"></div>', '<div id="root"><main><h1>ToolsCresta Admin Portal</h1><p>Authorized Google account sign-in required.</p></main></div>')
  .replace('</head>', '<meta name="robots" content="noindex, nofollow" />\n  </head>');
mkdirSync(join(root, 'admin'), { recursive: true });
writeFileSync(join(root, 'admin', 'index.html'), adminHtml);

// A real 404 must not look like an indexable copy of the homepage.
const notFoundHtml = homeHtml
  .replace(/<title>[\s\S]*?<\/title>/i, '<title>Page not found | ToolsCresta</title>')
  .replace('<div id="root"></div>', '<div id="root"><main><h1>Page not found</h1><p>This page is unavailable.</p><a href="' + canonicalOrigin + '/">ToolsCresta home</a></main></div>')
  .replace('</head>', '<meta name="robots" content="noindex, follow" />\n</head>');
writeFileSync(join(root, '404.html'), notFoundHtml);

const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  routes.map(([route]) => '  <url><loc>' + escapeText(absoluteUrl(route)) + '</loc></url>').join('\n') +
  '\n</urlset>\n';
writeFileSync(join(root, 'sitemap.xml'), xml);
// Allow crawlers to read the admin page's noindex header; do not index API routes.
writeFileSync(join(root, 'robots.txt'), 'User-agent: *\nAllow: ' + base + '\nDisallow: ' + base + 'api/\n\nSitemap: ' + canonicalOrigin + '/sitemap.xml\n');
console.log('Prepared', routes.length, 'crawlable route entrypoints, sitemap.xml and robots.txt for GitHub Pages.');
