import React, { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  FileText,
  UploadCloud,
  Download,
  RotateCw,
  Trash2,
  Copy,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sliders,
  Hash,
  Stamp,
  Layers,
  Sparkles
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { AdSlot } from '../components/AdSlot';
import { formatBytes, validatePdfBytes } from '../utils/pdf';
import {
  editExistingPdf,
  type PageEditState
} from '../utils/pdfEditor';

interface PageDisplayItem {
  id: string;
  originalIndex: number;
  rotation: number;
  width: number;
  height: number;
}

export const PDFEditorView: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourcePdfBytes, setSourcePdfBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PageDisplayItem[]>([]);

  // Document-level options
  const [addPageNumbers, setAddPageNumbers] = useState(false);
  const [pageNumberPosition, setPageNumberPosition] = useState<'bottom-center' | 'bottom-right' | 'top-right'>('bottom-center');
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.2);
  const [outputFileName, setOutputFileName] = useState('ranknova-edited-document');

  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [editedPdfBytes, setEditedPdfBytes] = useState<Uint8Array | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);
    setEditedPdfBytes(null);

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please select a valid PDF file with a .pdf extension.');
      return;
    }

    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const validation = validatePdfBytes(buffer);

      if (!validation.valid) {
        setErrorMessage(validation.error || 'Invalid PDF file.');
        return;
      }

      const doc = await PDFDocument.load(buffer, { ignoreEncryption: false });
      if (doc.isEncrypted) {
        setErrorMessage('Password-protected or encrypted PDFs cannot be edited without credentials.');
        return;
      }

      const pageCount = doc.getPageCount();
      const pageItems: PageDisplayItem[] = [];

      for (let i = 0; i < pageCount; i++) {
        const page = doc.getPage(i);
        const { width, height } = page.getSize();
        pageItems.push({
          id: `page-${i}-${Date.now()}`,
          originalIndex: i,
          rotation: 0,
          width: Math.round(width),
          height: Math.round(height)
        });
      }

      setSelectedFile(file);
      setSourcePdfBytes(buffer);
      setPages(pageItems);
      setOutputFileName(file.name.replace(/\.pdf$/i, '-edited'));
    } catch {
      setErrorMessage('Could not decode or parse the selected PDF file.');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const rotatePage = (index: number) => {
    setPages((prev) =>
      prev.map((p, i) => (i === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
    setEditedPdfBytes(null);
  };

  const rotateAllPages = () => {
    setPages((prev) =>
      prev.map((p) => ({ ...p, rotation: (p.rotation + 90) % 360 }))
    );
    setEditedPdfBytes(null);
  };

  const resetAllRotations = () => {
    setPages((prev) =>
      prev.map((p) => ({ ...p, rotation: 0 }))
    );
    setEditedPdfBytes(null);
  };

  const movePage = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;

    const updated = [...pages];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setPages(updated);
    setEditedPdfBytes(null);
  };

  const duplicatePage = (index: number) => {
    const target = pages[index];
    const duplicated: PageDisplayItem = {
      id: `page-dup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      originalIndex: target.originalIndex,
      rotation: target.rotation,
      width: target.width,
      height: target.height
    };
    const updated = [...pages];
    updated.splice(index + 1, 0, duplicated);
    setPages(updated);
    setEditedPdfBytes(null);
  };

  const deletePage = (index: number) => {
    if (pages.length <= 1) {
      setErrorMessage('A PDF document must have at least one page.');
      return;
    }
    const updated = pages.filter((_, i) => i !== index);
    setPages(updated);
    setEditedPdfBytes(null);
  };

  const handleExportEditedPdf = async () => {
    if (!sourcePdfBytes || pages.length === 0) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setEditedPdfBytes(null);

    try {
      const pageStates: PageEditState[] = pages.map((p) => ({
        originalIndex: p.originalIndex,
        rotation: p.rotation
      }));

      const resultBytes = await editExistingPdf(sourcePdfBytes, {
        pageStates,
        watermarkText,
        watermarkOpacity,
        addPageNumbers,
        pageNumberPosition
      });

      setEditedPdfBytes(resultBytes);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to apply PDF edits.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!editedPdfBytes) return;

    const blob = new Blob([editedPdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${outputFileName.trim() || 'edited-document'}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setSourcePdfBytes(null);
    setPages([]);
    setEditedPdfBytes(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <SEOHead
        title="Free PDF Editor Online — Edit, Rotate, Reorder & Annotate PDFs | RankNova"
        description="Edit PDF files online for free. Rotate pages, reorder pages, delete unwanted pages, add text watermarks, and stamp page numbers with 100% on-device privacy."
        canonicalPath="/edit-pdf"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'RankNova PDF Editor',
          applicationCategory: 'UtilityApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
        }}
      />

      <div className="py-10 bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80 mb-3">
              <FileText className="h-3.5 w-3.5" />
              <span>Full Page Management • 100% On-Device Privacy</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Free PDF Editor
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Rotate pages, arrange page sequences, delete unnecessary pages, stamp watermarks, and insert page numbers.
              Processed entirely on your device without server uploads.
            </p>
          </div>

          {!selectedFile ? (
            /* Upload Zone */
            <div className="max-w-3xl mx-auto">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:border-blue-500 hover:bg-blue-50/20 transition group bg-white shadow-xs"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-105 transition">
                  <UploadCloud className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">
                  Select or drag &amp; drop your PDF to edit
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Standard PDF files up to 35 MB supported. Client-side processing.
                </p>
              </div>

              {errorMessage && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          ) : (
            /* Editor Workspace */
            <div className="space-y-8">
              {/* Top Document Summary & Global Toolbar */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shrink-0">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Original Size: {formatBytes(selectedFile.size)} • {pages.length} Pages
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={rotateAllPages}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <RotateCw className="h-3.5 w-3.5 text-blue-600" />
                    <span>Rotate All 90°</span>
                  </button>

                  <button
                    type="button"
                    onClick={resetAllRotations}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                    <span>Reset Rotations</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                  >
                    Open Another PDF
                  </button>
                </div>
              </div>

              {/* Main Editing Grid: Left Pages (8 Cols) vs Right Settings (4 Cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left 8 Cols: Visual Page Cards */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-xs">
                      Pages in Document ({pages.length})
                    </h2>
                    <span className="text-xs text-slate-400">
                      Drag or use arrows to rearrange sequence
                    </span>
                  </div>

                  {errorMessage && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Grid of Pages */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {pages.map((p, idx) => (
                      <div
                        key={p.id}
                        className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:shadow-md hover:border-blue-400 transition"
                      >
                        {/* Page Header */}
                        <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                          <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                            Page {idx + 1}
                          </span>
                          {p.rotation > 0 && (
                            <span className="text-[10px] font-mono text-blue-600 font-semibold">
                              {p.rotation}°
                            </span>
                          )}
                        </div>

                        {/* Page Canvas / Visual Placeholder */}
                        <div className="my-3 h-36 rounded-lg bg-slate-50 border border-slate-200/80 flex flex-col items-center justify-center p-2 text-center transition-transform duration-200 relative overflow-hidden">
                          <div
                            className="w-20 h-28 border border-slate-300 rounded shadow-2xs bg-white flex flex-col items-center justify-center p-1.5 transition-transform duration-200"
                            style={{ transform: `rotate(${p.rotation}deg)` }}
                          >
                            <FileText className="h-6 w-6 text-slate-300 mb-1" />
                            <div className="w-full h-1 bg-slate-200 rounded mb-1" />
                            <div className="w-3/4 h-1 bg-slate-200 rounded mb-1" />
                            <div className="w-1/2 h-1 bg-slate-200 rounded" />
                          </div>
                          <span className="text-[10px] text-slate-400 mt-2 font-mono">
                            Orig. #{p.originalIndex + 1} ({p.width}x{p.height})
                          </span>
                        </div>

                        {/* Page Action Controls */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => movePage(idx, 'left')}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20"
                              title="Move Left"
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === pages.length - 1}
                              onClick={() => movePage(idx, 'right')}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20"
                              title="Move Right"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => rotatePage(idx)}
                              className="p-1 rounded text-blue-600 hover:bg-blue-50"
                              title="Rotate Page 90°"
                            >
                              <RotateCw className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicatePage(idx)}
                              className="p-1 rounded text-slate-500 hover:bg-slate-100"
                              title="Duplicate Page"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deletePage(idx)}
                              className="p-1 rounded text-red-500 hover:bg-red-50"
                              title="Delete Page"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right 4 Cols: PDF Global Stamping & Export */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Sliders className="h-4 w-4 text-blue-600" />
                      <span>Document Annotations</span>
                    </h3>

                    {/* Page Numbers */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                        <input
                          type="checkbox"
                          checked={addPageNumbers}
                          onChange={(e) => {
                            setAddPageNumbers(e.target.checked);
                            setEditedPdfBytes(null);
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <Hash className="h-3.5 w-3.5 text-blue-600" />
                        <span>Stamp Page Numbers</span>
                      </label>

                      {addPageNumbers && (
                        <div className="pl-5 pt-1">
                          <label htmlFor="num-pos" className="block text-[11px] text-slate-500 mb-1">
                            Number Position
                          </label>
                          <select
                            id="num-pos"
                            value={pageNumberPosition}
                            onChange={(e) => {
                              setPageNumberPosition(e.target.value as any);
                              setEditedPdfBytes(null);
                            }}
                            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
                          >
                            <option value="bottom-center">Bottom Center (e.g. &quot;1 / 4&quot;)</option>
                            <option value="bottom-right">Bottom Right Corner</option>
                            <option value="top-right">Top Right Header</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Text Watermark */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <label htmlFor="edit-watermark" className="block text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Stamp className="h-3.5 w-3.5 text-purple-600" />
                        <span>Stamp Text Watermark</span>
                      </label>
                      <input
                        id="edit-watermark"
                        type="text"
                        value={watermarkText}
                        onChange={(e) => {
                          setWatermarkText(e.target.value);
                          setEditedPdfBytes(null);
                        }}
                        placeholder="e.g. CONFIDENTIAL, DRAFT"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                      {watermarkText.trim() !== '' && (
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                          <span>Opacity: {Math.round(watermarkOpacity * 100)}%</span>
                          <input
                            type="range"
                            min={0.1}
                            max={0.6}
                            step={0.05}
                            value={watermarkOpacity}
                            onChange={(e) => {
                              setWatermarkOpacity(parseFloat(e.target.value));
                              setEditedPdfBytes(null);
                            }}
                            className="w-24 accent-blue-600"
                          />
                        </div>
                      )}
                    </div>

                    {/* Filename */}
                    <div>
                      <label htmlFor="edit-fname" className="block text-xs font-medium text-slate-700 mb-1">
                        Export Filename
                      </label>
                      <div className="flex items-center">
                        <input
                          id="edit-fname"
                          type="text"
                          value={outputFileName}
                          onChange={(e) => setOutputFileName(e.target.value)}
                          className="w-full rounded-l-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                        <span className="rounded-r-xl border border-l-0 border-slate-300 bg-slate-100 px-3 py-2 text-xs font-mono text-slate-500">
                          .pdf
                        </span>
                      </div>
                    </div>

                    {/* Apply & Export Action */}
                    <button
                      type="button"
                      disabled={isProcessing || pages.length === 0}
                      onClick={handleExportEditedPdf}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-6 font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      {isProcessing ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Compiling Edited PDF...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>Apply Edits &amp; Export PDF ({pages.length} Pages)</span>
                        </>
                      )}
                    </button>

                    {/* Download Ready Box */}
                    {editedPdfBytes && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>Edited PDF Ready for Download</span>
                        </div>
                        <p className="text-xs text-emerald-700">
                          Export Size: <strong>{formatBytes(editedPdfBytes.byteLength)}</strong>
                        </p>
                        <button
                          type="button"
                          onClick={handleDownload}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 px-4 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download {outputFileName || 'edited-document'}.pdf</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Privacy Badge */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900 flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Pure Client-Side PDF Editing</p>
                      <p className="mt-0.5 text-emerald-800">
                        Page copying, rotation, and text stamping occur entirely in your browser&apos;s memory. Your original document is never uploaded to any cloud server.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reserved Ad */}
          <div className="mt-12">
            <AdSlot slotId="pdf-editor-bottom" format="horizontal" />
          </div>

          {/* Educational SEO Guide */}
          <div className="mt-16 bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-12 space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                How to Edit and Rearrange PDF Pages Online
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                RankNova gives you total control over multi-page PDF documents without installing heavy desktop software.
                Whether you need to rotate scanned pages, delete accidental duplicates, or reorder chapters, you can make surgical edits directly in your browser.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Rotate Any Page 90°</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Fix landscape pages trapped in portrait orientation with single-click 90-degree rotations, keeping your document presentation clean.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Delete and Duplicate</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Remove blank pages, delete disclaimers, or clone important pages with zero quality loss.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Stamp Watermarks &amp; Pagination</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Add custom diagonal watermarks for security or stamp page numbers automatically in the footer without disturbing original page vectors.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
