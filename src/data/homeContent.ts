/** Compact homepage previews, kept separate from full blog article bodies. */
export const HOME_BLOG_PREVIEWS = [
  {
    "id": "post-1",
    "slug": "how-qr-codes-work-and-when-to-use-them",
    "title": "How QR Codes Work and When to Use Them: A Practical Guide",
    "excerpt": "QR codes have become ubiquitous for sharing links, contact details, and Wi-Fi networks. Discover how error correction ensures scannability and how to format data safely.",
    "readTime": "4 min read"
  },
  {
    "id": "post-2",
    "slug": "how-to-reduce-pdf-file-size-without-ruining-readability",
    "title": "How to Reduce PDF File Size Without Ruining Readability",
    "excerpt": "Bloated PDF files slow down email delivery and fail upload limits. Understand why PDFs grow so large and how modern compressors shrink them safely.",
    "readTime": "5 min read"
  },
  {
    "id": "post-3",
    "slug": "transparent-png-vs-jpeg-which-format-should-you-use",
    "title": "Transparent PNG vs JPEG: Which Format Should You Use?",
    "excerpt": "Need a cutout for e-commerce, logos, or web graphics? Learn the fundamental differences between 32-bit PNG alpha transparency and 24-bit JPEG compression.",
    "readTime": "4 min read"
  }
] as const;

export const FAQ_ITEMS = [
  {
    q: 'Does ToolsCresta store or retain my uploaded files?',
    a: 'No. ToolsCresta operates with a privacy-by-default architecture. The QR Code Generator runs 100% inside your browser. The PDF Compressor performs structural optimization on-device whenever possible; any server-assisted processing uses isolated temporary memory and deletes all files immediately after processing. We never store your documents or images in databases.'
  },
  {
    q: 'Is ToolsCresta completely free to use?',
    a: 'Yes. All three core tools—QR Code Generator, PDF Compressor, and AI Background Remover—are free to use without registration, subscriptions, or watermarks.'
  },
  {
    q: 'Why does the QR Code Generator not provide redirect links?',
    a: 'ToolsCresta encodes static QR codes directly into your browser. Static QR codes do not pass through intermediate redirect tracking servers, meaning your QR codes will never break, expire, or harvest analytics on people who scan them.'
  },
  {
    q: 'Why didn\'t my PDF compress to a smaller size?',
    a: 'Some PDF documents are already compressed using modern object streams or contain low-resolution vector graphics with no redundant metadata. ToolsCresta reports genuine before-and-after byte counts honestly and will inform you when further compression is not possible without compromising text readability.'
  },
  {
    q: 'Why can I only export transparent cutouts as PNG?',
    a: 'The JPEG image standard does not support alpha channel transparency. To save an image cutout as JPEG, ToolsCresta requires flattening the subject onto a solid background color (such as white or black) to avoid black-box edge artifacts.'
  }
];
