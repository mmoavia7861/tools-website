import React, { useState } from 'react';
import { SEOHead } from '../components/SEOHead';

type Mode = 'pdf-to-word' | 'word-to-pdf';
const MAX_BYTES = 15 * 1024 * 1024;

export const DocumentConverterView: React.FC<{ mode: Mode }> = ({ mode }) => {
  const toWord = mode === 'pdf-to-word';
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const backend = (import.meta.env.VITE_CONVERTER_API_URL as string | undefined)?.replace(/\/$/, '');
  const title = toWord ? 'PDF to Word Converter' : 'Word to PDF Converter';
  const ext = toWord ? '.pdf' : '.docx';
  const outputExt = toWord ? '.docx' : '.pdf';

  const convert = async () => {
    if (!file || busy) return;
    if (!backend) { setError('Conversion service is not configured yet. Please try again later.'); return; }
    setBusy(true); setError(''); setNotice('');
    const form = new FormData();
    form.append('file', file);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(backend + '/api/convert/' + mode, {
        method: 'POST', body: form, signal: controller.signal
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Conversion failed. Please try another file.');
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error('The conversion service returned an empty file.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name.replace(/\.[^.]+$/, '') + outputExt;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice('Conversion completed. Your download should begin automatically.');
    } catch (e) {
      setError(e instanceof Error && e.name === 'AbortError' ? 'Conversion timed out. Try a smaller document.' : e instanceof Error ? e.message : 'Conversion failed.');
    } finally { window.clearTimeout(timeout); setBusy(false); }
  };

  return <section className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
    <SEOHead title={title + ' | RankNova'} description={toWord ? 'Convert text-based PDFs to editable Word DOCX documents. Complex layouts and scanned PDFs may need manual corrections.' : 'Convert DOCX Word documents to downloadable PDF files with server-side LibreOffice processing.'} canonicalPath={'/' + mode} />
    <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
    <p className="mt-3 text-slate-600">{toWord ? 'Convert text-based PDF files into editable Word documents. Scanned documents require OCR, which this tool does not provide.' : 'Convert Microsoft Word DOCX documents into PDF. Fonts and complex formatting may vary.'}</p>
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <label htmlFor="document-upload" className="block text-sm font-semibold text-slate-900">Select {ext.toUpperCase()} file (maximum 15 MB)</label>
      <input id="document-upload" className="mt-3 block w-full text-sm" type="file" accept={toWord ? '.pdf,application/pdf' : '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'} onChange={e => {
        setError(''); setNotice(''); const selected = e.target.files?.[0] || null;
        if (!selected) { setFile(null); return; }
        if (!selected.name.toLowerCase().endsWith(ext) || selected.size > MAX_BYTES || selected.size === 0) {
          setFile(null); setError('Choose a valid ' + ext + ' file smaller than 15 MB.'); return;
        }
        setFile(selected);
      }} />
      <p className="mt-3 text-xs text-slate-500">Files are sent to a conversion server and removed after processing. Avoid uploading confidential documents. Conversion is unavailable until the server is configured.</p>
      <button type="button" disabled={!file || busy || !backend} onClick={convert} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Converting…' : 'Convert and download'}</button>
      {!backend && <p role="status" className="mt-3 text-sm text-amber-700">This tool is awaiting secure backend deployment. No files are uploaded while unavailable.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>}
    </div>
  </section>;
};
