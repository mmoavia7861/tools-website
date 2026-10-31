/**
 * QR Code payload formatting and validation utilities.
 * Client-side only. Never transmits user data or URLs to remote servers.
 */

export interface WifiPayload {
  ssid: string;
  password?: string;
  encryption: 'WPA' | 'WEP' | 'nopass';
  hidden?: boolean;
}

export interface VCardPayload {
  firstName: string;
  lastName?: string;
  organization?: string;
  title?: string;
  phone?: string;
  email?: string;
  website?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

/**
 * Escapes special characters for Wi-Fi QR code strings according to ZXing specifications.
 * Backslashes, colons, semicolons, commas, and quotes must be escaped with a backslash.
 */
export function escapeWifiString(str: string): string {
  if (!str) return '';
  return str.replace(/([\\;,:"])/g, '\\$1');
}

/**
 * Builds the standard WIFI: QR payload string.
 */
export function buildWifiPayload(config: WifiPayload): string {
  const ssid = escapeWifiString(config.ssid.trim());
  const type = config.encryption;
  const pass = config.password ? escapeWifiString(config.password) : '';
  const hidden = config.hidden ? 'H:true;' : '';

  if (type === 'nopass') {
    return `WIFI:T:nopass;S:${ssid};${hidden};`;
  }
  return `WIFI:T:${type};S:${ssid};P:${pass};${hidden};`;
}

/**
 * Builds a clean vCard 3.0 payload string.
 */
export function buildVCardPayload(data: VCardPayload): string {
  const fn = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
  const n = `${data.lastName || ''};${data.firstName || ''};;;`;

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${n}`,
    `FN:${fn || 'Contact'}`
  ];

  if (data.organization) lines.push(`ORG:${data.organization.trim()}`);
  if (data.title) lines.push(`TITLE:${data.title.trim()}`);
  if (data.phone) lines.push(`TEL;TYPE=CELL:${data.phone.trim()}`);
  if (data.email) lines.push(`EMAIL;TYPE=INTERNET:${data.email.trim()}`);
  if (data.website) lines.push(`URL:${data.website.trim()}`);

  const hasAddress = data.street || data.city || data.state || data.zip || data.country;
  if (hasAddress) {
    const street = data.street || '';
    const city = data.city || '';
    const state = data.state || '';
    const zip = data.zip || '';
    const country = data.country || '';
    lines.push(`ADR;TYPE=HOME:;;${street};${city};${state};${zip};${country}`);
  }

  lines.push('END:VCARD');
  return lines.join('\n');
}

/**
 * Validates a URL for QR encoding.
 * Only accepts valid http or https protocols.
 * DOES NOT fetch or verify remote host (prevents SSRF).
 */
export function validateUrl(input: string): { valid: boolean; formatted: string; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, formatted: '', error: 'URL cannot be empty' };
  }

  // Check if string contains a custom URI scheme (e.g. ftp://, javascript:, mailto:, file:)
  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      return { valid: false, formatted: '', error: `Unsupported protocol "${scheme}:". Only http and https are supported.` };
    }
  }

  let testUrl = trimmed;
  if (!/^https?:\/\//i.test(testUrl)) {
    testUrl = `https://${testUrl}`;
  }

  try {
    const parsed = new URL(testUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, formatted: '', error: 'Only http and https protocols are supported' };
    }
    return { valid: true, formatted: parsed.toString() };
  } catch {
    return { valid: false, formatted: '', error: 'Invalid URL format' };
  }
}
