import React, { useState, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  Download,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  RotateCcw,
  Sliders,
  Cpu,
  Server
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { AdSlot } from '../components/AdSlot';
import {
  validatePdfBytes,
  formatBytes,
  optimizePdfLocally,
  type CompressionPreset,
  type CompressionResult
} from '../utils/pdf';

export const PDFCompressorView: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<Uint8Array | null>(null);
  const [preset, setPreset] = useState<CompressionPreset>('balanced');
  const [processingMode, setProcessingMode] = useState<'on-device' | 'server'>('on-device');

  // Execution states
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);
    setCompressionResult(null);

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

      setSelectedFile(file);
      setFileBuffer(buffer);
    } catch {
      setErrorMessage('Could not read the selected file.');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleCompress = async () => {
    if (!fileBuffer || !selectedFile) return;

    setIsProcessing(true);
    setProgress(15);
    setErrorMessage(null);
    setCompressionResult(null);

    try {
      if (processingMode === 'on-device') {
        setProgress(40);
        // On-device optimization
        const result = await optimizePdfLocally(fileBuffer, preset);
        setProgress(100);
        setCompressionResult(result);
      } else {
        // Server-side fallback optimization route
        setProgress(30);
        const base64Data = btoa(
          new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        setProgress(60);
        const response = await fetch('/api/compress-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64: base64Data,
            preset
          })
        });

        if (!response.ok) {
          const errorJson = await response.json();
          throw new Error(errorJson.error || 'Server-side compression failed.');
        }

        const data = await response.json();
        const binaryString = atob(data.outputBase64);
        const outputBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          outputBytes[i] = binaryString.charCodeAt(i);
        }

        setProgress(100);
        setCompressionResult({
          success: true,
          originalSize: data.originalSize,
          compressedSize: data.compressedSize,
          reductionPercentage: data.reductionPercentage,
          outputData: outputBytes,
          method: 'server',
          message: data.message,
          isReduced: data.isReduced
        });
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred during compression.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!compressionResult || !selectedFile) return;

    const blob = new Blob([compressionResult.outputData as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const baseName = selectedFile.name.replace(/\.pdf$/i, '');
    a.href = url;
    a.download = `${baseName}-compressed.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFileBuffer(null);
    setCompressionResult(null);
    setErrorMessage(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <SEOHead
        title="Compress PDF Online — Reduce PDF File Size | RankNova"
        description="Compress PDF files online with adjustable quality settings. See real before-and-after file sizes and download the smaller PDF securely. On-device privacy first."
        canonicalPath="/compress-pdf"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'RankNova PDF Compressor',
          applicationCategory: 'UtilityApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
        }}
      />

      <div className="py-10 bg-[#F8FAFC]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200/80 mb-3">
              <FileText className="h-3.5 w-3.5" />
              <span>Honest Compression • Zero File Retention</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Compress PDF Documents
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Reduce PDF file size for easy email sharing and uploads. Compares genuine before-and-after byte counts with total privacy.
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-10 space-y-8">
            {/* Step 1: Upload or Drop Zone */}
            {!selectedFile ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center hover:border-blue-500 hover:bg-blue-50/20 transition group"
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
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 group-hover:scale-105 transition">
                  <UploadCloud className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">
                  Click to select or drag & drop your PDF
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Standard PDF files up to 25 MB supported. Evaluated client-side.
                </p>
              </div>
            ) : (
              /* Selected File Summary & Controls */
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 truncate max-w-xs sm:max-w-md">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Original Size: {formatBytes(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Choose another file</span>
                  </button>
                </div>

                {/* Compression Level Presets */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <Sliders className="h-4 w-4 text-blue-600" />
                    <span>Select Compression Preset</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setPreset('light')}
                      className={`p-4 rounded-xl border text-left transition ${
                        preset === 'light'
                          ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-600'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block font-bold text-sm text-slate-900">Light Compression</span>
                      <span className="block text-xs text-slate-500 mt-1">
                        Compacts cross-reference tables and retains complete image fidelity.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreset('balanced')}
                      className={`p-4 rounded-xl border text-left transition ${
                        preset === 'balanced'
                          ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-600'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="block font-bold text-sm text-slate-900">Balanced</span>
                        <span className="text-[10px] font-semibold uppercase bg-blue-600 text-white rounded-md px-1.5 py-0.5">
                          Recommended
                        </span>
                      </div>
                      <span className="block text-xs text-slate-500 mt-1">
                        Prunes redundant metadata and optimizes stream dictionaries.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreset('strong')}
                      className={`p-4 rounded-xl border text-left transition ${
                        preset === 'strong'
                          ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-600'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block font-bold text-sm text-slate-900">Strong Compression</span>
                      <span className="block text-xs text-slate-500 mt-1">
                        Aggressively strips unreferenced objects and cleans dictionary tables.
                      </span>
                    </button>
                  </div>
                </div>

                {/* Processing Mode Selection */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Processing Pipeline
                  </label>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                      <input
                        type="radio"
                        name="procMode"
                        checked={processingMode === 'on-device'}
                        onChange={() => setProcessingMode('on-device')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <Cpu className="h-4 w-4 text-emerald-600" />
                      <span>On-Device Browser Optimization (Private, file never leaves device)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                      <input
                        type="radio"
                        name="procMode"
                        checked={processingMode === 'server'}
                        onChange={() => setProcessingMode('server')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <Server className="h-4 w-4 text-indigo-600" />
                      <span>Secure Server Worker (Isolated memory, immediate deletion)</span>
                    </label>
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleCompress}
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-6 font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {isProcessing ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Optimizing Document ({progress}%)...</span>
                      </>
                    ) : (
                      <span>Compress Document Now</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Compression Notice</p>
                  <p className="mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Results Display */}
            {compressionResult && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-2 text-emerald-700 text-sm font-bold">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span>Optimization Completed</span>
                </div>

                {/* Before / After Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl p-4 border border-slate-200 text-center">
                    <span className="text-xs text-slate-500 uppercase tracking-wider block">Original Size</span>
                    <span className="text-lg font-bold text-slate-800 mt-1 block">
                      {formatBytes(compressionResult.originalSize)}
                    </span>
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-slate-200 text-center">
                    <span className="text-xs text-slate-500 uppercase tracking-wider block">Compressed Size</span>
                    <span className="text-lg font-bold text-slate-900 mt-1 block">
                      {formatBytes(compressionResult.compressedSize)}
                    </span>
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-slate-200 text-center">
                    <span className="text-xs text-slate-500 uppercase tracking-wider block">Reduction</span>
                    <span
                      className={`text-lg font-bold mt-1 block ${
                        compressionResult.isReduced ? 'text-emerald-600' : 'text-slate-600'
                      }`}
                    >
                      {compressionResult.reductionPercentage > 0
                        ? `-${compressionResult.reductionPercentage}%`
                        : 'Already Optimized'}
                    </span>
                  </div>
                </div>

                {/* Honest Explanatory Message */}
                <p className="text-xs text-slate-600 leading-relaxed bg-white rounded-xl p-4 border border-slate-200">
                  {compressionResult.message}
                </p>

                {/* Download Button */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 px-6 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Optimized PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Compress Another
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reserved Ad Location */}
          <div className="mt-12">
            <AdSlot slotId="pdf-page-bottom" format="horizontal" />
          </div>

          {/* Educational Content & Privacy Notice */}
          <div className="mt-16 bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-12 space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                How PDF Compression Actually Works
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                PDF documents are compound binary containers. Rather than rasterizing entire pages into blurry images,
                RankNova uses mathematical optimization to compress document structure without compromising text clarity.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Object Stream Compaction</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  In unoptimized PDFs, cross-reference tables and font descriptors exist as uncompressed ASCII strings.
                  Packaging these dictionaries into FlateDecode object streams saves substantial space without loss.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Pruning Duplicate Metadata</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Editing software often leaves behind invisible XML packets, thumbnail caches, and redundant font subsets.
                  Cleaning these unused pointers reduces file footprint cleanly.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Why We Report Honestly</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  If a document is already compressed, attempting further lossy degradation ruins legibility.
                  RankNova reports real before-and-after byte counts honestly and never fabricates artificial savings percentages.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
