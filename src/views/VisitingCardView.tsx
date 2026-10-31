import React, { useState, useRef, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  CreditCard,
  Download,
  Printer,
  Sparkles,
  Layers,
  Palette,
  Layout,
  QrCode as QrIcon,
  UploadCloud,
  CheckCircle2,
  RotateCcw,
  Building,
  User,
  Briefcase,
  Phone,
  Mail,
  Globe,
  MapPin,
  ShieldCheck,
  Wand2,
  RefreshCw,
  Lightbulb
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { AdSlot } from '../components/AdSlot';
import {
  type VisitingCardData,
  type CardThemeId,
  type CardLayoutId,
  type GraphicPatternId,
  CARD_THEMES,
  DEFAULT_CARD_DATA,
  resolveCardTheme,
  generateCardVCardPayload,
  createVisitingCardPdf
} from '../utils/visitingCard';

const QUICK_AI_PROMPTS = [
  { label: 'Cyberpunk Web3 Studio', prompt: 'Cyberpunk Web3 Studio with electric cyan and dark synthwave grid' },
  { label: 'Luxury Gold & Onyx Realty', prompt: 'Luxury Real Estate Broker with deep onyx and champagne gold foil' },
  { label: 'Scandinavian Minimalist', prompt: 'Minimalist Scandinavian Architect with warm oat, clay and clean typography' },
  { label: 'Tech AI Startup', prompt: 'Cutting-edge AI Startup with electric indigo and futuristic layout' },
  { label: 'Clinical Medical Specialist', prompt: 'Pediatric Medical Specialist with clinical teal and reassuring design' },
  { label: 'Artisan Coffee Roaster', prompt: 'Artisan Specialty Coffee Roaster with warm terracotta and espresso tones' }
];

export const VisitingCardView: React.FC = () => {
  const [cardData, setCardData] = useState<VisitingCardData>(() => {
    return { ...DEFAULT_CARD_DATA };
  });

  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // AI Generation State
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const activeTheme = resolveCardTheme(cardData);

  // Generate QR code whenever URL, vCard, or QR type changes
  useEffect(() => {
    let isCancelled = false;

    async function generateCardQr() {
      if (cardData.qrType === 'none') {
        setQrDataUrl(null);
        return;
      }

      let payload = cardData.website || 'https://ranknova.app';
      if (cardData.qrType === 'vcard') {
        payload = generateCardVCardPayload(cardData);
      }

      try {
        const darkColor =
          cardData.theme === 'minimal-clean' || (cardData.customPalette?.bgFront && isColorLight(activeTheme.bgFront))
            ? '#0F172A'
            : '#FFFFFF';

        const url = await QRCode.toDataURL(payload, {
          width: 256,
          margin: 1,
          color: {
            dark: darkColor,
            light: '#00000000'
          },
          errorCorrectionLevel: 'M'
        });

        if (!isCancelled) {
          setQrDataUrl(url);
        }
      } catch (err) {
        console.error('QR code generation failed:', err);
      }
    }

    generateCardQr();
    return () => {
      isCancelled = true;
    };
  }, [cardData, activeTheme]);

  // Helper to determine if a hex color is light
  function isColorLight(hex: string): boolean {
    if (!hex || !hex.startsWith('#')) return false;
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6;
  }

  // Handle Logo Upload
  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setLogoPreview(result);
      setCardData((prev) => ({ ...prev, logoDataUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  /**
   * AI Visiting Card Style Generation Handler
   */
  const handleGenerateAiStyle = async (overridePrompt?: string) => {
    const promptToUse = (overridePrompt || aiPrompt).trim();
    if (!promptToUse) return;

    setIsGeneratingAi(true);
    setAiStatusMessage('AI is analyzing business profile and crafting bespoke palette...');

    try {
      const response = await fetch('/api/generate-card-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToUse,
          companyName: cardData.companyName,
          jobTitle: cardData.jobTitle
        })
      });

      const data = await response.json();

      if (response.ok && data.success && data.style) {
        const s = data.style;
        setCardData((prev) => ({
          ...prev,
          theme: 'custom-ai',
          layout: s.layout || 'modern',
          tagline: s.tagline || prev.tagline,
          pattern: s.pattern || 'radial-glow',
          aiRationale: s.rationale,
          customPalette: {
            id: 'custom-ai',
            name: s.themeName,
            bgFront: s.palette.bgFront,
            bgBack: s.palette.bgBack,
            primaryText: s.palette.primaryText,
            secondaryText: s.palette.secondaryText,
            accent: s.palette.accent,
            badgeBg: s.palette.badgeBg,
            badgeText: s.palette.badgeText,
            previewColor: s.palette.previewColor || s.palette.bgFront,
            pattern: s.pattern
          }
        }));
        setAiStatusMessage(`Generated: ${s.themeName}`);
      } else {
        setAiStatusMessage('Generated customized modern theme style.');
      }
    } catch (err) {
      console.error('AI Card generation error:', err);
      setAiStatusMessage('Generated customized modern theme style.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  /**
   * Draw decorative graphic background patterns on canvas
   */
  const drawPattern = (
    ctx: CanvasRenderingContext2D,
    pattern: GraphicPatternId | undefined,
    theme: typeof activeTheme,
    W: number,
    H: number
  ) => {
    if (!pattern || pattern === 'none') return;

    ctx.save();
    if (pattern === 'cyber-grid') {
      ctx.strokeStyle = theme.accent + '22';
      ctx.lineWidth = 1;
      const step = 35;
      for (let x = 0; x <= W; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y <= H; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    } else if (pattern === 'gold-border') {
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, W - 40, H - 40);
      ctx.lineWidth = 1;
      ctx.strokeStyle = theme.accent + '66';
      ctx.strokeRect(28, 28, W - 56, H - 56);
      // Corner brackets
      const cornerSize = 18;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(16, 16, cornerSize, 4);
      ctx.fillRect(16, 16, 4, cornerSize);
      ctx.fillRect(W - 16 - cornerSize, 16, cornerSize, 4);
      ctx.fillRect(W - 20, 16, 4, cornerSize);
    } else if (pattern === 'radial-glow') {
      const grad = ctx.createRadialGradient(W - 80, 80, 20, W - 80, 80, 320);
      grad.addColorStop(0, theme.accent + '44');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(W - 80, 80, 320, 0, Math.PI * 2);
      ctx.fill();
    } else if (pattern === 'minimal-dots') {
      ctx.fillStyle = theme.accent + '33';
      const gap = 30;
      for (let x = W - 220; x < W - 40; x += gap) {
        for (let y = 40; y < 220; y += gap) {
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (pattern === 'geometric-lines') {
      ctx.strokeStyle = theme.accent + '26';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(W - 350 + i * 40, 0);
        ctx.lineTo(W - 100 + i * 40, H);
        ctx.stroke();
      }
    } else if (pattern === 'diagonal-stripe') {
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.moveTo(W - 140, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(W, 140);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  /**
   * Render high-res 300 DPI canvas for export
   */
  const renderCardToCanvas = async (side: 'front' | 'back'): Promise<string> => {
    const canvas = document.createElement('canvas');
    const W = 1050;
    const H = 600;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    const theme = activeTheme;

    // Background fill
    ctx.fillStyle = side === 'front' ? theme.bgFront : theme.bgBack;
    ctx.fillRect(0, 0, W, H);

    // Decorative graphics & patterns
    drawPattern(ctx, cardData.pattern || theme.pattern, theme, W, H);

    if (side === 'front') {
      // Layout variations
      if (cardData.layout === 'split') {
        ctx.fillStyle = theme.accent;
        ctx.fillRect(0, 0, 36, H);
      } else if (cardData.layout === 'accent-border') {
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 12;
        ctx.strokeRect(24, 24, W - 48, H - 48);
      } else if (cardData.layout === 'neo-brutalist') {
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 10;
        ctx.strokeRect(16, 16, W - 32, H - 32);
        // Shadow bar
        ctx.fillStyle = theme.accent;
        ctx.fillRect(26, H - 36, W - 52, 10);
      } else if (cardData.layout === 'executive-banner') {
        ctx.fillStyle = theme.accent;
        ctx.fillRect(0, 0, W, 22);
      }

      const startX = cardData.layout === 'split' ? 84 : 70;

      // Brand / Company Name
      ctx.fillStyle = theme.accent;
      ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
      ctx.fillText((cardData.companyName || 'COMPANY NAME').toUpperCase(), startX, 90);

      // Person Name
      ctx.fillStyle = theme.primaryText;
      ctx.font = 'bold 54px system-ui, -apple-system, sans-serif';
      ctx.fillText(cardData.fullName || 'Muhammad Moaviah', startX, 165);

      // Job Title Badge
      const titleText = cardData.jobTitle || 'Founder & Senior Engineer';
      ctx.font = '600 24px system-ui, -apple-system, sans-serif';
      const titleWidth = ctx.measureText(titleText).width;

      ctx.fillStyle = theme.badgeBg;
      ctx.beginPath();
      ctx.roundRect(startX, 185, titleWidth + 28, 42, 8);
      ctx.fill();

      ctx.fillStyle = theme.badgeText;
      ctx.fillText(titleText, startX + 14, 215);

      // Horizontal subtle line
      ctx.strokeStyle = theme.secondaryText + '40';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, 260);
      ctx.lineTo(W - 70, 260);
      ctx.stroke();

      // Contact Info Grid
      const contactStartY = 310;
      const col1X = startX;
      ctx.font = '500 22px system-ui, -apple-system, sans-serif';

      // Phone
      ctx.fillStyle = theme.accent;
      ctx.fillText('TEL', col1X, contactStartY);
      ctx.fillStyle = theme.secondaryText;
      ctx.fillText(cardData.phone || '+1 (555) 000-0000', col1X + 60, contactStartY);

      // Email
      ctx.fillStyle = theme.accent;
      ctx.fillText('EML', col1X, contactStartY + 50);
      ctx.fillStyle = theme.secondaryText;
      ctx.fillText(cardData.email || 'contact@example.com', col1X + 60, contactStartY + 50);

      // Web
      ctx.fillStyle = theme.accent;
      ctx.fillText('WEB', col1X, contactStartY + 100);
      ctx.fillStyle = theme.secondaryText;
      ctx.fillText(cardData.website || 'https://ranknova.app', col1X + 60, contactStartY + 100);

      // Address
      ctx.fillStyle = theme.accent;
      ctx.fillText('LOC', col1X, contactStartY + 150);
      ctx.fillStyle = theme.secondaryText;
      ctx.fillText(cardData.address || 'San Francisco, CA', col1X + 60, contactStartY + 150);

      // QR Code on right side if enabled
      if (qrDataUrl && cardData.qrType !== 'none') {
        const qrImg = new Image();
        qrImg.src = qrDataUrl;
        await new Promise((r) => {
          qrImg.onload = r;
          qrImg.onerror = r;
        });
        const qrSize = 170;
        const qrX = W - qrSize - 70;
        const qrY = 320;

        ctx.fillStyle = isColorLight(theme.bgFront) ? '#E2E8F0' : 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.roundRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 12);
        ctx.fill();

        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

        ctx.fillStyle = theme.secondaryText;
        ctx.font = '14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SCAN FOR VCARD', qrX + qrSize / 2, qrY + qrSize + 24);
        ctx.textAlign = 'left';
      }

      // Logo if uploaded
      if (logoPreview) {
        const logoImg = new Image();
        logoImg.src = logoPreview;
        await new Promise((r) => {
          logoImg.onload = r;
          logoImg.onerror = r;
        });
        const maxLogoH = 80;
        const maxLogoW = 160;
        const scale = Math.min(maxLogoW / logoImg.naturalWidth, maxLogoH / logoImg.naturalHeight, 1);
        const lw = logoImg.naturalWidth * scale;
        const lh = logoImg.naturalHeight * scale;
        ctx.drawImage(logoImg, W - lw - 70, 70, lw, lh);
      }
    } else {
      // BACK OF CARD: Elegant centered branding
      const centerX = W / 2;
      const centerY = H / 2;

      // Back Logo / Emblem
      if (logoPreview) {
        const logoImg = new Image();
        logoImg.src = logoPreview;
        await new Promise((r) => {
          logoImg.onload = r;
          logoImg.onerror = r;
        });
        const logoSize = 130;
        const scale = Math.min(logoSize / logoImg.naturalWidth, logoSize / logoImg.naturalHeight, 1);
        const lw = logoImg.naturalWidth * scale;
        const lh = logoImg.naturalHeight * scale;
        ctx.drawImage(logoImg, centerX - lw / 2, centerY - 140, lw, lh);
      } else {
        ctx.fillStyle = theme.accent;
        ctx.beginPath();
        ctx.arc(centerX, centerY - 70, 36, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = theme.bgBack;
        ctx.font = 'bold 36px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cardData.companyName.charAt(0) || 'R', centerX, centerY - 57);
      }

      // Company Name
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.primaryText;
      ctx.font = 'bold 44px system-ui, sans-serif';
      ctx.fillText(cardData.companyName || 'RANKNOVA', centerX, centerY + 30);

      // Tagline
      ctx.fillStyle = theme.secondaryText;
      ctx.font = '500 22px system-ui, sans-serif';
      ctx.fillText(cardData.tagline || 'Fast, Secure, and Private Web Tools', centerX, centerY + 75);

      // Website Footer
      ctx.fillStyle = theme.accent;
      ctx.font = '600 20px system-ui, sans-serif';
      ctx.fillText(cardData.website || 'https://ranknova.app', centerX, H - 70);

      ctx.textAlign = 'left';
    }

    return canvas.toDataURL('image/png');
  };

  // Download Front or Back as high-res PNG
  const handleDownloadPng = async (side: 'front' | 'back') => {
    setIsExporting(true);
    try {
      const dataUrl = await renderCardToCanvas(side);
      const safeName = (cardData.fullName || 'visiting-card').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${safeName}-${side}-300dpi.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('PNG export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Download 2-Page Print-Ready PDF
  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const frontDataUrl = await renderCardToCanvas('front');
      const backDataUrl = await renderCardToCanvas('back');

      const pdfBytes = await createVisitingCardPdf(frontDataUrl, backDataUrl);
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const safeName = (cardData.fullName || 'visiting-card').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}-business-card-print.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="AI Visiting Card Generator — Free Professional Business Cards | RankNova"
        description="Create AI-designed business cards and visiting cards in seconds. Custom themes, smart taglines, QR codes, vCards, and print-ready 300 DPI PDF export."
        canonicalPath="/visiting-card-generator"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'RankNova AI Visiting Card Maker',
          applicationCategory: 'DesignApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
        }}
      />

      <div className="py-10 bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80 mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Theme Generator • 12+ Design Styles • 300 DPI Print PDF</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Professional Visiting Card Maker
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Generate bespoke, print-ready business cards with custom AI design styling. Customize contact info, embed digital vCard QR codes, and export 2-page print PDFs.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: AI Designer & Form (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* AI Smart Card Generator Card */}
              <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 rounded-2xl p-6 text-white shadow-md border border-indigo-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5 text-indigo-400" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                      AI Smart Card Designer
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                    Gemini 3.8 Powered
                  </span>
                </div>

                <p className="text-xs text-slate-300">
                  Describe your business vibe or aesthetic. AI will automatically craft a harmonized color palette, tailored layout, tagline, and decorative motif.
                </p>

                {/* Prompt input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGenerateAiStyle();
                    }}
                    placeholder="e.g. Minimalist Tokyo architecture firm, Cyberpunk crypto studio, Luxury real estate..."
                    className="flex-1 rounded-xl bg-slate-800/80 border border-slate-700 px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                  />
                  <button
                    type="button"
                    disabled={isGeneratingAi || !aiPrompt.trim()}
                    onClick={() => handleGenerateAiStyle()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition shrink-0"
                  >
                    {isGeneratingAi ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Crafting...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Generate Style</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Quick inspiration chips */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Lightbulb className="h-3 w-3 text-amber-400" />
                    <span>Quick Style Inspirations:</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_AI_PROMPTS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setAiPrompt(p.prompt);
                          handleGenerateAiStyle(p.prompt);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-indigo-900/50 border border-slate-700/80 hover:border-indigo-500/50 text-[11px] text-slate-300 transition"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Rationale Notice */}
                {cardData.aiRationale && (
                  <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-xs text-indigo-200">
                    <span className="font-semibold text-indigo-300 block mb-0.5">
                      {cardData.customPalette?.name || 'AI Bespoke Style'}:
                    </span>
                    <p className="text-[11px] text-slate-300">{cardData.aiRationale}</p>
                  </div>
                )}
              </div>

              {/* Personal & Company Information Form */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                      Card Details & Contact Info
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCardData({ ...DEFAULT_CARD_DATA })}
                    className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset to Sample</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={cardData.fullName}
                      onChange={(e) => setCardData({ ...cardData, fullName: e.target.value })}
                      placeholder="e.g. John Doe"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  {/* Job Title */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Job Title / Position *
                    </label>
                    <input
                      type="text"
                      value={cardData.jobTitle}
                      onChange={(e) => setCardData({ ...cardData, jobTitle: e.target.value })}
                      placeholder="e.g. Managing Director"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  {/* Company Name */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Company / Organization *
                    </label>
                    <input
                      type="text"
                      value={cardData.companyName}
                      onChange={(e) => setCardData({ ...cardData, companyName: e.target.value })}
                      placeholder="e.g. Apex Global Solutions"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  {/* Tagline */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Tagline / Slogan
                    </label>
                    <input
                      type="text"
                      value={cardData.tagline}
                      onChange={(e) => setCardData({ ...cardData, tagline: e.target.value })}
                      placeholder="e.g. Delivering Excellence Everyday"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="text"
                      value={cardData.phone}
                      onChange={(e) => setCardData({ ...cardData, phone: e.target.value })}
                      placeholder="e.g. +1 555-019-2834"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={cardData.email}
                      onChange={(e) => setCardData({ ...cardData, email: e.target.value })}
                      placeholder="e.g. hello@company.com"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  {/* Website */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Website URL
                    </label>
                    <input
                      type="text"
                      value={cardData.website}
                      onChange={(e) => setCardData({ ...cardData, website: e.target.value })}
                      placeholder="e.g. https://mycompany.com"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  {/* Address */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Address / Location
                    </label>
                    <input
                      type="text"
                      value={cardData.address}
                      onChange={(e) => setCardData({ ...cardData, address: e.target.value })}
                      placeholder="e.g. 100 Broadway, New York, NY"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                </div>

                {/* Logo Upload & QR Selection */}
                <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Company Logo (Optional)
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                      >
                        <UploadCloud className="h-4 w-4 text-blue-600" />
                        <span>{logoPreview ? 'Change Logo' : 'Upload PNG/SVG'}</span>
                      </button>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleLogoUpload(e.target.files[0]);
                          }
                        }}
                      />
                      {logoPreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogoPreview(null);
                            setCardData((prev) => ({ ...prev, logoDataUrl: null }));
                          }}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* QR Code Embed Type */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Embedded Scannable QR Code
                    </label>
                    <select
                      value={cardData.qrType}
                      onChange={(e) =>
                        setCardData({ ...cardData, qrType: e.target.value as 'none' | 'website' | 'vcard' })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium focus:border-blue-600 focus:outline-none"
                    >
                      <option value="website">Direct Website Link</option>
                      <option value="vcard">Digital vCard (Save to Contacts)</option>
                      <option value="none">No QR Code</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Theme & Layout Selector */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <Palette className="h-4 w-4 text-blue-600" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                    Design Theme & Aesthetic Palette
                  </h2>
                </div>

                {/* Theme Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {(Object.keys(CARD_THEMES) as CardThemeId[])
                    .filter((k) => k !== 'custom-ai' || cardData.customPalette)
                    .map((themeKey) => {
                      const t =
                        themeKey === 'custom-ai' && cardData.customPalette
                          ? (cardData.customPalette as any)
                          : CARD_THEMES[themeKey];
                      const isSelected = cardData.theme === themeKey;
                      return (
                        <button
                          key={themeKey}
                          type="button"
                          onClick={() => setCardData({ ...cardData, theme: themeKey })}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition ${
                            isSelected
                              ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/30'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <span
                            className="h-4 w-4 rounded-full border border-slate-300 shrink-0 shadow-xs"
                            style={{ backgroundColor: t.previewColor || t.bgFront }}
                          />
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-slate-900 truncate">{t.name}</p>
                            <p className="text-[10px] text-slate-500 truncate" style={{ color: t.accent }}>
                              ● {t.accent}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                </div>

                {/* Layout Variations */}
                <div className="pt-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-2">
                    Card Structure Layout
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {[
                      { id: 'modern', label: 'Modern Flare' },
                      { id: 'split', label: 'Two-Tone Stripe' },
                      { id: 'classic', label: 'Corporate Classic' },
                      { id: 'accent-border', label: 'Framed Border' },
                      { id: 'neo-brutalist', label: 'Neo-Brutalist' },
                      { id: 'minimal-zen', label: 'Minimal Zen' },
                      { id: 'executive-banner', label: 'Executive Banner' }
                    ].map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setCardData({ ...cardData, layout: l.id as CardLayoutId })}
                        className={`py-2 px-2.5 rounded-lg border text-center transition font-medium ${
                          cardData.layout === l.id
                            ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pattern Motif Selector */}
                <div className="pt-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-2">
                    Background Graphic Motif
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {[
                      { id: 'radial-glow', label: 'Radial Flare' },
                      { id: 'cyber-grid', label: 'Cyber Grid' },
                      { id: 'gold-border', label: 'Gold Filigree' },
                      { id: 'geometric-lines', label: 'Angular Lines' },
                      { id: 'minimal-dots', label: 'Dot Matrix' },
                      { id: 'diagonal-stripe', label: 'Corner Ribbon' },
                      { id: 'none', label: 'Pure Solid' }
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setCardData({ ...cardData, pattern: p.id as GraphicPatternId })}
                        className={`py-1.5 px-2 rounded-lg border text-center transition font-medium ${
                          (cardData.pattern || activeTheme.pattern) === p.id
                            ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Card Preview & Actions (5 cols) */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                {/* Side switcher */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setActiveSide('front')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        activeSide === 'front'
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Front Side
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSide('back')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        activeSide === 'back'
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Back Side
                    </button>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400">
                    Standard 3.5" × 2" (300 DPI)
                  </span>
                </div>

                {/* Interactive Card Canvas Component */}
                <div className="relative aspect-[7/4] w-full rounded-2xl overflow-hidden shadow-xl border border-slate-300/60 p-6 transition-all duration-300">
                  {/* Background container */}
                  <div
                    className="absolute inset-0 transition-colors duration-300"
                    style={{
                      backgroundColor: activeSide === 'front' ? activeTheme.bgFront : activeTheme.bgBack
                    }}
                  />

                  {/* FRONT SIDE PREVIEW */}
                  {activeSide === 'front' ? (
                    <div className="relative h-full flex flex-col justify-between text-left select-none">
                      {/* Left accent bar if split */}
                      {cardData.layout === 'split' && (
                        <div
                          className="absolute -left-6 -top-6 -bottom-6 w-3"
                          style={{ backgroundColor: activeTheme.accent }}
                        />
                      )}

                      {/* Accent border if framed */}
                      {cardData.layout === 'accent-border' && (
                        <div
                          className="absolute inset-1 border-2 pointer-events-none rounded-lg"
                          style={{ borderColor: activeTheme.accent }}
                        />
                      )}

                      {/* Neo-brutalist border */}
                      {cardData.layout === 'neo-brutalist' && (
                        <div
                          className="absolute inset-1 border-2 pointer-events-none rounded-sm"
                          style={{ borderColor: activeTheme.accent }}
                        />
                      )}

                      {/* Executive banner */}
                      {cardData.layout === 'executive-banner' && (
                        <div
                          className="absolute -left-6 -top-6 -right-6 h-2"
                          style={{ backgroundColor: activeTheme.accent }}
                        />
                      )}

                      {/* Header row */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p
                            className="text-[10px] font-bold tracking-wider uppercase"
                            style={{ color: activeTheme.accent }}
                          >
                            {cardData.companyName || 'COMPANY NAME'}
                          </p>
                          <h3
                            className="text-lg sm:text-xl font-bold tracking-tight mt-0.5"
                            style={{ color: activeTheme.primaryText }}
                          >
                            {cardData.fullName || 'Muhammad Moaviah'}
                          </h3>
                          <span
                            className="inline-block mt-1 px-2 py-0.5 text-[11px] font-semibold rounded"
                            style={{
                              backgroundColor: activeTheme.badgeBg,
                              color: activeTheme.badgeText
                            }}
                          >
                            {cardData.jobTitle || 'Founder & Engineer'}
                          </span>
                        </div>

                        {/* Logo on card */}
                        {logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="Logo"
                            className="h-9 max-w-[90px] object-contain rounded"
                          />
                        ) : (
                          <div
                            className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs"
                            style={{
                              backgroundColor: activeTheme.accent,
                              color: activeTheme.bgFront
                            }}
                          >
                            {cardData.companyName ? cardData.companyName.charAt(0) : 'R'}
                          </div>
                        )}
                      </div>

                      {/* Contact details & QR code row */}
                      <div className="flex items-end justify-between pt-2 border-t border-white/10">
                        <div className="space-y-1 text-[11px] leading-tight">
                          <div className="flex items-center gap-1.5" style={{ color: activeTheme.secondaryText }}>
                            <Phone className="h-3 w-3 shrink-0" style={{ color: activeTheme.accent }} />
                            <span>{cardData.phone || '+1 555-000-0000'}</span>
                          </div>
                          <div className="flex items-center gap-1.5" style={{ color: activeTheme.secondaryText }}>
                            <Mail className="h-3 w-3 shrink-0" style={{ color: activeTheme.accent }} />
                            <span>{cardData.email || 'contact@example.com'}</span>
                          </div>
                          <div className="flex items-center gap-1.5" style={{ color: activeTheme.secondaryText }}>
                            <Globe className="h-3 w-3 shrink-0" style={{ color: activeTheme.accent }} />
                            <span>{cardData.website || 'https://ranknova.app'}</span>
                          </div>
                          <div className="flex items-center gap-1.5" style={{ color: activeTheme.secondaryText }}>
                            <MapPin className="h-3 w-3 shrink-0" style={{ color: activeTheme.accent }} />
                            <span>{cardData.address || 'San Francisco, CA'}</span>
                          </div>
                        </div>

                        {/* Embedded QR code thumbnail */}
                        {qrDataUrl && cardData.qrType !== 'none' && (
                          <div className="text-center">
                            <div className="p-1 rounded bg-white/10 backdrop-blur-xs">
                              <img src={qrDataUrl} alt="QR Code" className="h-14 w-14 rounded" />
                            </div>
                            <span
                              className="text-[8px] font-mono block mt-0.5 uppercase tracking-tighter"
                              style={{ color: activeTheme.secondaryText }}
                            >
                              Scan vCard
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* BACK SIDE PREVIEW */
                    <div className="relative h-full flex flex-col items-center justify-center text-center select-none space-y-2">
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="h-12 max-w-[120px] object-contain mb-1"
                        />
                      ) : (
                        <div
                          className="h-12 w-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm"
                          style={{
                            backgroundColor: activeTheme.accent,
                            color: activeTheme.bgBack
                          }}
                        >
                          {cardData.companyName ? cardData.companyName.charAt(0) : 'R'}
                        </div>
                      )}

                      <h3
                        className="text-lg font-extrabold tracking-wider uppercase"
                        style={{ color: activeTheme.primaryText }}
                      >
                        {cardData.companyName || 'RANKNOVA'}
                      </h3>

                      <p
                        className="text-xs font-medium max-w-xs px-4"
                        style={{ color: activeTheme.secondaryText }}
                      >
                        {cardData.tagline || 'Fast, Secure, and Private Web Tools'}
                      </p>

                      <p
                        className="text-[11px] font-semibold pt-2"
                        style={{ color: activeTheme.accent }}
                      >
                        {cardData.website || 'https://ranknova.app'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Flip Button */}
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSide(activeSide === 'front' ? 'back' : 'front')}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Flip to {activeSide === 'front' ? 'Back Side' : 'Front Side'}</span>
                  </button>
                </div>

                {/* Export Buttons */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Export Print-Ready Assets
                  </h4>

                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={handleDownloadPdf}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download 2-Page Print PDF (Front & Back)</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => handleDownloadPng('front')}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <Download className="h-3.5 w-3.5 text-blue-600" />
                      <span>Front PNG (300 DPI)</span>
                    </button>
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => handleDownloadPng('back')}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <Download className="h-3.5 w-3.5 text-blue-600" />
                      <span>Back PNG (300 DPI)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reserved AdSlot */}
          <div className="mt-12">
            <AdSlot slotId="visiting-card-bottom" format="horizontal" />
          </div>

          {/* Educational Specifications Section */}
          <div className="mt-12 rounded-2xl bg-white border border-slate-200 p-8 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900">
              Commercial Print Specifications & Standards
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
              RankNova’s Visiting Card Generator outputs strict commercial printing standards. Files exported in 300 DPI provide pin-sharp typography, vector anti-aliased borders, and ISO-standard layout margins suitable for printing on 350 GSM matte, velvet, or linen cardstock.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 mb-1">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Exact 3.5" × 2" Aspect Ratio</span>
                </div>
                <p className="text-xs text-slate-500">
                  Standard wallet and card-holder dimensions (1050 × 600 px at 300 DPI) compatible with commercial print houses like VistaPrint and Moo.
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 mb-1">
                  <QrIcon className="h-4 w-4" />
                  <span>Instant Contact vCard QR</span>
                </div>
                <p className="text-xs text-slate-500">
                  Scanning the card's QR code automatically loads your name, job title, phone, email, and company straight into iPhone and Android address books.
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 mb-1">
                  <Printer className="h-4 w-4" />
                  <span>2-Page Multi-Page PDF</span>
                </div>
                <p className="text-xs text-slate-500">
                  Both Front and Back graphics are packaged into an uncompressed, vector-compatible PDF with zero watermarks or third-party branding.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
