import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  UploadCloud,
  Download,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  RotateCcw,
  Palette,
  Layers,
  Sliders,
  Eye,
  Cpu,
  RefreshCw,
  Eraser,
  Paintbrush,
  Pipette,
  Undo2,
  ZoomIn
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { AdSlot } from '../components/AdSlot';
import {
  validateImageSignature,
  checkImageDimensionSafety,
  flattenImageToJpeg
} from '../utils/image';
import {
  removeBackgroundFromImageData,
  executeNeuralBackgroundRemoval,
  applyBrushStroke,
  type SegmentationOptions
} from '../utils/backgroundRemoval';

type BackdropMode = 'transparent' | 'solid' | 'bokeh';
type ToolMode = 'view' | 'eraser' | 'restore' | 'eyedropper';

export const BackgroundRemoverView: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Algorithm & Slider Controls
  const [engineMode, setEngineMode] = useState<'neural' | 'smart-vision'>('neural');
  const [tolerance, setTolerance] = useState<number>(34);
  const [featherRadius, setFeatherRadius] = useState<number>(2);
  const [protectCenter, setProtectCenter] = useState<boolean>(true);
  const [defringe, setDefringe] = useState<boolean>(true);
  const [customKeyColors, setCustomKeyColors] = useState<Array<{ r: number; g: number; b: number }>>([]);

  // Interactive Touch-Up Tools
  const [toolMode, setToolMode] = useState<ToolMode>('view');
  const [brushSize, setBrushSize] = useState<number>(24);
  const [isDrawing, setIsDrawing] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);

  // Backdrop preview & export options
  const [backdropMode, setBackdropMode] = useState<BackdropMode>('transparent');
  const [solidColor, setSolidColor] = useState<string>('#FFFFFF');
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');
  const [viewMode, setViewMode] = useState<'side-by-side' | 'split'>('side-by-side');
  const [splitPos, setSplitPos] = useState<number>(50);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const originalImageObjRef = useRef<HTMLImageElement | null>(null);
  const interactiveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Clean object URL on unmount
  useEffect(() => {
    return () => {
      if (originalImageUrl) URL.revokeObjectURL(originalImageUrl);
    };
  }, [originalImageUrl]);

  // Handle image file selection
  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);
    setStatusNotice(null);
    setProcessedImageUrl(null);
    setUndoStack([]);
    setCustomKeyColors([]);

    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const validation = validateImageSignature(buffer);

      if (!validation.valid) {
        setErrorMessage(validation.error || 'Invalid image file.');
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const dimCheck = checkImageDimensionSafety(img.naturalWidth, img.naturalHeight);
        if (!dimCheck.safe) {
          setErrorMessage(dimCheck.error || 'Image dimensions exceed safe processing limit.');
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setSelectedFile(file);
        setOriginalImageUrl(objectUrl);
        originalImageObjRef.current = img;
      };
      img.onerror = () => {
        setErrorMessage('Failed to decode image data.');
        URL.revokeObjectURL(objectUrl);
      };
      img.src = objectUrl;
    } catch {
      setErrorMessage('Could not read the selected image.');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  /**
   * Fast client-side smart vision segmentation.
   */
  const processWithSmartVision = useCallback(
    async (imageSrc: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not initialize 2D canvas context.');

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const options: SegmentationOptions = {
              tolerance,
              featherRadius,
              protectCenter,
              defringe,
              customKeyColors
            };

            removeBackgroundFromImageData(imageData, options);
            ctx.putImageData(imageData, 0, 0);

            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image into processing canvas.'));
        img.src = imageSrc;
      });
    },
    [tolerance, featherRadius, protectCenter, defringe, customKeyColors]
  );

  /**
   * Main Background Removal Execution
   */
  const handleRemoveBackground = async () => {
    if (!selectedFile || !originalImageUrl) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setStatusNotice(null);
    setProgressPercent(10);
    setProgressStage('Initializing background removal...');

    try {
      if (engineMode === 'neural') {
        try {
          setProgressStage('Running on-device Neural AI segmentation...');
          const neuralResultUrl = await executeNeuralBackgroundRemoval(
            selectedFile,
            (stage, percent) => {
              setProgressStage(stage);
              setProgressPercent(percent);
            }
          );
          setProcessedImageUrl(neuralResultUrl);
          setUndoStack([neuralResultUrl]);
          setStatusNotice('Background removed with deep learning Neural AI.');
          setIsProcessing(false);
          return;
        } catch (neuralErr) {
          console.warn('Neural network execution had issue, using Smart Vision:', neuralErr);
          setProgressStage('Falling back to high-speed Smart Vision engine...');
        }
      }

      // Smart Vision Engine
      const localResultUrl = await processWithSmartVision(originalImageUrl);
      setProcessedImageUrl(localResultUrl);
      setUndoStack([localResultUrl]);
      setStatusNotice('Background removed instantly with Smart Vision segmentation.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred during background removal.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Live adjustments when user tweaks tolerance or feathering in smart-vision mode
  useEffect(() => {
    if (processedImageUrl && originalImageUrl && engineMode === 'smart-vision') {
      const timer = setTimeout(async () => {
        try {
          const updatedUrl = await processWithSmartVision(originalImageUrl);
          setProcessedImageUrl(updatedUrl);
        } catch {
          // ignore transient adjustments
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [tolerance, featherRadius, protectCenter, defringe, customKeyColors, processWithSmartVision]);

  // Sync interactive canvas when processedImageUrl changes
  useEffect(() => {
    if (!processedImageUrl || !interactiveCanvasRef.current) return;
    const canvas = interactiveCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = processedImageUrl;
  }, [processedImageUrl]);

  // Push state to undo stack
  const saveUndoState = () => {
    if (!interactiveCanvasRef.current) return;
    const currentData = interactiveCanvasRef.current.toDataURL('image/png');
    setUndoStack((prev) => [...prev.slice(-10), currentData]);
  };

  // Undo brush action
  const handleUndo = () => {
    if (undoStack.length <= 1) return;
    const newStack = [...undoStack];
    newStack.pop(); // pop current
    const previous = newStack[newStack.length - 1];
    setUndoStack(newStack);
    setProcessedImageUrl(previous);
  };

  // Canvas mouse handlers for Eraser / Restore Brush / Eyedropper
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = interactiveCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (toolMode === 'view' || !interactiveCanvasRef.current) return;

    const { x, y } = getCanvasCoords(e);

    if (toolMode === 'eyedropper' && originalImageObjRef.current) {
      // Sample color from original image at x, y
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = originalImageObjRef.current.naturalWidth;
      tempCanvas.height = originalImageObjRef.current.naturalHeight;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(originalImageObjRef.current, 0, 0);
        const pixel = tCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        setCustomKeyColors((prev) => [...prev, { r: pixel[0], g: pixel[1], b: pixel[2] }]);
        setStatusNotice(`Sampled background color RGB(${pixel[0]}, ${pixel[1]}, ${pixel[2]}).`);
      }
      return;
    }

    if (toolMode === 'eraser' || toolMode === 'restore') {
      saveUndoState();
      setIsDrawing(true);
      const ctx = interactiveCanvasRef.current.getContext('2d');
      if (ctx && originalImageObjRef.current) {
        applyBrushStroke(ctx, originalImageObjRef.current, x, y, brushSize, toolMode === 'eraser' ? 'erase' : 'restore');
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || (toolMode !== 'eraser' && toolMode !== 'restore')) return;
    if (!interactiveCanvasRef.current || !originalImageObjRef.current) return;

    const { x, y } = getCanvasCoords(e);
    const ctx = interactiveCanvasRef.current.getContext('2d');
    if (ctx) {
      applyBrushStroke(ctx, originalImageObjRef.current, x, y, brushSize, toolMode === 'eraser' ? 'erase' : 'restore');
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDrawing && interactiveCanvasRef.current) {
      setIsDrawing(false);
      setProcessedImageUrl(interactiveCanvasRef.current.toDataURL('image/png'));
    }
  };

  // Download Handler
  const handleDownload = async () => {
    if (!processedImageUrl) return;

    const baseName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, '') : 'ranknova-cutout';

    if (exportFormat === 'png' && backdropMode === 'transparent') {
      const a = document.createElement('a');
      a.href = processedImageUrl;
      a.download = `${baseName}-transparent.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // Compose with solid or bokeh background
      try {
        const canvas = document.createElement('canvas');
        const img = new Image();
        img.src = processedImageUrl;
        await new Promise((r) => {
          img.onload = r;
        });

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (backdropMode === 'bokeh' && originalImageObjRef.current) {
          // Draw blurred bokeh background
          ctx.save();
          ctx.filter = 'blur(24px) brightness(0.9)';
          ctx.drawImage(originalImageObjRef.current, -30, -30, canvas.width + 60, canvas.height + 60);
          ctx.restore();
        } else {
          // Solid backdrop
          ctx.fillStyle = solidColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Draw cutout subject on top
        ctx.drawImage(img, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${baseName}-studio-export.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        console.error('Export composition error:', err);
      }
    }
  };

  const handleReset = () => {
    if (originalImageUrl) URL.revokeObjectURL(originalImageUrl);
    setSelectedFile(null);
    setOriginalImageUrl(null);
    setProcessedImageUrl(null);
    setErrorMessage(null);
    setStatusNotice(null);
    setUndoStack([]);
    setCustomKeyColors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <SEOHead
        title="AI Background Remover Online — Instant Transparent Cutouts | RankNova"
        description="Remove image backgrounds automatically with deep learning AI and smart on-device vision. Features interactive eraser, restore brush, and studio backdrops with 100% privacy."
        canonicalPath="/background-remover"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'RankNova AI Background Remover Pro',
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
        }}
      />

      <div className="py-10 bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3.5 py-1 text-xs font-semibold text-purple-700 border border-purple-200/80 mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Neural AI Deep Learning • Manual Touch-Up Brush • No Watermarks</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Professional AI Background Remover
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Isolate people, products, and complex subjects in seconds. Fine-tune edges with the interactive restore/erase brush or replace the backdrop with studio colors.
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-10 space-y-8">
            {/* Step 1: Upload or Drop Zone */}
            {!originalImageUrl ? (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:border-purple-500 hover:bg-purple-50/20 transition group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 group-hover:scale-105 transition">
                  <UploadCloud className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  Select or drag & drop an image
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Supports PNG, JPEG, and WebP (portrait photos, products, logos).
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Engine Selector & Reset */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Engine:
                    </span>
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setEngineMode('neural')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                          engineMode === 'neural'
                            ? 'bg-purple-600 text-white shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Neural AI Model (U-Net Vision)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEngineMode('smart-vision')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                          engineMode === 'smart-vision'
                            ? 'bg-purple-600 text-white shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Cpu className="h-3.5 w-3.5" />
                        <span>Smart Vision (Instant Color Key)</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-600 transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Upload different photo</span>
                  </button>
                </div>

                {/* Execution CTA when not yet processed */}
                {!processedImageUrl && (
                  <div className="text-center py-6 bg-purple-50/30 rounded-2xl border border-purple-100">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleRemoveBackground}
                      className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-8 py-3.5 text-sm font-semibold text-white shadow-md shadow-purple-500/20 hover:bg-purple-700 disabled:opacity-50 transition"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>{progressStage || 'Segmenting Subject...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>Remove Background Now</span>
                        </>
                      )}
                    </button>

                    {isProcessing && (
                      <div className="max-w-xs mx-auto mt-4">
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-purple-600 h-2 transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-mono">{progressPercent}%</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Status Notice */}
                {statusNotice && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{statusNotice}</span>
                  </div>
                )}

                {/* Professional Touch-Up Toolbar (Active when cutout is ready) */}
                {processedImageUrl && (
                  <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
                        <Paintbrush className="h-4 w-4" />
                        <span>Interactive Touch-Up Studio</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {undoStack.length > 1 && (
                          <button
                            type="button"
                            onClick={handleUndo}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            <span>Undo</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {/* Tool mode buttons */}
                      <div className="inline-flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
                        <button
                          type="button"
                          onClick={() => setToolMode('view')}
                          className={`px-3 py-1.5 rounded-md transition ${
                            toolMode === 'view' ? 'bg-purple-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          View Only
                        </button>
                        <button
                          type="button"
                          onClick={() => setToolMode('eraser')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                            toolMode === 'eraser' ? 'bg-purple-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Eraser className="h-3.5 w-3.5" />
                          <span>Erase Remnants</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setToolMode('restore')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                            toolMode === 'restore' ? 'bg-purple-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Paintbrush className="h-3.5 w-3.5" />
                          <span>Restore Cut Parts</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setToolMode('eyedropper')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                            toolMode === 'eyedropper' ? 'bg-purple-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Pipette className="h-3.5 w-3.5" />
                          <span>Color Dropper</span>
                        </button>
                      </div>

                      {/* Brush size slider */}
                      {(toolMode === 'eraser' || toolMode === 'restore') && (
                        <div className="flex items-center gap-2 pl-2">
                          <span className="text-slate-400">Brush Size:</span>
                          <input
                            type="range"
                            min="6"
                            max="80"
                            value={brushSize}
                            onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                            className="w-24 accent-purple-500 cursor-pointer"
                          />
                          <span className="font-mono text-purple-400 w-8">{brushSize}px</span>
                        </div>
                      )}

                      {toolMode !== 'view' && (
                        <p className="text-[11px] text-slate-400 ml-auto">
                          {toolMode === 'eraser' && 'Click & drag on image to erase unwanted spots.'}
                          {toolMode === 'restore' && 'Click & drag to paint back details from original.'}
                          {toolMode === 'eyedropper' && 'Click any background pixel to key that color.'}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Interactive Cutout Workspace Canvas */}
                {originalImageUrl && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {processedImageUrl ? 'Cutout Canvas (Interactive)' : 'Original Image'}
                      </span>
                      {processedImageUrl && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setViewMode('side-by-side')}
                            className={`px-2.5 py-1 text-xs rounded-md transition ${
                              viewMode === 'side-by-side' ? 'bg-slate-200 font-semibold text-slate-800' : 'text-slate-500'
                            }`}
                          >
                            Side by Side
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewMode('split')}
                            className={`px-2.5 py-1 text-xs rounded-md transition ${
                              viewMode === 'split' ? 'bg-slate-200 font-semibold text-slate-800' : 'text-slate-500'
                            }`}
                          >
                            Split Slider
                          </button>
                        </div>
                      )}
                    </div>

                    {processedImageUrl ? (
                      viewMode === 'side-by-side' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="rounded-xl border border-slate-200 p-2 bg-slate-50 text-center">
                            <span className="text-[11px] font-semibold text-slate-500 block mb-2">Original</span>
                            <div className="h-72 flex items-center justify-center overflow-hidden rounded-lg bg-white">
                              <img
                                src={originalImageUrl}
                                alt="Original"
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                          </div>

                          <div className="rounded-xl border border-purple-200 p-2 bg-purple-50/20 text-center">
                            <span className="text-[11px] font-semibold text-purple-700 block mb-2">
                              Cutout Subject
                            </span>
                            <div
                              className="relative h-72 flex items-center justify-center overflow-hidden rounded-lg"
                              style={{
                                backgroundImage:
                                  backdropMode === 'transparent'
                                    ? 'radial-gradient(#cbd5e1 1px, transparent 1px)'
                                    : 'none',
                                backgroundSize: '12px 12px',
                                backgroundColor:
                                  backdropMode === 'solid'
                                    ? solidColor
                                    : backdropMode === 'transparent'
                                    ? '#f1f5f9'
                                    : 'transparent'
                              }}
                            >
                              {backdropMode === 'bokeh' && originalImageUrl && (
                                <img
                                  src={originalImageUrl}
                                  alt="Bokeh"
                                  className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 opacity-75"
                                />
                              )}
                              <canvas
                                ref={interactiveCanvasRef}
                                onMouseDown={handleCanvasMouseDown}
                                onMouseMove={handleCanvasMouseMove}
                                onMouseUp={handleCanvasMouseUp}
                                onMouseLeave={handleCanvasMouseUp}
                                className={`relative max-h-full max-w-full object-contain ${
                                  toolMode === 'eraser'
                                    ? 'cursor-crosshair'
                                    : toolMode === 'restore'
                                    ? 'cursor-cell'
                                    : toolMode === 'eyedropper'
                                    ? 'cursor-pointer'
                                    : 'cursor-default'
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="relative h-80 w-full overflow-hidden rounded-xl border border-slate-200 select-none">
                          <div
                            className="absolute inset-0 flex items-center justify-center"
                            style={{
                              backgroundImage:
                                backdropMode === 'transparent'
                                  ? 'radial-gradient(#cbd5e1 1px, transparent 1px)'
                                  : 'none',
                              backgroundSize: '12px 12px',
                              backgroundColor: backdropMode === 'solid' ? solidColor : '#f1f5f9'
                            }}
                          >
                            <img
                              src={processedImageUrl}
                              alt="Cutout"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>

                          <div
                            className="absolute inset-0 overflow-hidden bg-white"
                            style={{ width: `${splitPos}%` }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center w-full h-full">
                              <img
                                src={originalImageUrl}
                                alt="Original"
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                          </div>

                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
                            style={{ left: `${splitPos}%` }}
                          />

                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={splitPos}
                            onChange={(e) => setSplitPos(Number(e.target.value))}
                            className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full"
                            aria-label="Comparison slider"
                          />
                        </div>
                      )
                    ) : (
                      <div className="h-64 flex items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <img
                          src={originalImageUrl}
                          alt="Selected preview"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    )}

                    {/* Backdrop Customization & Export */}
                    {processedImageUrl && (
                      <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Backdrop & Export Settings
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Backdrop Style */}
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                              Backdrop Mode:
                            </label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setBackdropMode('transparent');
                                  setExportFormat('png');
                                }}
                                className={`flex-1 py-2 px-2.5 rounded-lg border text-xs font-medium transition ${
                                  backdropMode === 'transparent'
                                    ? 'border-purple-600 bg-purple-50 text-purple-700 font-semibold'
                                    : 'border-slate-300 bg-white text-slate-700'
                                }`}
                              >
                                Transparent PNG
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setBackdropMode('solid');
                                  setExportFormat('jpeg');
                                }}
                                className={`flex-1 py-2 px-2.5 rounded-lg border text-xs font-medium transition ${
                                  backdropMode === 'solid'
                                    ? 'border-purple-600 bg-purple-50 text-purple-700 font-semibold'
                                    : 'border-slate-300 bg-white text-slate-700'
                                }`}
                              >
                                Solid Backdrop
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setBackdropMode('bokeh');
                                  setExportFormat('jpeg');
                                }}
                                className={`flex-1 py-2 px-2.5 rounded-lg border text-xs font-medium transition ${
                                  backdropMode === 'bokeh'
                                    ? 'border-purple-600 bg-purple-50 text-purple-700 font-semibold'
                                    : 'border-slate-300 bg-white text-slate-700'
                                }`}
                              >
                                Blurred Bokeh
                              </button>
                            </div>
                          </div>

                          {/* Solid Color Palette if Solid */}
                          {backdropMode === 'solid' && (
                            <div>
                              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                                Studio Backdrop Color:
                              </label>
                              <div className="flex items-center gap-2">
                                {[
                                  { label: 'White', color: '#FFFFFF' },
                                  { label: 'Slate', color: '#0F172A' },
                                  { label: 'Blue', color: '#1E3A8A' },
                                  { label: 'Emerald', color: '#064E3B' }
                                ].map((c) => (
                                  <button
                                    key={c.color}
                                    type="button"
                                    onClick={() => setSolidColor(c.color)}
                                    className={`h-8 px-2 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition ${
                                      solidColor === c.color ? 'border-purple-600 ring-2 ring-purple-200' : 'border-slate-300'
                                    }`}
                                  >
                                    <span
                                      className="h-3 w-3 rounded-full border border-slate-300"
                                      style={{ backgroundColor: c.color }}
                                    />
                                    <span>{c.label}</span>
                                  </button>
                                ))}
                                <input
                                  type="color"
                                  value={solidColor}
                                  onChange={(e) => setSolidColor(e.target.value)}
                                  className="h-8 w-8 rounded-lg cursor-pointer border border-slate-300"
                                  title="Custom color"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Download CTA */}
                        <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
                          <span className="text-xs text-slate-500">
                            Exported in full native resolution with anti-aliased alpha transparency.
                          </span>
                          <button
                            type="button"
                            onClick={handleDownload}
                            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-purple-700 transition"
                          >
                            <Download className="h-4 w-4" />
                            <span>Download {exportFormat.toUpperCase()}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Reserved AdSlot */}
          <div className="mt-8">
            <AdSlot slotId="bg-remover-bottom" format="horizontal" />
          </div>

          {/* Educational Specifications */}
          <div className="mt-12 rounded-2xl bg-white border border-slate-200 p-8 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900">
              Professional Grade Background Removal Pipeline
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
              RankNova employs client-side neural vision and hardware-accelerated canvas segmentation. It precisely differentiates complex portrait silhouettes, flyaway hair strands, jewelry, and products without uploading private photos to unvetted cloud servers.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 mb-1">
                  <ShieldCheck className="h-4 w-4" />
                  <span>100% Private On-Device</span>
                </div>
                <p className="text-xs text-slate-500">
                  Zero external server uploads. Your personal portraits and company product shots stay strictly in your browser.
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 mb-1">
                  <Paintbrush className="h-4 w-4" />
                  <span>Manual Touch-Up Brush</span>
                </div>
                <p className="text-xs text-slate-500">
                  Total pixel-level control with interactive Eraser, Restore Brush, and Eyedropper background color keying.
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 mb-1">
                  <Layers className="h-4 w-4" />
                  <span>Anti-Halo Defringing</span>
                </div>
                <p className="text-xs text-slate-500">
                  Suppresses background color bleed along cutout borders for crisp blending into websites, slides, and prints.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
