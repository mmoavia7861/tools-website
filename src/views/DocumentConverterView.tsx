import React, { useState } from 'react';
import { SEOHead } from '../components/SEOHead';

type Mode = 'pdf-to-word' | 'word-to-pdf';
const MAX_BYTES = 10 * 1024 * 1024;

async function convertLocally(file: File, mode: Mode): Promise<Blob> {
  const bytes = await file.arrayBuffer();
  if (mode === 'pdf-to-word') {
    if (new TextDecoder('latin1').decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('Invalid PDF file.');
    const pdfjs = await import('pdfjs-dist');
    // Vite must bundle the matching PDF.js worker; an unresolved bare package URL can fail in production.
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const { Document, Packer, Paragraph, TextRun } = await import('docx');
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, disableFontFace: true });
    const pdf = await loadingTask.promise;
    try {
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
    return await Packer.toBlob(doc);
    } finally {
      await pdf.destroy();
    }
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
    // The PDF standard font supports WinAnsi, not full Unicode; normalize typical Word punctuation.
    const normalized = raw.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...').replace(/\u00A0/g, ' ')
      .replace(/\u2022/g, '*').replace(/\u200B/g, '');
    if (/[^\x09\x20-\x7e\xa0-\xff]/.test(normalized)) {
      throw new Error('This free text converter cannot render some characters in the document. For Urdu, Arabic and complex Unicode fonts, use a full-fidelity converter.');
    }
    let line = '';
    for (const word of normalized.trim().split(/\s+/)) {
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
  const title = toWord ? 'PDF to Word Converter' : 'Word to PDF Converter';
  const ext = toWord ? '.pdf' : '.docx';
  const outputExt = toWord ? '.docx' : '.pdf';

  const convert = async () => {
    if (!file || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const blob = await convertLocally(file, mode);
      if (!blob.size) throw new Error('Conversion produced an empty file.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name.replace(/\.[^.]+$/, '') + outputExt;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice('Free browser conversion completed. Review the downloaded file for formatting differences.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed. Please try another document.');
    } finally { setBusy(false); }
  };

  return <section className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
    <SEOHead title={title + ' | ToolsCresta'} description={toWord ? 'Convert PDF text to editable DOCX privately in your browser without signup or an API key. Scanned PDFs and complex formatting are not supported.' : 'Convert Word DOCX to PDF using browser processing or an optional conversion server. Basic text only; complex formatting and non-Latin scripts are not supported.'} canonicalPath={'/' + mode} />
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
      <p className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        Free conversion runs on your device. No Adobe account, API key, upload or payment is required.
        This is text-focused conversion; scanned PDFs require OCR and rich Word layouts are not preserved.
      </p>
      <button type="button" disabled={!file || busy} onClick={convert} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? 'Converting…' : 'Convert free & download'}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>}
    </div>
  </section>;
};
