/**
 * Public tool directory backed by a single, non-secret Firestore document.
 * Editing a directory entry cannot add executable code or new API endpoints.
 * Only built and tested routes can be published; new ideas stay as drafts.
 */
export interface ToolEntry {
  id: string;
  title: string;
  description: string;
  path: string;
  enabled: boolean;
  featured: boolean;
  sortOrder: number;
  status: 'installed' | 'draft';
}

type InstalledTool = { id: string; title: string; description: string; path: string };
export const INSTALLED_TOOLS: readonly InstalledTool[] = [
  { id: 'qr-code-generator', title: 'QR Code Generator', description: 'Generate downloadable QR codes in your browser.', path: '/qr-code-generator' },
  { id: 'compress-pdf', title: 'Compress PDF', description: 'Optimize PDF files and report actual file-size changes.', path: '/compress-pdf' },
  { id: 'image-to-pdf', title: 'Image to PDF', description: 'Combine JPG, PNG and WebP images into a PDF.', path: '/image-to-pdf' },
  { id: 'edit-pdf', title: 'PDF Editor', description: 'Edit, sign and organize PDF pages.', path: '/edit-pdf' },
  { id: 'background-remover', title: 'Background Remover', description: 'Remove the background from photos and images.', path: '/background-remover' },
  { id: 'visiting-card-generator', title: 'Visiting Card Maker', description: 'Design and export business cards.', path: '/visiting-card-generator' },
  { id: 'ai-card-generator', title: 'AI Card Maker', description: 'Design cards and invitations with optional AI assistance.', path: '/ai-card-generator' },
  { id: 'wedding-card-maker', title: 'Wedding Card Maker', description: 'Create and personalize wedding invitations.', path: '/wedding-card-maker' },
  { id: 'birthday-card-maker', title: 'Birthday Card Maker', description: 'Create editable birthday invitations.', path: '/birthday-card-maker' },
  { id: 'compress-video', title: 'Video Compressor', description: 'Compress supported videos locally in the browser.', path: '/compress-video' },
  { id: 'pdf-to-word', title: 'PDF to Word', description: 'Convert supported PDFs to editable Word documents.', path: '/pdf-to-word' },
  { id: 'word-to-pdf', title: 'Word to PDF', description: 'Create PDF documents from supported Word files.', path: '/word-to-pdf' }
];

const pathById = new Map(INSTALLED_TOOLS.map(item => [item.id, item.path]));

export const DEFAULT_TOOLS: ToolEntry[] = INSTALLED_TOOLS.map((tool, index) => ({
  ...tool, enabled: true, featured: index < 7, sortOrder: index, status: 'installed'
}));

const idPattern = /^[a-z][a-z0-9-]{0,62}$/;
const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export function validateToolCatalog(raw: unknown): ToolEntry[] | null {
  if (!raw || typeof raw !== 'object' || !('items' in raw) || !Array.isArray(raw.items)) return null;
  const items = raw.items as unknown[];
  if (items.length > 60) return null;
  const seen = new Set<string>();
  const result: ToolEntry[] = [];
  for (const source of items) {
    if (!source || typeof source !== 'object') return null;
    const t = source as Record<string, unknown>;
    const id = text(t.id, 64);
    const title = text(t.title, 100);
    const description = text(t.description, 360);
    const status = t.status;
    if (!idPattern.test(id) || seen.has(id) || !title || !description ||
        typeof t.enabled !== 'boolean' || typeof t.featured !== 'boolean' ||
        typeof t.sortOrder !== 'number' || !Number.isInteger(t.sortOrder) ||
        t.sortOrder < 0 || t.sortOrder > 1000) return null;
    seen.add(id);
    if (status === 'installed') {
      if (pathById.get(id) !== t.path) return null;
    } else if (status === 'draft') {
      if (t.path !== '' || pathById.has(id) || t.enabled !== false) return null;
    } else return null;
    result.push({ id, title, description, status, path: status === 'draft' ? '' : String(t.path),
      enabled: t.enabled, featured: t.featured, sortOrder: t.sortOrder });
  }
  return result.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

export function visibleTools(items: ToolEntry[]): ToolEntry[] {
  return items.filter(t => t.status === 'installed' && t.enabled && pathById.get(t.id) === t.path);
}

export function canonicalToolPath(path: string): string {
  if (path === '/visiting-card' ) return '/visiting-card-generator';
  if (path === '/video-compressor') return '/compress-video';
  return path;
}

export function canVisitTool(items: ToolEntry[], path: string): boolean {
  const canonical = canonicalToolPath(path);
  return visibleTools(items).some(item => item.path === canonical);
}

/** Values are rendered as plain text. No HTML, JS, or arbitrary URLs from Firestore. */
export interface HomeSettings {
  headline: string;
  highlight: string;
  description: string;
  announcement: string;
}

export const DEFAULT_HOME_SETTINGS: HomeSettings = {
  headline: 'Free Online Tools.',
  highlight: 'Fast, Secure, Private.',
  description: 'Create QR codes, compress PDFs, and remove image backgrounds with simple tools built for speed and privacy.',
  announcement: 'Browser-first tools • Server conversion clearly labelled'
};

export function readHomeSettings(raw: unknown): HomeSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_HOME_SETTINGS;
  const fields = raw as Record<string, unknown>;
  return {
    headline: text(fields.headline, 100) || DEFAULT_HOME_SETTINGS.headline,
    highlight: text(fields.highlight, 100) || DEFAULT_HOME_SETTINGS.highlight,
    description: text(fields.description, 400) || DEFAULT_HOME_SETTINGS.description,
    announcement: text(fields.announcement, 140) || DEFAULT_HOME_SETTINGS.announcement
  };
}
