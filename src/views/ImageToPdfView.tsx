import React, { useState, useRef } from 'react';
import {
  Images,
  UploadCloud,
  Download,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FileText,
  Sliders,
  Plus,
  Eye,
  Edit3,
  Stamp,
  Hash,
  X
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { AdSlot } from '../components/AdSlot';
import { formatBytes } from '../utils/pdf';
import { validateImageSignature } from '../utils/image';
import {
  convertImagesToPdf,
  type ImageInputItem,
  type PageSizeOption,
  type PageOrientationOption,
  type PageMarginOption
} from '../utils/imageToPdf';

export const ImageToPdfView: React.FC = () => {
  const [imageList, setImageList] = useState<ImageInputItem[]>([]);

  // Layout & Global PDF editing options
  const [pageSize, setPageSize] = useState<PageSizeOption>('a4');
  const [orientation, setOrientation] = useState<PageOrientationOption>('auto');
  const [margin, setMargin] = useState<PageMarginOption>('none');
  const [pdfFileName, setPdfFileName] = useState('ranknova-converted-document');

  // PDF Stamp & Page Numbering Edit Options
  const [addPageNumbers, setAddPageNumbers] = useState(false);
  const [pageNumberPosition, setPageNumberPosition] = useState<'bottom-center' | 'bottom-right'>('bottom-center');
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.25);

  // Active page editing modal
  const [editingImage, setEditingImage] = useState<ImageInputItem | null>(null);

  // Conversion execution states
  const [isConverting, setIsConverting] = useState(false);
  const [convertedPdfBytes, setConvertedPdfBytes] = useState<Uint8Array | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processFiles = async (files: FileList | File[]) => {
    setErrorMessage(null);
    setConvertedPdfBytes(null);

    const newItems: ImageInputItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const buffer = new Uint8Array(await file.arrayBuffer());
        const validation = validateImageSignature(buffer);

        if (!validation.valid || !validation.format) {
          continue;
        }

        let finalFormat: 'png' | 'jpeg' = validation.format === 'png' ? 'png' : 'jpeg';
        let finalData = buffer;

        // If WebP, convert to PNG via canvas for pdf-lib embedding
        if (validation.format === 'webp') {
          const blobUrl = URL.createObjectURL(file);
          const img = new Image();
          await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = rej;
            img.src = blobUrl;
          });

          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);

          const pngBlob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
          finalData = new Uint8Array(await pngBlob.arrayBuffer());
          finalFormat = 'png';
          URL.revokeObjectURL(blobUrl);
        }

        const previewUrl = URL.createObjectURL(new Blob([finalData], { type: `image/${finalFormat}` }));

        newItems.push({
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name: file.name,
          data: finalData,
          format: finalFormat,
          previewUrl,
          size: file.size,
          rotation: 0,
          grayscale: false
        });
      } catch (err) {
        console.error('Error reading image file:', err);
      }
    }

    if (newItems.length === 0 && files.length > 0) {
      setErrorMessage('None of the selected files were valid PNG, JPG, or WebP images.');
      return;
    }

    setImageList((prev) => [...prev, ...newItems]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= imageList.length) return;

    const updated = [...imageList];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setImageList(updated);
    setConvertedPdfBytes(null);
  };

  const rotateItem = (id: string) => {
    setImageList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newRot = ((item.rotation || 0) + 90) % 360;
          return { ...item, rotation: newRot };
        }
        return item;
      })
    );
    setConvertedPdfBytes(null);
  };

  // Convert image to B&W / Grayscale Document scan mode via Canvas
  const toggleGrayscale = async (id: string) => {
    const target = imageList.find((x) => x.id === id);
    if (!target) return;

    try {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = target.previewUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;

      const newGrayscale = !target.grayscale;
      if (newGrayscale) {
        ctx.filter = 'grayscale(100%) contrast(125%)';
      } else {
        ctx.filter = 'none';
      }
      ctx.drawImage(img, 0, 0);

      const mime = target.format === 'png' ? 'image/png' : 'image/jpeg';
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), mime, 0.92));
      const newData = new Uint8Array(await blob.arrayBuffer());

      URL.revokeObjectURL(target.previewUrl);
      const newPreview = URL.createObjectURL(blob);

      setImageList((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, data: newData, previewUrl: newPreview, grayscale: newGrayscale }
            : item
        )
      );
      setConvertedPdfBytes(null);
    } catch (e) {
      console.error('Grayscale processing error:', e);
    }
  };

  const removeItem = (id: string) => {
    const item = imageList.find((x) => x.id === id);
    if (item) URL.revokeObjectURL(item.previewUrl);
    setImageList((prev) => prev.filter((x) => x.id !== id));
    setConvertedPdfBytes(null);
  };

  const clearAll = () => {
    imageList.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImageList([]);
    setConvertedPdfBytes(null);
    setErrorMessage(null);
  };

  const handleConvert = async () => {
    if (imageList.length === 0) return;

    setIsConverting(true);
    setErrorMessage(null);
    setConvertedPdfBytes(null);

    try {
      const pdfBytes = await convertImagesToPdf(
        imageList.map((img) => ({
          data: img.data,
          format: img.format,
          rotation: img.rotation
        })),
        {
          pageSize,
          orientation,
          margin,
          addPageNumbers,
          pageNumberPosition,
          watermarkText,
          watermarkOpacity
        }
      );
      setConvertedPdfBytes(pdfBytes);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate and edit PDF.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!convertedPdfBytes) return;

    const blob = new Blob([convertedPdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pdfFileName.trim() || 'edited-document'}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <SEOHead
        title="Image to PDF Converter & Editor — Edit, Rotate & Convert | RankNova"
        description="Convert JPG and PNG images to PDF and edit document pages: rotate pages, add page numbering, stamp watermarks, and reorder on-device with zero file uploads."
        canonicalPath="/image-to-pdf"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'RankNova Image to PDF Converter and Editor',
          applicationCategory: 'UtilityApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
        }}
      />

      <div className="py-10 bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80 mb-3">
              <Edit3 className="h-3.5 w-3.5" />
              <span>Full Page Editing • Rotate, Watermark &amp; Page Numbers</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Image to PDF Converter &amp; Editor
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Convert and edit your document pages. Reorder, rotate 90°/180°, enhance scan contrast,
              add page numbers, and stamp custom watermarks—100% on-device.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 Cols: Image List, Editor Cards and Drop Zone */}
            <div className="lg:col-span-7 space-y-6">
              {/* Drop / Select Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-slate-300 rounded-2xl p-7 text-center hover:border-blue-500 hover:bg-blue-50/20 transition group bg-white shadow-2xs"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      processFiles(e.target.files);
                    }
                  }}
                />
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-105 transition">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">
                  Click to select images or drag &amp; drop here
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  PNG, JPG, or WebP files. Edit rotation and order per page.
                </p>
              </div>

              {/* Error Notice */}
              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Page Editor List */}
              {imageList.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Document Pages ({imageList.length} {imageList.length === 1 ? 'Page' : 'Pages'})
                    </span>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                    {imageList.map((img, index) => (
                      <div
                        key={img.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition"
                      >
                        {/* Page preview & details */}
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white font-bold text-xs shrink-0">
                            {index + 1}
                          </span>
                          <div className="relative h-14 w-14 rounded-lg border border-slate-200 overflow-hidden bg-white shrink-0 flex items-center justify-center">
                            <img
                              src={img.previewUrl}
                              alt={img.name}
                              className="max-h-full max-w-full object-contain transition-transform duration-200"
                              style={{ transform: `rotate(${img.rotation || 0}deg)` }}
                            />
                            {img.rotation ? (
                              <span className="absolute bottom-0.5 right-0.5 bg-slate-900/80 text-white text-[9px] font-mono px-1 rounded">
                                {img.rotation}°
                              </span>
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {img.name}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {formatBytes(img.size)} • {img.format.toUpperCase()}
                              {img.grayscale ? ' • B&W Mode' : ''}
                            </p>
                          </div>
                        </div>

                        {/* Page Edit Controls */}
                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          {/* Rotate Page */}
                          <button
                            type="button"
                            onClick={() => rotateItem(img.id)}
                            className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                            title="Rotate Page 90° Clockwise"
                          >
                            <RotateCw className="h-3.5 w-3.5 text-blue-600" />
                            <span>Rotate</span>
                          </button>

                          {/* B&W / Grayscale document filter */}
                          <button
                            type="button"
                            onClick={() => toggleGrayscale(img.id)}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                              img.grayscale
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                            }`}
                            title="Enhance for Document Scan (Black & White)"
                          >
                            <span>B&amp;W</span>
                          </button>

                          {/* Reorder Buttons */}
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveItem(index, 'up')}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30"
                            title="Move Page Up"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === imageList.length - 1}
                            onClick={() => moveItem(index, 'down')}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30"
                            title="Move Page Down"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete Page */}
                          <button
                            type="button"
                            onClick={() => removeItem(img.id)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                            title="Remove Page"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-600 hover:border-blue-500 hover:text-blue-600 transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add More Pages</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right 5 Cols: Document Settings & PDF Edit Toolbar */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Sliders className="h-4 w-4 text-blue-600" />
                    <span>PDF Document &amp; Page Settings</span>
                  </h3>
                </div>

                {/* Page Size */}
                <div>
                  <label htmlFor="pg-size-select" className="block text-xs font-medium text-slate-700 mb-1">
                    Page Dimensions
                  </label>
                  <select
                    id="pg-size-select"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(e.target.value as any);
                      setConvertedPdfBytes(null);
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="a4">A4 (210 x 297 mm — Standard)</option>
                    <option value="letter">US Letter (8.5 x 11 inches)</option>
                    <option value="fit">Fit to Image (No padding borders)</option>
                  </select>
                </div>

                {/* Page Orientation */}
                {pageSize !== 'fit' && (
                  <div>
                    <label htmlFor="pg-orient-select" className="block text-xs font-medium text-slate-700 mb-1">
                      Orientation
                    </label>
                    <select
                      id="pg-orient-select"
                      value={orientation}
                      onChange={(e) => {
                        setOrientation(e.target.value as any);
                        setConvertedPdfBytes(null);
                      }}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="auto">Auto (Match each page orientation)</option>
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                )}

                {/* Margins */}
                <div>
                  <label htmlFor="pg-margin-select" className="block text-xs font-medium text-slate-700 mb-1">
                    Page Margins
                  </label>
                  <select
                    id="pg-margin-select"
                    value={margin}
                    onChange={(e) => {
                      setMargin(e.target.value as any);
                      setConvertedPdfBytes(null);
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="none">No Margins (Edge-to-edge)</option>
                    <option value="small">Small Margins (Clean border)</option>
                    <option value="big">Wide Margins (Frame style)</option>
                  </select>
                </div>

                {/* PDF Edit Option 1: Page Numbers */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={addPageNumbers}
                        onChange={(e) => {
                          setAddPageNumbers(e.target.checked);
                          setConvertedPdfBytes(null);
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <Hash className="h-3.5 w-3.5 text-blue-600" />
                      <span>Add Page Numbers to PDF</span>
                    </label>
                  </div>

                  {addPageNumbers && (
                    <div className="pl-5 pt-1">
                      <select
                        value={pageNumberPosition}
                        onChange={(e) => {
                          setPageNumberPosition(e.target.value as any);
                          setConvertedPdfBytes(null);
                        }}
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
                      >
                        <option value="bottom-center">Bottom Center (e.g. &quot;1 / 5&quot;)</option>
                        <option value="bottom-right">Bottom Right Corner</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* PDF Edit Option 2: Watermark Text */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label htmlFor="pdf-watermark" className="block text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Stamp className="h-3.5 w-3.5 text-purple-600" />
                    <span>Stamp Text Watermark (Optional)</span>
                  </label>
                  <input
                    id="pdf-watermark"
                    type="text"
                    value={watermarkText}
                    onChange={(e) => {
                      setWatermarkText(e.target.value);
                      setConvertedPdfBytes(null);
                    }}
                    placeholder="e.g. CONFIDENTIAL, DRAFT, SAMPLE"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                  {watermarkText.trim() !== '' && (
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>Watermark Opacity: {Math.round(watermarkOpacity * 100)}%</span>
                      <input
                        type="range"
                        min={0.1}
                        max={0.6}
                        step={0.05}
                        value={watermarkOpacity}
                        onChange={(e) => {
                          setWatermarkOpacity(parseFloat(e.target.value));
                          setConvertedPdfBytes(null);
                        }}
                        className="w-24 accent-blue-600"
                      />
                    </div>
                  )}
                </div>

                {/* Output Filename */}
                <div>
                  <label htmlFor="pdf-fname" className="block text-xs font-medium text-slate-700 mb-1">
                    PDF Document Name
                  </label>
                  <div className="flex items-center">
                    <input
                      id="pdf-fname"
                      type="text"
                      value={pdfFileName}
                      onChange={(e) => setPdfFileName(e.target.value)}
                      className="w-full rounded-l-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                    <span className="rounded-r-xl border border-l-0 border-slate-300 bg-slate-100 px-3 py-2 text-xs font-mono text-slate-500">
                      .pdf
                    </span>
                  </div>
                </div>

                {/* Convert & Generate Button */}
                <button
                  type="button"
                  disabled={imageList.length === 0 || isConverting}
                  onClick={handleConvert}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-6 font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {isConverting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Generating PDF Document...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      <span>Generate &amp; Export PDF ({imageList.length} Pages)</span>
                    </>
                  )}
                </button>

                {/* Result & Download */}
                {convertedPdfBytes && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>PDF Document Ready</span>
                    </div>
                    <p className="text-xs text-emerald-700">
                      Output Size: <strong>{formatBytes(convertedPdfBytes.byteLength)}</strong> ({imageList.length} edited pages)
                    </p>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 px-4 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download {pdfFileName || 'document'}.pdf</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Privacy Callout */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Local On-Device Processing</p>
                  <p className="mt-0.5 text-emerald-800">
                    Image rotation, contrast filters, watermarking, and PDF compilation run entirely inside your browser.
                    Zero documents or images leave your device.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Reserved Ad */}
          <div className="mt-12">
            <AdSlot slotId="img2pdf-page-bottom" format="horizontal" />
          </div>

          {/* Educational SEO Content */}
          <div className="mt-16 bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-12 space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                How to Convert and Edit Images to PDF Online
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                RankNova gives you granular control over every page before compiling your final PDF document.
                Fix upside-down photos with 90° rotation, enhance contrast for readable document scans, and apply page numbering automatically.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Rotate Individual Pages</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Mobile camera photos often upload with incorrect EXIF orientations. Click &quot;Rotate&quot; to orient each page horizontally or vertically before PDF rendering.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Add Watermarks &amp; Numbers</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Protect confidential documents with a diagonal watermark stamp and keep multi-page document packages organized with automatic footer pagination.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Scan Enhancement Filter</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Use the B&amp;W filter to increase contrast on document scans and receipts, eliminating yellow shadows and making text crisp for official submissions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
