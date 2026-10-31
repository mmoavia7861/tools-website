export interface BlogPostItem {
  id: string;
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  content: string;
  author: string;
  published: boolean;
  readTime: string;
  createdAt: string;
  updatedAt: string;
}

export const STARTER_BLOG_POSTS: BlogPostItem[] = [
  {
    id: 'post-1',
    slug: 'how-qr-codes-work-and-when-to-use-them',
    title: 'How QR Codes Work and When to Use Them: A Practical Guide',
    metaTitle: 'How QR Codes Work and When to Use Them | RankNova',
    metaDescription: 'Learn how QR codes encode data, the importance of Reed-Solomon error correction, and best practices for Wi-Fi and vCard barcodes.',
    excerpt: 'QR codes have become ubiquitous for sharing links, contact details, and Wi-Fi networks. Discover how error correction ensures scannability and how to format data safely.',
    content: `## What is a Quick Response (QR) Code?

First designed in 1994 by Denso Wave for tracking automotive components, Quick Response (QR) codes are two-dimensional matrix barcodes capable of storing hundreds of times more information than standard UPC barcodes.

Unlike traditional barcodes that read in only one direction, QR codes encode data both vertically and horizontally. This matrix structure allows mobile cameras to scan the code from virtually any orientation.

### Anatomy of a QR Code

A QR code consists of several standardized zones:

1. **Position Detection Patterns:** The three large squares located at three corners allow barcode scanners to identify the presence and rotation angle of the matrix.
2. **Timing Patterns:** Alternating dark and light modules running between the position squares that tell the scanner the grid coordinates and module dimensions.
3. **Alignment Patterns:** Additional small squares embedded in larger QR versions to compensate for curved surfaces or perspective distortion.
4. **Format & Version Information:** Sections declaring the Error Correction Level and data mask pattern.
5. **Data and Error Correction Codewords:** The payload itself, backed by Reed-Solomon parity blocks.

### The Role of Reed-Solomon Error Correction

QR codes include built-in redundancy using Reed-Solomon error correction algorithms. When a QR code is partially smudged, torn, or overlaid with a central logo, the scanner can mathematically reconstruct the missing bits:

- **Level L (Low):** Reconstructs up to ~7% of damaged data. Best for clean digital screens where payload size needs to be minimized.
- **Level M (Medium):** Reconstructs up to ~15% of damaged data. The default choice for everyday flyers and print receipts.
- **Level Q (Quartile):** Reconstructs up to ~25% of damaged data. Ideal for outdoor stickers exposed to environmental wear.
- **Level H (High):** Reconstructs up to ~30% of damaged data. Required whenever a branding icon or badge is placed over the center of the barcode.

### Static vs. Dynamic QR Codes

- **Static QR Codes:** The encoded data (such as a URL, Wi-Fi password, or vCard) is permanently written into the barcode pattern. Static codes require no external server lookup, never expire, and do not track users.
- **Dynamic QR Codes:** The code encodes a short tracking URL that redirects to the destination address. This allows destination changes after printing, but introduces dependency on the third-party redirect service and raises privacy considerations.

RankNova's QR Code Generator generates pure **static QR codes on-device**, ensuring total user privacy without server redirects or payload storage.`,
    author: 'RankNova Engineering',
    published: true,
    readTime: '4 min read',
    createdAt: '2026-10-25T10:00:00Z',
    updatedAt: '2026-10-25T10:00:00Z'
  },
  {
    id: 'post-2',
    slug: 'how-to-reduce-pdf-file-size-without-ruining-readability',
    title: 'How to Reduce PDF File Size Without Ruining Readability',
    metaTitle: 'How to Reduce PDF File Size Without Ruining Readability | RankNova',
    metaDescription: 'Discover the technical mechanisms behind PDF compression: object stream compaction, metadata stripping, and image resampling.',
    excerpt: 'Bloated PDF files slow down email delivery and fail upload limits. Understand why PDFs grow so large and how modern compressors shrink them safely.',
    content: `## Why Do PDF Files Become So Large?

Portable Document Format (PDF) files are container archives. A single document can encapsulate fonts, embedded raster images, vector graphic paths, interactive form fields, color profiles, and historical version revisions.

When a 2-page document reaches 20 Megabytes, the cause is almost never the text itself; it is unoptimized media and redundant resource dictionaries.

### Common Contributors to PDF Bloat

1. **Uncompressed or Unused Embedded Images:** High-resolution scans captured at 600 DPI for standard 72 DPI screen viewing.
2. **Full Font Subsets:** Embedding an entire font family containing thousands of unused Unicode glyphs rather than embedding only the glyphs used in the text.
3. **Redundant XML Metadata:** Adobe XMP packets, editing history, print proofing profiles, and thumbnail caches that provide zero value to the end reader.
4. **Uncompressed Object Streams:** In older PDF versions (prior to PDF 1.5), cross-reference tables and individual dictionary objects were stored as uncompressed ASCII text.

### The Optimization Pipeline

A robust, privacy-respecting PDF compressor addresses these layers systematically:

- **Structural Object Compaction:** Modern PDF specifications (PDF 1.5+) allow cross-reference streams and indirect objects to be packaged into FlateDecode compressed streams, reducing structural overhead by up to 40%.
- **Duplicate Resource Pruning:** Identifying duplicate font descriptors and color spaces that have been duplicated across merged pages.
- **Image Downsampling & Re-encoding:** Resampling raster imagery from excessive print resolutions down to balanced web standards (typically 150 DPI for business documents) and applying modern lossy or lossless compression.

### Why Honest Reporting Matters

Not every PDF can be compressed. A document composed entirely of clean vector text that has already been compacted with object streams cannot be reduced further without rasterizing the text into blurry pixels.

RankNova's PDF Compressor validates every file against its original byte length. If the document is already optimized, RankNova reports this fact truthfully rather than fabricating fake savings.`,
    author: 'RankNova Engineering',
    published: true,
    readTime: '5 min read',
    createdAt: '2026-10-26T14:30:00Z',
    updatedAt: '2026-10-26T14:30:00Z'
  },
  {
    id: 'post-3',
    slug: 'transparent-png-vs-jpeg-which-format-should-you-use',
    title: 'Transparent PNG vs JPEG: Which Format Should You Use?',
    metaTitle: 'Transparent PNG vs JPEG: Which Format Should You Use? | RankNova',
    metaDescription: 'A technical breakdown of raster image formats, alpha channel transparency, compression artifacts, and when to use PNG versus JPEG.',
    excerpt: 'Need a cutout for e-commerce, logos, or web graphics? Learn the fundamental differences between 32-bit PNG alpha transparency and 24-bit JPEG compression.',
    content: `## The Core Technical Difference: Alpha Transparency

When removing the background from a portrait, product photo, or logo, choosing the right file format is critical for presentation quality.

The key technical distinction between PNG and JPEG lies in how color channels are encoded:

- **PNG (Portable Network Graphics):** Supports 32-bit RGBA color—Red, Green, Blue, and an independent 8-bit Alpha channel that represents 256 levels of per-pixel transparency (from 0 = fully transparent to 255 = fully opaque).
- **JPEG (Joint Photographic Experts Group):** Encodes 24-bit RGB color only. The JPEG format specification does NOT include an alpha channel and has zero native support for transparent pixels.

### What Happens When You Save a Cutout as JPEG?

Because JPEG has no alpha channel, attempting to save a transparent image as JPEG requires flattening the translucent and transparent pixels against a solid backdrop color (typically white or black).

If a website claims to give you a "transparent JPEG", it is either mislabeled or will display with a stark solid rectangle behind your subject.

### Comparison Table

| Feature | PNG | JPEG |
|---|---|---|
| Transparency Support | Full 8-bit Alpha Channel | None (Solid Color Only) |
| Compression Type | Lossless (DEFLATE / zlib) | Lossy (Discrete Cosine Transform) |
| Sharp Edge Fidelity | Crisp, no artifact halos | Edge ringing / blockiness |
| File Size on Complex Photos | Moderate to Large | Small to Medium |
| Best For | Logos, Cutouts, UI Icons | Photographs, Wallpapers, Scenery |

### Best Practices for Background Removal Workflows

1. **Keep the Master Cutout in PNG:** Always download the transparent master file as a PNG. This preserves hair strands, translucent glass, and soft shadows with clean sub-pixel anti-aliasing.
2. **Flatten Only for Specific Publishing Targets:** If your final destination requires JPEG (such as certain e-commerce platforms with rigid format rules), select your exact canvas background color (such as pure white #FFFFFF) during export so edge pixels blend naturally.
3. **Avoid Repeated Compression Cycles:** Re-saving lossy JPEGs causes cumulative generation loss. Keep your original cutout in PNG and generate flattened JPEGs on demand.`,
    author: 'RankNova Engineering',
    published: true,
    readTime: '4 min read',
    createdAt: '2026-10-27T09:15:00Z',
    updatedAt: '2026-10-27T09:15:00Z'
  }
];

