import React, { useState, useRef, useEffect } from 'react';
import { PenTool, Type, Upload, RotateCcw, Check, X, Sparkles } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySignature: (imageDataUrl: string) => void;
}

const INK_COLORS = [
  { name: 'Dark Navy', hex: '#0F172A' },
  { name: 'Royal Blue', hex: '#1D4ED8' },
  { name: 'Classic Black', hex: '#000000' },
  { name: 'Deep Crimson', hex: '#991B1B' }
];

const CURSIVE_FONTS = [
  { id: 'font-1', name: 'Elegant Script', font: 'italic 38px "Brush Script MT", cursive, sans-serif' },
  { id: 'font-2', name: 'Executive Calligraphy', font: 'italic 36px "Segoe Script", cursive, sans-serif' },
  { id: 'font-3', name: 'Modern Signature', font: 'italic 34px "Lucida Handwriting", cursive, sans-serif' },
  { id: 'font-4', name: 'Classic Flow', font: 'italic 40px "Snell Roundhand", cursive, sans-serif' },
  { id: 'font-5', name: 'Formal Cursive', font: 'italic 32px Georgia, serif' }
];

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  onApplySignature
}) => {
  const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const [selectedColor, setSelectedColor] = useState('#0F172A');
  const [strokeWidth, setStrokeWidth] = useState(3);

  // Draw tab state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Type tab state
  const [typedName, setTypedName] = useState('John Doe');
  const [selectedFontIndex, setSelectedFontIndex] = useState(0);

  // Upload tab state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  // Setup canvas resolution and styling
  useEffect(() => {
    if (activeTab === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = strokeWidth;
      }
    }
  }, [activeTab, selectedColor, strokeWidth]);

  if (!isOpen) return null;

  // Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Convert typed text to transparent PNG signature
  const renderTypedSignatureToPng = (): string => {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 600;
    offCanvas.height = 200;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return '';

    ctx.clearRect(0, 0, 600, 200);
    const selected = CURSIVE_FONTS[selectedFontIndex];
    ctx.font = selected.font;
    ctx.fillStyle = selectedColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    // Draw stylized underline stroke for authentic signature feel
    ctx.fillText(typedName || 'Signature', 300, 95);

    // Decorative flourishing underline
    ctx.beginPath();
    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = 2;
    ctx.moveTo(180, 130);
    ctx.bezierCurveTo(280, 145, 360, 125, 430, 132);
    ctx.stroke();

    return offCanvas.toDataURL('image/png');
  };

  // Clean uploaded image to make white background transparent
  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.width;
        offCanvas.height = img.height;
        const ctx = offCanvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imgData.data;

        // Turn near-white/light pixels transparent
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Brightness threshold
          if (r > 200 && g > 200 && b > 200) {
            data[i + 3] = 0; // Alpha 0
          }
        }

        ctx.putImageData(imgData, 0, 0);
        setUploadedImage(offCanvas.toDataURL('image/png'));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return;
      onApplySignature(canvas.toDataURL('image/png'));
      onClose();
    } else if (activeTab === 'type') {
      const dataUrl = renderTypedSignatureToPng();
      if (dataUrl) {
        onApplySignature(dataUrl);
        onClose();
      }
    } else if (activeTab === 'upload') {
      if (uploadedImage) {
        onApplySignature(uploadedImage);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <PenTool className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Add Signature</h3>
              <p className="text-xs text-slate-500">Draw, type cursive, or upload your signature</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('draw')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'draw'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <PenTool className="h-4 w-4" />
            <span>Draw Signature</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('type')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'type'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Type className="h-4 w-4" />
            <span>Type Cursive</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'upload'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>Upload Image</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* DRAW TAB */}
          {activeTab === 'draw' && (
            <div className="space-y-4">
              <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-2">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={220}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-44 rounded-lg bg-white touch-none cursor-crosshair shadow-2xs"
                />
                {!hasDrawn && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                    Sign with your mouse, trackpad, or touch screen here
                  </div>
                )}
                {/* Signature baseline guide */}
                <div className="pointer-events-none absolute bottom-12 left-6 right-6 border-b border-slate-200" />
              </div>

              {/* Ink Controls */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Ink:</span>
                  {INK_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setSelectedColor(c.hex)}
                      className={`h-6 w-6 rounded-full border-2 transition ${
                        selectedColor === c.hex ? 'border-blue-600 scale-110 shadow-xs' : 'border-white'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Stroke:</span>
                  {[2, 3, 5].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setStrokeWidth(w)}
                      className={`px-2 py-1 text-xs rounded border transition ${
                        strokeWidth === w
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {w === 2 ? 'Fine' : w === 3 ? 'Medium' : 'Bold'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="flex items-center gap-1 ml-2 text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-slate-100"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TYPE TAB */}
          {activeTab === 'type' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Type your name or initials
                </label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Ink Color for Typed */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Ink Color:</span>
                {INK_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setSelectedColor(c.hex)}
                    className={`h-6 w-6 rounded-full border-2 transition ${
                      selectedColor === c.hex ? 'border-blue-600 scale-110 shadow-xs' : 'border-white'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}
              </div>

              {/* Handwriting font options */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700">Select Signature Style</span>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {CURSIVE_FONTS.map((font, idx) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => setSelectedFontIndex(idx)}
                      className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${
                        selectedFontIndex === idx
                          ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-0.5">{font.name}</span>
                        <span
                          className="text-2xl block"
                          style={{
                            fontFamily: font.font.split(' ')[2] || 'cursive',
                            fontStyle: 'italic',
                            color: selectedColor
                          }}
                        >
                          {typedName || 'Signature'}
                        </span>
                      </div>
                      {selectedFontIndex === idx && (
                        <Check className="h-5 w-5 text-blue-600 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* UPLOAD TAB */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleImageUpload(e.target.files[0]);
                  }
                }}
              />

              {!uploadedImage ? (
                <div
                  onClick={() => uploadInputRef.current?.click()}
                  className="cursor-pointer border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-500 hover:bg-blue-50/30 transition group"
                >
                  <Upload className="h-8 w-8 text-slate-400 group-hover:text-blue-600 mx-auto transition" />
                  <p className="mt-2 text-xs font-semibold text-slate-700">
                    Click to upload signature photo or scan
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    PNG, JPG, or WebP. White background will be made transparent automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-center">
                    <img
                      src={uploadedImage}
                      alt="Uploaded Signature"
                      className="max-h-32 object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadedImage(null)}
                    className="text-xs text-red-600 hover:underline flex items-center gap-1 mx-auto"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Upload a different image</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={
              (activeTab === 'draw' && !hasDrawn) ||
              (activeTab === 'type' && !typedName.trim()) ||
              (activeTab === 'upload' && !uploadedImage)
            }
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-40 transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Insert Signature</span>
          </button>
        </div>
      </div>
    </div>
  );
};
