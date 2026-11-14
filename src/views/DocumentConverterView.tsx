import React, { useEffect, useRef, useState } from 'react';
import { SEOHead } from '../components/SEOHead';

type Mode = 'pdf-to-word' | 'word-to-pdf';
const MAX_BYTES = 10 * 1024 * 1024;
const API_URL = (import.meta.env.VITE_CONVERTER_API_URL || '').trim().replace(/\/$/, '');
const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
const ADOBE_READY = /^https:\/\//.test(API_URL) && Boolean(TURNSTILE_SITE_KEY);

async function convertLocally(file: File, mode: Mode): Promise<Blob> {
  const bytes = await file.arrayBuffer();
  if (mode === 'pdf-to-word') {
    if (new TextDecoder('latin1').decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('Invalid PDF file.');
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    const { Document, Packer, Paragraph, TextRun } = await import('docx');
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, disableFontFace: true }).promise;
    if (pdf.numPages > 60) throw new Error('This free converter supports up to 60 PDF pages.');
    const paragraphs: InstanceType<typeof Paragraph>[] = [];
    let characters = 0;
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const lines = new Map<number, { x: number; text: string }[]>();
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const y = Math.round(item.transform[5] / 4) * 4;
        const list = lines.get(y) || [];
        list.push({ x: item.transform[4], text: item.str });
        lines.set(y, list);
        characters += item.str.length;
        if (characters > 300000) throw new Error('Document contains too much text for browser conversion.');
      }
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: 'Page ' + pageNum, bold: true })] }));
      for (const [, words] of [...lines].sort((a, b) => b[0] - a[0])) {
        const text = words.sort((a, b) => a.x - b.x).map(w => w.text).join(' ');
        paragraphs.push(new Paragraph({ text }));
      }
    }
    if (!characters) throw new Error('No selectable text found. Scanned PDFs require OCR.');
    const doc = new Document({ sections: [{ children: paragraphs }] });
    return new Blob([await Packer.toBlob(doc)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  if (new Uint8Array(bytes).slice(0, 2).some((n, i) => n !== [80, 75][i])) throw new Error('Invalid DOCX file.');
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: bytes });
  const text = result.value.trim();
  if (!text) throw new Error('No readable text found in this Word document.');
  if (text.length > 300000) throw new Error('Document contains too much text for browser conversion.');
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = 11, margin = 46, lineHeight = 16, maxWidth = 595 - 2 * margin;
  let page = doc.addPage([595, 842]);
  let y = 842 - margin;
  const write = (line: string) => {
    if (y < margin + lineHeight) { page = doc.addPage([595, 842]); y = 842 - margin; }
    page.drawText(line, { x: margin, y, size, font, color: rgb(0.1, 0.15, 0.22) });
    y -= lineHeight;
  };
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) { write(''); continue; }
    // Built-in Helvetica cannot represent arbitrary Unicode. Never silently replace characters.
    if (/[^\x09\x20-\x7e\xa0-\xff]/.test(raw)) throw new Error('This basic PDF converter does not support some Unicode characters. Use a full document converter for this file.');
    let line = '';
    for (const word of raw.split(/\s+/)) {
      const candidate = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) { write(line); line = word; }
      else line = candidate;
      if (font.widthOfTextAtSize(line, size) > maxWidth) throw new Error('A word is too long for the basic converter.');
    }
    write(line);
  }
  const output = await doc.save();
  return new Blob([new Uint8Array(output)], { type: 'application/pdf' });
}