export const FAQ_ITEMS = [
  {
    q: 'Does RankNova store or retain my uploaded files?',
    a: 'No. RankNova operates with a privacy-by-default architecture. The QR Code Generator runs 100% inside your browser. The PDF Compressor performs structural optimization on-device whenever possible; any server-assisted processing uses isolated temporary memory and deletes all files immediately after processing. We never store your documents or images in databases.'
  },
  {
    q: 'Is RankNova completely free to use?',
    a: 'Yes. All three core tools—QR Code Generator, PDF Compressor, and AI Background Remover—are free to use without registration, subscriptions, or watermarks.'
  },
  {
    q: 'Why does the QR Code Generator not provide redirect links?',
    a: 'RankNova encodes static QR codes directly into your browser. Static QR codes do not pass through intermediate redirect tracking servers, meaning your QR codes will never break, expire, or harvest analytics on people who scan them.'
  },
  {
    q: 'Why didn\'t my PDF compress to a smaller size?',
    a: 'Some PDF documents are already compressed using modern object streams or contain low-resolution vector graphics with no redundant metadata. RankNova reports genuine before-and-after byte counts honestly and will inform you when further compression is not possible without compromising text readability.'
  },
  {
    q: 'Why can I only export transparent cutouts as PNG?',
    a: 'The JPEG image standard does not support alpha channel transparency. To save an image cutout as JPEG, RankNova requires flattening the subject onto a solid background color (such as white or black) to avoid black-box edge artifacts.'
  }
];