export const DocumentConverterView: React.FC<{ mode: Mode }> = ({ mode }) => {
  const toWord = mode === 'pdf-to-word';
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [method, setMethod] = useState<'browser' | 'adobe'>('browser');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const widgetElementRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (method !== 'adobe' || !ADOBE_READY || !widgetElementRef.current) return;
    let cancelled = false;
    let attempts = 0;
    const renderWidget = () => {
      const widgetApi = (window as any).turnstile;
      if (cancelled || !widgetElementRef.current || !widgetApi?.render || widgetIdRef.current) return;
      widgetIdRef.current = widgetApi.render(widgetElementRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (value: string) => { setTurnstileToken(value); setVerificationStatus('Verification complete.'); },
        'expired-callback': () => { setTurnstileToken(''); setVerificationStatus('Verification expired.'); },
        'error-callback': () => { setTurnstileToken(''); setVerificationStatus('Security check failed. Try again.'); }
      });
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-ranknova-turnstile]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.ranknovaTurnstile = '1';
      document.head.appendChild(script);
    }
    script.addEventListener('load', renderWidget);
    renderWidget();
    const interval = window.setInterval(() => {
      renderWidget();
      attempts++;
      if (attempts >= 60) window.clearInterval(interval);
    }, 500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      script?.removeEventListener('load', renderWidget);
      if (widgetIdRef.current) {
        try { (window as any).turnstile?.remove(widgetIdRef.current); } catch { /* widget already removed */ }
        widgetIdRef.current = null;
      }
      setTurnstileToken('');
    };
  }, [method]);

  const title = toWord ? 'PDF to Word Converter' : 'Word to PDF Converter';
  const ext = toWord ? '.pdf' : '.docx';
  const outputExt = toWord ? '.docx' : '.pdf';

  const convert = async () => {
    if (!file || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      let blob: Blob;
      if (method === 'adobe') {
        if (!ADOBE_READY) throw new Error('Adobe conversion is not connected yet.');
        if (!turnstileToken) throw new Error('Complete the anti-bot verification first.');
        const form = new FormData();
        form.append('file', file);
        form.append('turnstileToken', turnstileToken);
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 120000);
        try {
          const response = await fetch(API_URL + '/api/convert/' + mode, { method: 'POST', body: form, signal: controller.signal });
          if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(typeof data?.error === 'string' ? data.error : response.status === 429 ? 'Conversion limit reached. Please retry later.' : 'Adobe conversion failed.');
          }
          blob = await response.blob();
        } finally {
          window.clearTimeout(timer);
          setTurnstileToken('');
          if (widgetIdRef.current) (window as any).turnstile?.reset(widgetIdRef.current);
        }
        const header = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
        if (toWord ? (header[0] !== 0x50 || header[1] !== 0x4B) : new TextDecoder().decode(header) !== '%PDF-') {
          throw new Error('Adobe did not return a valid converted file.');
        }
      } else {
        blob = await convertLocally(file, mode);
      }
      if (!blob.size) throw new Error('Conversion produced an empty file.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name.replace(/\.[^.]+$/, '') + outputExt;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice(method === 'adobe' ? 'Adobe converted the document. Review the downloaded file before sharing it.' : 'Basic browser conversion completed. Review formatting in the downloaded file.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed. Please try another document.');
    } finally { setBusy(false); }
  };

  return <section className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
    <SEOHead title={title + ' | RankNova'} description={toWord ? 'Convert PDF text to editable DOCX using browser processing or an optional conversion server. Scanned PDFs and complex formatting are not supported.' : 'Convert Word DOCX to PDF using browser processing or an optional conversion server. Basic text only; complex formatting and non-Latin scripts are not supported.'} canonicalPath={'/' + mode} />
    <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
    <p className="mt-3 text-slate-600">{toWord ? 'Extract selectable text from PDFs into editable DOCX. Scanned PDFs, images, tables and precise layouts are not preserved in basic browser mode.' : 'Convert basic DOCX text into PDF. Images, tables, styles and complex layouts are not preserved in basic browser mode; some non-Latin scripts are unsupported.'}</p>
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <label htmlFor="document-upload" className="block text-sm font-semibold text-slate-900">Select {ext.toUpperCase()} file (maximum 10 MB)</label>
      <input id="document-upload" className="mt-3 block w-full text-sm" type="file" accept={toWord ? '.pdf,application/pdf' : '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'} onChange={e => {
        setError(''); setNotice(''); const selected = e.target.files?.[0] || null;
        if (!selected) { setFile(null); return; }
        if (!selected.name.toLowerCase().endsWith(ext) || selected.size > MAX_BYTES || selected.size === 0) {
          setFile(null); setError('Choose a valid ' + ext + ' file smaller than 10 MB.'); return;
        }
        setFile(selected);
      }} />
      <fieldset className="mt-5 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-bold text-slate-800">Conversion method</legend>
        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input type="radio" name="conversion-method" checked={method === 'browser'} onChange={() => { setMethod('browser'); setError(''); }} className="mt-1" />
          <span><strong>Free browser conversion</strong><span className="block text-xs text-slate-500">Basic text conversion; file stays on your device. Complex layout and fonts may be lost.</span></span>
        </label>
        <label className="mt-3 flex items-start gap-2 text-sm text-slate-800">
          <input type="radio" name="conversion-method" checked={method === 'adobe'} disabled={!ADOBE_READY} onChange={() => { setMethod('adobe'); setError(''); }} className="mt-1" />
          <span><strong>Adobe PDF Services cloud conversion</strong><span className="block text-xs text-slate-500">{ADOBE_READY ? 'Adobe processes the uploaded file on its servers. Complete a security check to continue.' : 'Not connected yet: requires a deployed secure backend, Adobe credentials and Turnstile.'}</span></span>
        </label>
      </fieldset>
      {method === 'adobe' && ADOBE_READY && <>
        <p className="mt-3 text-xs text-amber-900 rounded-lg border border-amber-200 bg-amber-50 p-3">Your document will be uploaded to Adobe PDF Services for conversion. Adobe's data handling policies apply. Avoid uploading confidential files without permission. Choosing Adobe cloud conversion is optional.</p>
        <div ref={widgetElementRef} className="mt-3" aria-label="Anti-bot verification" />
        {verificationStatus && <p className="mt-2 text-xs text-slate-600">{verificationStatus}</p>}
      </>}
      <button type="button" disabled={!file || busy || (method === 'adobe' && !turnstileToken)} onClick={convert} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Converting…' : method === 'adobe' ? 'Convert with Adobe & download' : 'Convert in browser & download'}</button>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>}
    </div>
  </section>;
};
