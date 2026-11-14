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
  Lightbulb,
  Undo2,
  Redo2,
  AlertCircle,
  Eye,
  EyeOff,
  FileJson,
  Upload,
  Share2,
  Check,
  Copy,
  Sliders,
  ZoomIn,
  ZoomOut,
  Move,
  ExternalLink
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { AdSlot } from '../components/AdSlot';
import {
  type VisitingCardData,
  type CardThemeId,
  type CardLayoutId,
  type GraphicPatternId,
  type CardEmblemIcon,
  type CardCornerRadius,
  type CardFinishStyle,
  type VisitingCardStyleTemplate,
  CARD_THEMES,
  CARD_PRESETS,
  STYLE_TEMPLATES,
  applyStyleTemplate,
  DEFAULT_CARD_DATA,
  resolveCardTheme,
  generateCardVCardPayload,
  createVisitingCardPdf,
  drawEmblemOnCanvas,
  downloadVCardFile,
  exportCardAsJson,
  parseCardFromJson,
  CARD_SIZES,
  CARD_FONT_CSS,
  getCanvasFont,
  suggestCardStyle,
  normalizeContactUrl,
  getContactUrlQrPayload,
  toggleContactUrlQr
} from '../utils/visitingCard';
import { validateImageSignature, checkImageDimensionSafety } from '../utils/image';

const QUICK_AI_PROMPTS = [
  { label: 'Cyberpunk Web3 Studio', prompt: 'Cyberpunk Web3 Studio with electric cyan and dark synthwave grid' },
  { label: 'Luxury Gold & Onyx Realty', prompt: 'Luxury Real Estate Broker with deep onyx and champagne gold foil' },
  { label: 'Frosted Glass Tech Startup', prompt: 'Glassmorphism Tech Startup with frosted panels and electric indigo glow' },
  { label: 'Swiss Minimalist Architect', prompt: 'Minimalist Swiss Architect with razor-sharp typography and clean crimson accent' },
  { label: 'Clinical Medical Specialist', prompt: 'Pediatric Medical Specialist with clinical teal and reassuring design' },
  { label: 'Organic Coffee Roaster', prompt: 'Artisan Specialty Coffee Roaster with warm terracotta and espresso tones' }
];

export const VisitingCardView: React.FC = () => {
  const [cardData, setCardData] = useState<VisitingCardData>(() => ({
    ...DEFAULT_CARD_DATA
  }));

  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [previewMode, setPreviewMode] = useState<'flip' | 'side-by-side'>('flip');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedAlert, setCopiedAlert] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'style' | 'emblem' | 'qr' | 'print' | 'ai'>('info');

  // AI Generation State
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const cardPreviewRef = useRef<HTMLDivElement | null>(null);

  const logoDragActive = useRef(false);
  const qrDragActive = useRef(false);
  const nameDragActive = useRef(false);

  const [editorError, setEditorError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ past: VisitingCardData[]; future: VisitingCardData[] }>({
    past: [],
    future: []
  });
  const previousCardRef = useRef(cardData);
  const restoringRef = useRef(false);

  // Undo/Redo checkpoint management
  useEffect(() => {
    if (restoringRef.current) {
      restoringRef.current = false;
      previousCardRef.current = cardData;
      return;
    }
    if (previousCardRef.current !== cardData) {
      const snapshot = previousCardRef.current;
      previousCardRef.current = cardData;
      setHistory(prev => ({ past: [...prev.past.slice(-24), snapshot], future: [] }));
    }
  }, [cardData]);

  useEffect(() => {
    setLogoPreview(cardData.logoDataUrl || null);
  }, [cardData.logoDataUrl]);

  const undo = () => {
    if (history.past.length === 0) return;
    const restored = history.past[history.past.length - 1];
    restoringRef.current = true;
    setHistory(prev => ({
      past: prev.past.slice(0, -1),
      future: [cardData, ...prev.future].slice(0, 25)
    }));
    setCardData(restored);
  };

  const redo = () => {
    if (history.future.length === 0) return;
    const restored = history.future[0];
    restoringRef.current = true;
    setHistory(prev => ({
      past: [...prev.past.slice(-24), cardData],
      future: prev.future.slice(1)
    }));
    setCardData(restored);
  };

  // Keyboard shortcut listener for Ctrl+Z and Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, cardData]);

  const moveLogoByPointer = (event: React.PointerEvent<HTMLElement>) => {
    if (!logoDragActive.current || !cardPreviewRef.current) return;
    const rect = cardPreviewRef.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(92, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(9, Math.min(91, ((event.clientY - rect.top) / rect.height) * 100));
    setCardData(prev => ({ ...prev, logoX: Math.round(x), logoY: Math.round(y) }));
  };

  const moveQrByPointer = (event: React.PointerEvent<HTMLElement>) => {
    if (!qrDragActive.current || !cardPreviewRef.current) return;
    const rect = cardPreviewRef.current.getBoundingClientRect();
    setCardData(prev => ({
      ...prev,
      qrX: Math.round(Math.max(12, Math.min(88, ((event.clientX - rect.left) / rect.width) * 100))),
      qrY: Math.round(Math.max(14, Math.min(88, ((event.clientY - rect.top) / rect.height) * 100)))
    }));
  };

  const moveNameByPointer = (event: React.PointerEvent<HTMLElement>) => {
    if (!nameDragActive.current || !cardPreviewRef.current) return;
    const rect = cardPreviewRef.current.getBoundingClientRect();
    setCardData(prev => ({
      ...prev,
      nameX: Math.round(Math.max(5, Math.min(70, ((event.clientX - rect.left) / rect.width) * 100))),
      nameY: Math.round(Math.max(12, Math.min(82, ((event.clientY - rect.top) / rect.height) * 100)))
    }));
  };

  const isPortrait = cardData.orientation === 'portrait';
  const activeTheme = resolveCardTheme(cardData);
  const fontFamily = CARD_FONT_CSS[cardData.font || 'sans'];
  const fontScale = cardData.fontScale || 1;
  const cardSize = CARD_SIZES[cardData.size || 'us'];

  // Toggle Contact URL QR code auto-generation and embedding
  const handleToggleContactUrlQr = useCallback((enabled: boolean) => {
    setCardData(prev => toggleContactUrlQr(prev, enabled));
    if (enabled) {
      const targetUrl = cardData.website ? normalizeContactUrl(cardData.website) : 'https://ranknova.app';
      setCopiedAlert(`Auto-generated and embedded QR code linking to: ${targetUrl}`);
    } else {
      setCopiedAlert('QR code disabled on visiting card.');
    }
    setTimeout(() => setCopiedAlert(null), 3000);
  }, [cardData.website]);

  // Generate QR code whenever relevant fields change
  useEffect(() => {
    let isCancelled = false;

    async function generateCardQr() {
      const isEmbedUrlQr = cardData.embedContactUrlQr ?? (cardData.qrType === 'website');

      if (cardData.qrType === 'none' && !cardData.embedContactUrlQr) {
        setQrDataUrl(null);
        return;
      }

      let payload = normalizeContactUrl(cardData.website);
      if (isEmbedUrlQr || cardData.qrType === 'website') {
        payload = getContactUrlQrPayload(cardData);
      } else if (cardData.qrType === 'vcard') {
        payload = generateCardVCardPayload(cardData);
      } else if (cardData.qrType === 'whatsapp') {
        const raw = (cardData.whatsapp || cardData.phone || '').replace(/[^0-9]/g, '');
        payload = `https://wa.me/${raw || '15551234567'}`;
      } else if (cardData.qrType === 'phone') {
        payload = `tel:${cardData.phone || '+15551234567'}`;
      } else if (cardData.qrType === 'email') {
        payload = `mailto:${cardData.email || 'hello@example.com'}`;
      }

      try {
        const url = await QRCode.toDataURL(payload, {
          width: 360,
          margin: 4,
          color: {
            dark: /^#[0-9a-fA-F]{6}$/.test(cardData.qrColor || '') ? cardData.qrColor! : '#0F172A',
            light: '#FFFFFFFF'
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
  }, [
    cardData.qrType,
    cardData.embedContactUrlQr,
    cardData.website,
    cardData.fullName,
    cardData.companyName,
    cardData.phone,
    cardData.email,
    cardData.jobTitle,
    cardData.address,
    cardData.whatsapp,
    cardData.qrColor
  ]);

  // Handle Logo Upload
  const handleLogoUpload = async (file: File) => {
    setEditorError(null);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Logo must be 2 MB or smaller.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const checked = validateImageSignature(bytes, 2 * 1024 * 1024);
      if (!checked.valid) throw new Error(checked.error || 'Please select a valid PNG, JPEG or WebP image.');
      const objectUrl = URL.createObjectURL(file);
      try {
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('Could not decode logo image.'));
          image.src = objectUrl;
        });
        const safe = checkImageDimensionSafety(image.naturalWidth, image.naturalHeight);
        if (!safe.safe) throw new Error(safe.error || 'Logo image is too large.');
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          setLogoPreview(result);
          setCardData(prev => ({ ...prev, logoDataUrl: result }));
        }
      };
      reader.onerror = () => setEditorError('Logo upload failed. Please try a different image.');
      reader.readAsDataURL(file);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Unable to upload logo.');
    }
  };

  // AI Visiting Card Style Generation Handler
  const handleGenerateAiStyle = async (overridePrompt?: string) => {
    const promptToUse = (overridePrompt || aiPrompt).trim();
    if (!promptToUse) return;

    setIsGeneratingAi(true);
    setAiStatusMessage('Synthesizing bespoke color palette & structure...');

    try {
      if (window.location.hostname.endsWith('.github.io')) {
        throw new Error('Static offline mode');
      }
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
        setCardData(prev => ({
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
        throw new Error(data.error || 'AI style service is unavailable.');
      }
    } catch {
      // Offline fallback: curated keyword-based palettes
      const suggestion = suggestCardStyle(promptToUse);
      setCardData(prev => ({
        ...prev,
        ...suggestion,
        customPalette: null,
        customAccent: undefined,
        customBgFront: undefined,
        customBgBack: undefined,
        customText: undefined,
        aiRationale: null
      }));
      setAiStatusMessage('Smart curated style applied instantly.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Load Preset
  const handleApplyPreset = (presetId: string) => {
    const preset = CARD_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setCardData(prev => ({
      ...prev,
      ...preset.data,
      customAccent: undefined,
      customBgFront: undefined,
      customBgBack: undefined,
      customText: undefined,
      customPalette: null
    }));
    setCopiedAlert(`Loaded preset: ${preset.name}`);
    setTimeout(() => setCopiedAlert(null), 3000);
  };

  // Save / Export JSON
  const handleExportJson = () => {
    const json = exportCardAsJson(cardData);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanName = (cardData.fullName || 'visiting-card').toLowerCase().replace(/[^a-z0-9]/g, '-');
    a.download = `${cleanName}-design.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result;
      if (typeof text === 'string') {
        const loaded = parseCardFromJson(text);
        if (loaded) {
          setCardData(loaded);
          setCopiedAlert('Design loaded successfully!');
          setTimeout(() => setCopiedAlert(null), 3000);
        } else {
          setEditorError('Invalid card design JSON file.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Direct Browser Print
  const handlePrintSheet = () => {
    window.print();
  };

  // Draw background decorative patterns on 300 DPI canvas
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
      ctx.strokeStyle = theme.accent + '25';
      ctx.lineWidth = 1;
      const step = 32;
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
      ctx.strokeRect(22, 22, W - 44, H - 44);
      ctx.lineWidth = 1;
      ctx.strokeStyle = theme.accent + '77';
      ctx.strokeRect(30, 30, W - 60, H - 60);

      const corner = 20;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(18, 18, corner, 4);
      ctx.fillRect(18, 18, 4, corner);
      ctx.fillRect(W - 18 - corner, 18, corner, 4);
      ctx.fillRect(W - 22, 18, 4, corner);
      ctx.fillRect(18, H - 22, corner, 4);
      ctx.fillRect(18, H - 18 - corner, 4, corner);
      ctx.fillRect(W - 18 - corner, H - 22, corner, 4);
      ctx.fillRect(W - 22, H - 18 - corner, 4, corner);
    } else if (pattern === 'radial-glow') {
      const grad = ctx.createRadialGradient(W - 90, 90, 20, W - 90, 90, 360);
      grad.addColorStop(0, theme.accent + '4D');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(W - 90, 90, 360, 0, Math.PI * 2);
      ctx.fill();
    } else if (pattern === 'minimal-dots') {
      ctx.fillStyle = theme.accent + '33';
      const gap = 28;
      for (let x = W - 240; x < W - 30; x += gap) {
        for (let y = 30; y < 240; y += gap) {
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (pattern === 'geometric-lines') {
      ctx.strokeStyle = theme.accent + '2E';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(W - 360 + i * 45, 0);
        ctx.lineTo(W - 100 + i * 45, H);
        ctx.stroke();
      }
    } else if (pattern === 'diagonal-stripe') {
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.moveTo(W - 160, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(W, 160);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  // Render high-res 300 DPI canvas for export
  const renderCardToCanvas = async (
    side: 'front' | 'back',
    format: 'png' | 'jpeg' = 'png'
  ): Promise<string> => {
    const canvas = document.createElement('canvas');
    const W = isPortrait ? 600 : 1050;
    const H = isPortrait ? 1050 : 600;

    canvas.width = isPortrait ? cardSize.heightPx : cardSize.widthPx;
    canvas.height = isPortrait ? cardSize.widthPx : cardSize.heightPx;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    ctx.scale(canvas.width / W, canvas.height / H);
    const face = getCanvasFont(cardData.font || 'sans');
    const textScale = cardData.fontScale || 1;
    const theme = activeTheme;

    // Corner radius clipping if selected
    if (cardData.cornerRadius && cardData.cornerRadius !== 'none') {
      const radius = cardData.cornerRadius === 'extra' ? 44 : 26;
      ctx.beginPath();
      ctx.roundRect(0, 0, W, H, radius);
      ctx.clip();
    }

    // Base background fill
    ctx.fillStyle = side === 'front' ? theme.bgFront : theme.bgBack;
    ctx.fillRect(0, 0, W, H);

    // Decorative graphics & patterns
    drawPattern(ctx, cardData.pattern || theme.pattern, theme, W, H);

    // Glass Card Layout Frost Overlay
    if (cardData.layout === 'glass-card') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.roundRect(30, 30, W - 60, H - 60, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (isPortrait) {
      ctx.textAlign = 'left';
      if (side === 'front') {
        ctx.fillStyle = theme.accent;
        ctx.fillRect(0, 0, W, 14);

        ctx.font = `bold ${Math.round(26 * textScale)}px ${face}`;
        ctx.fillText((cardData.companyName || 'YOUR COMPANY').toUpperCase(), 50, 270, W - 100);

        ctx.fillStyle = theme.primaryText;
        ctx.font = `bold ${Math.round(44 * textScale)}px ${face}`;
        ctx.fillText(
          cardData.fullName || 'Your Name',
          (W * (cardData.nameX ?? 10)) / 100,
          (H * (cardData.nameY ?? 36)) / 100,
          W - 90
        );

        ctx.fillStyle = theme.accent;
        ctx.font = `600 ${Math.round(22 * textScale)}px ${face}`;
        ctx.fillText(cardData.jobTitle || 'Your Profession', 50, 460, W - 100);

        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(50, 500);
        ctx.lineTo(W - 50, 500);
        ctx.stroke();

        const detailLines = [
          ['TEL', cardData.phone],
          ['EML', cardData.email],
          ['WEB', cardData.website],
          ['LOC', cardData.address]
        ];

        detailLines.forEach(([label, value], idx) => {
          if (!value) return;
          const y = 565 + idx * 52;
          ctx.fillStyle = theme.accent;
          ctx.font = `700 17px ${face}`;
          ctx.fillText(label, 50, y, 55);
          ctx.fillStyle = theme.secondaryText;
          ctx.font = `500 ${Math.round(18 * textScale)}px ${face}`;
          ctx.fillText(value, 110, y, W - 150);
        });

        if (qrDataUrl && (cardData.embedContactUrlQr || cardData.qrType !== 'none')) {
          const qrImg = new Image();
          qrImg.src = qrDataUrl;
          await new Promise(resolve => {
            qrImg.onload = resolve;
            qrImg.onerror = resolve;
          });
          if (qrImg.naturalWidth > 0) {
            const qrSize = cardData.qrSize || 150;
            const x = Math.max(0, Math.min(W - qrSize, (W * (cardData.qrX ?? 50)) / 100 - qrSize / 2));
            const y = Math.max(0, Math.min(H - qrSize - 22, (H * (cardData.qrY ?? 85)) / 100 - qrSize / 2));
            ctx.fillStyle = '#FFFFFF';
            ctx.roundRect(x - 6, y - 6, qrSize + 12, qrSize + 12, 12);
            ctx.fill();
            ctx.drawImage(qrImg, x, y, qrSize, qrSize);
            ctx.font = `600 13px ${face}`;
            ctx.textAlign = 'center';
            ctx.fillStyle = theme.secondaryText;
            ctx.fillText(
              (cardData.embedContactUrlQr || cardData.qrType === 'website')
                ? 'SCAN TO VISIT'
                : cardData.qrType === 'vcard'
                ? 'SCAN TO SAVE VCARD'
                : 'SCAN TO CONNECT',
              x + qrSize / 2,
              y + qrSize + 22
            );
            ctx.textAlign = 'left';
          }
        }
      } else {
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.round(46 * textScale)}px ${face}`;
        ctx.fillStyle = theme.primaryText;
        ctx.fillText(cardData.companyName || 'YOUR COMPANY', W / 2, 545, W - 90);

        ctx.fillStyle = theme.secondaryText;
        ctx.font = `500 ${Math.round(24 * textScale)}px ${face}`;
        ctx.fillText(cardData.tagline || 'Your Brand. Your Story.', W / 2, 605, W - 90);

        ctx.fillStyle = theme.accent;
        ctx.font = `600 20px ${face}`;
        ctx.fillText(cardData.website || 'https://example.com', W / 2, 705, W - 90);

        const social = [cardData.linkedIn, cardData.twitter, cardData.instagram].filter(Boolean).join('  •  ');
        if (social) {
          ctx.fillStyle = theme.secondaryText;
          ctx.font = `500 16px ${face}`;
          ctx.fillText(social, W / 2, 755, W - 90);
        }
        ctx.textAlign = 'left';
      }

      // Portrait Logo or Emblem
      if (logoPreview) {
        const image = new Image();
        image.src = logoPreview;
        await new Promise(resolve => {
          image.onload = resolve;
          image.onerror = resolve;
        });
        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
          const maxWidth = 150 * (cardData.logoScale || 1);
          const maxHeight = 105 * (cardData.logoScale || 1);
          const ratio = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
          const w = ratio * image.naturalWidth;
          const h = ratio * image.naturalHeight;
          const centerX = side === 'front' ? (W * (cardData.logoX ?? 50)) / 100 : W / 2;
          const centerY = side === 'front' ? (H * (cardData.logoY ?? 15)) / 100 : 340;
          ctx.drawImage(image, centerX - w / 2, centerY - h / 2, w, h);
        }
      } else {
        const cx = side === 'front' ? (W * (cardData.logoX ?? 50)) / 100 : W / 2;
        const cy = side === 'front' ? (H * (cardData.logoY ?? 15)) / 100 : 340;
        drawEmblemOnCanvas(
          ctx,
          cardData.emblemIcon || 'monogram',
          cardData.companyName || 'N',
          theme.accent,
          side === 'front' ? theme.bgFront : theme.bgBack,
          cx,
          cy,
          side === 'front' ? 68 * (cardData.logoScale || 1) : 100 * (cardData.logoScale || 1)
        );
      }

      return canvas.toDataURL(`image/${format}`, format === 'jpeg' ? 0.95 : undefined);
    }

    // LANDSCAPE MODE
    if (side === 'front') {
      if (cardData.layout === 'split') {
        ctx.fillStyle = theme.accent;
        ctx.fillRect(0, 0, 36, H);
      } else if (cardData.layout === 'accent-border') {
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 10;
        ctx.strokeRect(22, 22, W - 44, H - 44);
      } else if (cardData.layout === 'neo-brutalist') {
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 8;
        ctx.strokeRect(16, 16, W - 32, H - 32);
        ctx.fillStyle = theme.accent;
        ctx.fillRect(24, H - 34, W - 48, 8);
      } else if (cardData.layout === 'executive-banner') {
        ctx.fillStyle = theme.accent;
        ctx.fillRect(0, 0, W, 22);
      }

      const startX = cardData.layout === 'split' ? 86 : cardData.layout === 'accent-border' ? 78 : 70;

      // Brand / Company Name
      ctx.fillStyle = theme.accent;
      ctx.font = `bold ${Math.round(24 * textScale)}px ${face}`;
      ctx.fillText((cardData.companyName || 'YOUR COMPANY').toUpperCase(), startX, 95, 560);

      // Person Name
      ctx.fillStyle = theme.primaryText;
      ctx.font = `bold ${Math.round(52 * textScale)}px ${face}`;
      ctx.fillText(
        cardData.fullName || 'Your Name',
        (W * (cardData.nameX ?? 7)) / 100,
        (H * (cardData.nameY ?? 28)) / 100,
        680
      );

      // Job Title Badge
      const titleText = cardData.jobTitle || 'Founder & Principal Architect';
      ctx.font = `600 ${Math.round(22 * textScale)}px ${face}`;
      const titleWidth = ctx.measureText(titleText).width;

      ctx.fillStyle = theme.badgeBg;
      ctx.beginPath();
      ctx.roundRect(startX, 180, Math.min(titleWidth + 28, W - startX - 70), 40, 8);
      ctx.fill();

      ctx.fillStyle = theme.badgeText;
      ctx.fillText(titleText, startX + 14, 208, W - startX - 90);

      // Subtle divider line
      ctx.strokeStyle = theme.secondaryText + '35';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(startX, 252);
      ctx.lineTo(W - 70, 252);
      ctx.stroke();

      // Contact Info Grid
      const contactStartY = 305;
      const col1X = startX;
      ctx.font = `500 ${Math.round(20 * textScale)}px ${face}`;

      // Phone
      ctx.fillStyle = theme.accent;
      ctx.fillText('TEL', col1X, contactStartY);
      ctx.fillStyle = theme.secondaryText;
      ctx.fillText(cardData.phone || '+1 (555) 000-0000', col1X + 55, contactStartY);

      // Email
      ctx.fillStyle = theme.accent;
      ctx.fillText('EML', col1X, contactStartY + 48);
      ctx.fillStyle = theme.secondaryText;
      ctx.fillText(cardData.email || 'contact@example.com', col1X + 55, contactStartY + 48);

      // Web
      ctx.fillStyle = theme.accent;
      ctx.fillText('WEB', col1X, contactStartY + 96);
      ctx.fillStyle = theme.secondaryText;
      ctx.fillText(cardData.website || 'https://ranknova.app', col1X + 55, contactStartY + 96);

      // Location
      ctx.fillStyle = theme.accent;
      ctx.fillText('LOC', col1X, contactStartY + 144);
      ctx.fillStyle = theme.secondaryText;
      ctx.fillText(cardData.address || 'San Francisco, CA', col1X + 55, contactStartY + 144);

      // QR Code on right side
      if (qrDataUrl && (cardData.embedContactUrlQr || cardData.qrType !== 'none')) {
        const qrImg = new Image();
        qrImg.src = qrDataUrl;
        await new Promise(r => {
          qrImg.onload = r;
          qrImg.onerror = r;
        });
        const qrSize = cardData.qrSize || 150;
        const qrX = Math.max(0, Math.min(W - qrSize, (W * (cardData.qrX ?? 85)) / 100 - qrSize / 2));
        const qrY = Math.max(0, Math.min(H - qrSize - 26, (H * (cardData.qrY ?? 68)) / 100 - qrSize / 2));

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.roundRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 12);
        ctx.fill();

        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

        ctx.fillStyle = theme.secondaryText;
        ctx.font = `600 13px ${face}`;
        ctx.textAlign = 'center';
        ctx.fillText(
          (cardData.embedContactUrlQr || cardData.qrType === 'website')
            ? 'SCAN TO VISIT'
            : cardData.qrType === 'vcard'
            ? 'SAVE CONTACT'
            : 'SCAN TO CONNECT',
          qrX + qrSize / 2,
          qrY + qrSize + 24
        );
        ctx.textAlign = 'left';
      }

      // Front Logo or Vector Emblem
      if (logoPreview) {
        const logoImg = new Image();
        logoImg.src = logoPreview;
        await new Promise(r => {
          logoImg.onload = r;
          logoImg.onerror = r;
        });
        if (logoImg.naturalWidth > 0 && logoImg.naturalHeight > 0) {
          const maxLogoH = 75 * (cardData.logoScale || 1);
          const maxLogoW = 150 * (cardData.logoScale || 1);
          const scale = Math.min(maxLogoW / logoImg.naturalWidth, maxLogoH / logoImg.naturalHeight);
          const lw = logoImg.naturalWidth * scale;
          const lh = logoImg.naturalHeight * scale;
          const centerX = (W * (cardData.logoX ?? 88)) / 100;
          const centerY = (H * (cardData.logoY ?? 16)) / 100;
          ctx.drawImage(logoImg, centerX - lw / 2, centerY - lh / 2, lw, lh);
        }
      } else {
        const centerX = (W * (cardData.logoX ?? 88)) / 100;
        const centerY = (H * (cardData.logoY ?? 16)) / 100;
        drawEmblemOnCanvas(
          ctx,
          cardData.emblemIcon || 'monogram',
          cardData.companyName || 'N',
          theme.accent,
          theme.bgFront,
          centerX,
          centerY,
          56 * (cardData.logoScale || 1)
        );
      }
    } else {
      // BACK OF CARD: Architectural centered luxury presentation
      const centerX = W / 2;
      const centerY = H / 2;

      if (logoPreview) {
        const logoImg = new Image();
        logoImg.src = logoPreview;
        await new Promise(r => {
          logoImg.onload = r;
          logoImg.onerror = r;
        });
        if (logoImg.naturalWidth > 0 && logoImg.naturalHeight > 0) {
          const logoSize = 120 * (cardData.logoScale || 1);
          const scale = Math.min(logoSize / logoImg.naturalWidth, logoSize / logoImg.naturalHeight);
          const lw = logoImg.naturalWidth * scale;
          const lh = logoImg.naturalHeight * scale;
          ctx.drawImage(logoImg, centerX - lw / 2, centerY - 135, lw, lh);
        }
      } else {
        drawEmblemOnCanvas(
          ctx,
          cardData.emblemIcon || 'monogram',
          cardData.companyName || 'N',
          theme.accent,
          theme.bgBack,
          centerX,
          centerY - 75,
          80 * (cardData.logoScale || 1)
        );
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = theme.primaryText;
      ctx.font = `bold ${Math.round(44 * textScale)}px ${face}`;
      ctx.fillText(cardData.companyName || 'YOUR COMPANY', centerX, centerY + 36, W - 140);

      ctx.fillStyle = theme.secondaryText;
      ctx.font = `500 ${Math.round(22 * textScale)}px ${face}`;
      ctx.fillText(cardData.tagline || 'Your Brand. Your Story.', centerX, centerY + 80, W - 140);

      ctx.fillStyle = theme.accent;
      ctx.font = `600 ${Math.round(19 * textScale)}px ${face}`;
      ctx.fillText(cardData.website || 'https://ranknova.app', centerX, H - 70, W - 140);

      const socials = [cardData.linkedIn, cardData.twitter, cardData.github, cardData.instagram]
        .filter(Boolean)
        .join('  •  ');
      if (socials) {
        ctx.fillStyle = theme.secondaryText;
        ctx.font = `500 16px ${face}`;
        ctx.fillText(socials, centerX, H - 38, W - 150);
      }

      ctx.textAlign = 'left';
    }

    return canvas.toDataURL(`image/${format}`, format === 'jpeg' ? 0.95 : undefined);
  };

  const handleDownloadImage = async (side: 'front' | 'back', format: 'png' | 'jpeg') => {
    setIsExporting(true);
    setEditorError(null);
    try {
      const dataUrl = await renderCardToCanvas(side, format);
      const safeName = (cardData.fullName || 'visiting-card').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${safeName}-${side}-300dpi.${format === 'jpeg' ? 'jpg' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Could not generate image export.');
    } finally {
      setIsExporting(false);
    }
  };

  // Download 2-Page Print-Ready PDF
  const handleDownloadPdf = async () => {
    setIsExporting(true);
    setEditorError(null);
    try {
      const frontDataUrl = await renderCardToCanvas('front');
      const backDataUrl = await renderCardToCanvas('back');

      const pdfBytes = await createVisitingCardPdf(
        frontDataUrl,
        backDataUrl,
        cardData.size || 'us',
        cardData.orientation || 'landscape'
      );
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const safeName = (cardData.fullName || 'visiting-card').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}-business-card-print-ready.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Could not create the PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  // Render individual card side DOM for interactive preview
  const renderCardSideContent = (side: 'front' | 'back') => {
    const isFront = side === 'front';
    return (
      <div
        className="relative w-full h-full p-6 sm:p-7 transition-all duration-300 select-none overflow-hidden"
        style={{
          backgroundColor: isFront ? activeTheme.bgFront : activeTheme.bgBack,
          fontFamily,
          borderRadius:
            cardData.cornerRadius === 'extra'
              ? '24px'
              : cardData.cornerRadius === 'rounded'
              ? '16px'
              : '0px'
        }}
      >
        {/* Finish Sheen */}
        {cardData.finishStyle === 'glass' && (
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 pointer-events-none" />
        )}
        {cardData.finishStyle === 'metallic' && (
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-white/10 to-amber-500/5 pointer-events-none" />
        )}

        {/* Bleed & Safe Guide Overlay */}
        {cardData.showBleedGuides && (
          <div className="absolute inset-0 pointer-events-none z-30">
            <div className="absolute inset-1.5 border border-dashed border-red-500/60 rounded" />
            <div className="absolute inset-4 border border-dashed border-emerald-500/60 rounded" />
            <span className="absolute top-1 left-2 text-[9px] font-mono text-red-500">Bleed (1/8")</span>
            <span className="absolute top-4 left-5 text-[9px] font-mono text-emerald-500">Safe Margin</span>
          </div>
        )}

        {/* Glass Card Floating Panel */}
        {cardData.layout === 'glass-card' && (
          <div className="absolute inset-3 rounded-xl bg-white/5 border border-white/15 backdrop-blur-[2px] pointer-events-none" />
        )}

        {isFront ? (
          <div className="relative h-full flex flex-col justify-between text-left">
            {/* Split accent bar */}
            {cardData.layout === 'split' && (
              <div
                className="absolute -left-7 -top-7 -bottom-7 w-3.5"
                style={{ backgroundColor: activeTheme.accent }}
              />
            )}
            {/* Accent border */}
            {cardData.layout === 'accent-border' && (
              <div
                className="absolute inset-2 border-2 pointer-events-none rounded-lg"
                style={{ borderColor: activeTheme.accent }}
              />
            )}
            {/* Neo-brutalist border */}
            {cardData.layout === 'neo-brutalist' && (
              <div
                className="absolute inset-2 border-2 pointer-events-none rounded-sm"
                style={{ borderColor: activeTheme.accent }}
              />
            )}
            {/* Executive banner */}
            {cardData.layout === 'executive-banner' && (
              <div
                className="absolute -left-7 -top-7 -right-7 h-2.5"
                style={{ backgroundColor: activeTheme.accent }}
              />
            )}

            {/* Header row: Company name & Logo/Emblem */}
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="text-[10px] sm:text-[11px] font-bold tracking-widest uppercase"
                  style={{ color: activeTheme.accent, fontFamily }}
                >
                  {cardData.companyName || 'YOUR COMPANY'}
                </p>
                <span
                  className="inline-block mt-1 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-semibold rounded-md shadow-xs"
                  style={{
                    backgroundColor: activeTheme.badgeBg,
                    color: activeTheme.badgeText,
                    fontFamily,
                    fontSize: `${11 * fontScale}px`
                  }}
                >
                  {cardData.jobTitle || 'Founder & Principal Architect'}
                </span>
              </div>

              {/* Logo or Emblem Display */}
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Company Logo"
                  draggable={false}
                  onPointerDown={e => {
                    logoDragActive.current = true;
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={moveLogoByPointer}
                  onPointerUp={e => {
                    logoDragActive.current = false;
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    }
                  }}
                  onPointerCancel={() => {
                    logoDragActive.current = false;
                  }}
                  className="absolute z-20 object-contain rounded cursor-grab active:cursor-grabbing touch-none select-none"
                  style={{
                    width: `${Math.round((cardData.logoScale || 1) * 70)}px`,
                    height: `${Math.round((cardData.logoScale || 1) * 40)}px`,
                    left: `${cardData.logoX ?? 88}%`,
                    top: `${cardData.logoY ?? 16}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                />
              ) : (
                <div
                  onPointerDown={e => {
                    logoDragActive.current = true;
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={moveLogoByPointer}
                  onPointerUp={e => {
                    logoDragActive.current = false;
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    }
                  }}
                  onPointerCancel={() => {
                    logoDragActive.current = false;
                  }}
                  className="absolute z-20 cursor-grab active:cursor-grabbing touch-none select-none"
                  style={{
                    left: `${cardData.logoX ?? 88}%`,
                    top: `${cardData.logoY ?? 16}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-md"
                    style={{ backgroundColor: activeTheme.accent, color: activeTheme.bgFront }}
                  >
                    {cardData.companyName ? cardData.companyName.charAt(0).toUpperCase() : 'N'}
                  </div>
                </div>
              )}
            </div>

            {/* Draggable Person Name */}
            <h3
              className="absolute z-20 font-extrabold tracking-tight cursor-grab active:cursor-grabbing touch-none select-none"
              title="Drag name to reposition"
              onPointerDown={e => {
                nameDragActive.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={moveNameByPointer}
              onPointerUp={e => {
                nameDragActive.current = false;
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              }}
              onPointerCancel={() => {
                nameDragActive.current = false;
              }}
              style={{
                color: activeTheme.primaryText,
                fontFamily,
                fontSize: `${(isPortrait ? 20 : 22) * fontScale}px`,
                left: `${cardData.nameX ?? 7}%`,
                top: `${cardData.nameY ?? 27}%`,
                transform: 'translateY(-50%)'
              }}
            >
              {cardData.fullName || 'Your Name'}
            </h3>

            {/* Draggable QR Code */}
            {qrDataUrl && (cardData.embedContactUrlQr || cardData.qrType !== 'none') && (
              <div
                className="absolute z-20 text-center"
                style={{
                  width: `${((cardData.qrSize || 150) / (isPortrait ? 600 : 1050)) * 100}%`,
                  left: `${cardData.qrX ?? 85}%`,
                  top: `${cardData.qrY ?? 68}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <img
                  src={qrDataUrl}
                  alt="Scannable QR Code"
                  draggable={false}
                  onPointerDown={e => {
                    qrDragActive.current = true;
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={moveQrByPointer}
                  onPointerUp={e => {
                    qrDragActive.current = false;
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    }
                  }}
                  onPointerCancel={() => {
                    qrDragActive.current = false;
                  }}
                  className="w-full aspect-square bg-white p-1 rounded-lg shadow-md cursor-grab active:cursor-grabbing touch-none select-none"
                />
                <span
                  className="block text-[8px] sm:text-[9px] font-semibold mt-1 uppercase tracking-wider"
                  style={{ color: activeTheme.secondaryText }}
                >
                  {(cardData.embedContactUrlQr || cardData.qrType === 'website')
                    ? 'Visit Website'
                    : cardData.qrType === 'vcard'
                    ? 'Save vCard'
                    : 'Connect'}
                </span>
              </div>
            )}

            {/* Bottom Contact Details */}
            <div className="pt-2 border-t border-white/10 space-y-1 text-[10px] sm:text-[11px] leading-tight max-w-[65%]">
              <div className="flex items-center gap-1.5" style={{ color: activeTheme.secondaryText }}>
                <Phone className="h-3 w-3 shrink-0" style={{ color: activeTheme.accent }} />
                <span className="truncate">{cardData.phone || '+1 (555) 123-4567'}</span>
              </div>
              <div className="flex items-center gap-1.5" style={{ color: activeTheme.secondaryText }}>
                <Mail className="h-3 w-3 shrink-0" style={{ color: activeTheme.accent }} />
                <span className="truncate">{cardData.email || 'hello@example.com'}</span>
              </div>
              <div className="flex items-center gap-1.5" style={{ color: activeTheme.secondaryText }}>
                <Globe className="h-3 w-3 shrink-0" style={{ color: activeTheme.accent }} />
                <span className="truncate">{cardData.website || 'https://ranknova.app'}</span>
              </div>
              <div className="flex items-center gap-1.5" style={{ color: activeTheme.secondaryText }}>
                <MapPin className="h-3 w-3 shrink-0" style={{ color: activeTheme.accent }} />
                <span className="truncate">{cardData.address || 'San Francisco, CA'}</span>
              </div>
            </div>
          </div>
        ) : (
          /* BACK SIDE */
          <div className="relative h-full flex flex-col items-center justify-center text-center select-none space-y-2.5">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Logo"
                className="max-w-[120px] object-contain mb-1"
                style={{ height: `${48 * (cardData.logoScale || 1)}px` }}
              />
            ) : (
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg"
                style={{
                  backgroundColor: activeTheme.accent,
                  color: activeTheme.bgBack
                }}
              >
                {cardData.companyName ? cardData.companyName.charAt(0).toUpperCase() : 'N'}
              </div>
            )}

            <h3
              className="text-lg sm:text-xl font-extrabold tracking-wider uppercase"
              style={{
                color: activeTheme.primaryText,
                fontFamily,
                fontSize: `${18 * fontScale}px`
              }}
            >
              {cardData.companyName || 'YOUR COMPANY'}
            </h3>

            <p
              className="text-xs font-medium max-w-xs px-4"
              style={{ color: activeTheme.secondaryText }}
            >
              {cardData.tagline || 'Your Brand. Your Story.'}
            </p>

            <p
              className="text-[11px] font-semibold tracking-wide pt-1"
              style={{ color: activeTheme.accent }}
            >
              {cardData.website || 'https://ranknova.app'}
            </p>

            {(cardData.linkedIn || cardData.twitter || cardData.github || cardData.instagram) && (
              <p
                className="text-[9px] max-w-[95%] truncate font-mono pt-1"
                style={{ color: activeTheme.secondaryText }}
              >
                {[cardData.linkedIn, cardData.twitter, cardData.github, cardData.instagram]
                  .filter(Boolean)
                  .join('  •  ')}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <SEOHead
        title="Modern Visiting Card Maker — Free Business Card Generator | RankNova"
        description="Design professional modern visiting cards with 18+ luxury styles, live scannable QR codes, instant vCard export, and 300 DPI print-ready PNG, JPG and PDF downloads."
        canonicalPath="/visiting-card-generator"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'RankNova Visiting Card Maker',
          applicationCategory: 'DesignApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
        }}
      />

      {/* Hidden file input for importing JSON */}
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportJson}
      />

      <div className="py-8 sm:py-12 bg-slate-50 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header Banner */}
          <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80 mb-3 shadow-xs">
              <Sparkles className="h-3.5 w-3.5" />
              <span>18+ Modern Aesthetic Themes • QR Codes • 300 DPI Print Ready</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Modern Visiting Card Generator
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Create ultra-modern, professional business cards with real-time 3D preview, QR vCard integration, custom branding, and print-perfect 300 DPI exports.
            </p>

            <a href={import.meta.env.BASE_URL + 'ai-card-generator/'}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-800 hover:bg-indigo-100">
              <Sparkles className="h-4 w-4" /> Try prompt-based visiting, wedding & birthday card maker
            </a>
            {/* Quick 1-Click Industry Presets Carousel */}
            <div className="mt-6 flex items-center justify-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-xs font-semibold text-slate-500 shrink-0 flex items-center gap-1">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Presets:
              </span>
              {CARD_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset.id)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:text-blue-600 text-xs font-medium text-slate-700 shadow-xs transition shrink-0"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback / Copied Alert Toast */}
          {copiedAlert && (
            <div className="mb-6 max-w-md mx-auto p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between shadow-sm animate-in fade-in">
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600" /> {copiedAlert}
              </span>
            </div>
          )}

          {editorError && (
            <div className="mb-6 max-w-md mx-auto p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2 shadow-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{editorError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Form & Design Controls (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Style Template Selector (Modern Minimalist, Professional Bold, Creative Gradient) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-100 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Layout className="h-4 w-4 text-blue-600" />
                      <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900">
                        Template Style Selector
                      </h2>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Choose between 3 signature card styles to instantly align typography, layout, and colors
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200/60 shrink-0 self-start sm:self-auto">
                    3 Styles Available
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {STYLE_TEMPLATES.map(tmpl => {
                    const isSelected = (cardData.selectedTemplate || 'modern-minimalist') === tmpl.id;
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => {
                          setCardData(prev => applyStyleTemplate(prev, tmpl.id));
                          setCopiedAlert(`Switched to "${tmpl.label}" style template!`);
                          setTimeout(() => setCopiedAlert(null), 3000);
                        }}
                        className={`relative p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between group cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className={`text-xs font-bold transition ${
                                isSelected ? 'text-blue-700' : 'text-slate-900 group-hover:text-blue-600'
                              }`}
                            >
                              {tmpl.label}
                            </span>
                            {isSelected ? (
                              <span className="h-4 w-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                                <Check className="h-2.5 w-2.5 stroke-[3]" />
                              </span>
                            ) : (
                              <span className="h-4 w-4 rounded-full border border-slate-300 bg-slate-50" />
                            )}
                          </div>
                          <p className="text-[11px] font-medium text-slate-600 line-clamp-1 mb-1">
                            {tmpl.tagline}
                          </p>
                          <p className="text-[10px] text-slate-400 line-clamp-2">
                            {tmpl.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            {tmpl.previewColors.map((c, i) => (
                              <span
                                key={i}
                                className="h-3.5 w-3.5 rounded-full border border-slate-300/80 shadow-2xs"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                          <span
                            className={`text-[10px] font-semibold ${
                              isSelected ? 'text-blue-600' : 'text-slate-400'
                            }`}
                          >
                            {isSelected ? 'Active Style' : 'Choose Style'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Navigation Tabs for Customization */}
              <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs overflow-x-auto gap-1">
                {[
                  { id: 'info', label: 'Contact Info', icon: User },
                  { id: 'style', label: 'Theme & Style', icon: Palette },
                  { id: 'emblem', label: 'Logo & Emblem', icon: Building },
                  { id: 'qr', label: 'QR Code', icon: QrIcon },
                  { id: 'print', label: 'Print & Layout', icon: Sliders },
                  { id: 'ai', label: 'Smart AI', icon: Wand2 }
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: CONTACT INFO */}
              {activeTab === 'info' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5 animate-in fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600" />
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                        Personal & Professional Details
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={undo}
                        disabled={history.past.length === 0}
                        aria-label="Undo edit"
                        title="Undo (Ctrl+Z)"
                        className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-30 hover:bg-slate-50 transition"
                      >
                        <Undo2 className="h-4 w-4 text-slate-600" />
                      </button>
                      <button
                        type="button"
                        onClick={redo}
                        disabled={history.future.length === 0}
                        aria-label="Redo edit"
                        title="Redo (Ctrl+Y)"
                        className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-30 hover:bg-slate-50 transition"
                      >
                        <Redo2 className="h-4 w-4 text-slate-600" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCardData({ ...DEFAULT_CARD_DATA });
                          setEditorError(null);
                        }}
                        className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 transition"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name *</label>
                      <input
                        type="text"
                        value={cardData.fullName}
                        onChange={e => setCardData({ ...cardData, fullName: e.target.value })}
                        placeholder="e.g. Alexander Vance"
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Job Title / Specialty *</label>
                      <input
                        type="text"
                        value={cardData.jobTitle}
                        onChange={e => setCardData({ ...cardData, jobTitle: e.target.value })}
                        placeholder="e.g. Founder & Principal Architect"
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Company / Organization *</label>
                      <input
                        type="text"
                        value={cardData.companyName}
                        onChange={e => setCardData({ ...cardData, companyName: e.target.value })}
                        placeholder="e.g. Nova Dynamics"
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Tagline / Motto</label>
                      <input
                        type="text"
                        value={cardData.tagline}
                        onChange={e => setCardData({ ...cardData, tagline: e.target.value })}
                        placeholder="e.g. Engineering Tomorrow, Today."
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Phone Number *</label>
                      <input
                        type="text"
                        value={cardData.phone}
                        onChange={e => setCardData({ ...cardData, phone: e.target.value })}
                        placeholder="e.g. +1 (415) 890-2341"
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address *</label>
                      <input
                        type="email"
                        value={cardData.email}
                        onChange={e => setCardData({ ...cardData, email: e.target.value })}
                        placeholder="e.g. alexander@novadynamics.io"
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Website URL / Contact Link
                      </label>
                      <div className="relative">
                        <Globe className="h-4 w-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={cardData.website}
                          onChange={e => setCardData({ ...cardData, website: e.target.value })}
                          placeholder="e.g. https://novadynamics.io"
                          className="w-full rounded-xl border border-slate-200 pl-9 pr-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                        />
                      </div>

                      {/* Auto-generate & embed QR code toggle box */}
                      <div className="mt-2.5 p-3.5 rounded-xl border border-blue-200/80 bg-blue-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-start gap-2.5">
                          <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0 mt-0.5 shadow-xs">
                            <QrIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                Auto-Generate & Embed Contact URL QR Code
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  (cardData.embedContactUrlQr ?? cardData.qrType === 'website')
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/60'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {(cardData.embedContactUrlQr ?? cardData.qrType === 'website') ? 'Active on Card' : 'Disabled'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                              Automatically embeds a scannable QR code on your visiting card that links directly to{' '}
                              <span className="font-mono text-blue-700 font-semibold break-all">
                                {normalizeContactUrl(cardData.website)}
                              </span>
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(cardData.embedContactUrlQr ?? cardData.qrType === 'website')}
                          aria-label="Toggle auto-embed contact URL QR code"
                          onClick={() => handleToggleContactUrlQr(!Boolean(cardData.embedContactUrlQr ?? cardData.qrType === 'website'))}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 self-start sm:self-center ${
                            (cardData.embedContactUrlQr ?? cardData.qrType === 'website')
                              ? 'bg-blue-600'
                              : 'bg-slate-300'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                              (cardData.embedContactUrlQr ?? cardData.qrType === 'website')
                                ? 'translate-x-5'
                                : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Physical Address / City</label>
                      <input
                        type="text"
                        value={cardData.address}
                        onChange={e => setCardData({ ...cardData, address: e.target.value })}
                        placeholder="e.g. 100 Montgomery St, San Francisco, CA"
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  {/* Social Handles */}
                  <div className="pt-4 border-t border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                      Social Profiles & Handles (Optional)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">LinkedIn</label>
                        <input
                          type="text"
                          value={cardData.linkedIn || ''}
                          onChange={e => setCardData({ ...cardData, linkedIn: e.target.value })}
                          placeholder="linkedin.com/in/username"
                          className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Twitter / X</label>
                        <input
                          type="text"
                          value={cardData.twitter || ''}
                          onChange={e => setCardData({ ...cardData, twitter: e.target.value })}
                          placeholder="@handle"
                          className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">WhatsApp / Phone</label>
                        <input
                          type="text"
                          value={cardData.whatsapp || ''}
                          onChange={e => setCardData({ ...cardData, whatsapp: e.target.value })}
                          placeholder="+15551234567"
                          className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: THEME & STYLE */}
              {activeTab === 'style' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5 animate-in fade-in">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <Palette className="h-4 w-4 text-blue-600" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                      Curated Modern Aesthetics & Palettes
                    </h2>
                  </div>

                  {/* Themes Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto pr-1">
                    {(Object.keys(CARD_THEMES) as CardThemeId[])
                      .filter(k => k !== 'custom-ai' || cardData.customPalette)
                      .map(themeKey => {
                        const t =
                          themeKey === 'custom-ai' && cardData.customPalette
                            ? (cardData.customPalette as any)
                            : CARD_THEMES[themeKey];
                        const isSelected = cardData.theme === themeKey;
                        return (
                          <button
                            key={themeKey}
                            type="button"
                            onClick={() =>
                              setCardData({
                                ...cardData,
                                theme: themeKey,
                                customAccent: undefined,
                                customBgFront: undefined,
                                customBgBack: undefined,
                                customText: undefined
                              })
                            }
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition ${
                              isSelected
                                ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/40'
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

                  {/* Custom Palette Overrides */}
                  <div className="pt-4 border-t border-slate-100">
                    <label className="text-xs font-semibold text-slate-700 block mb-2">
                      Custom Color Overrides
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        ['customAccent', 'Accent Color', activeTheme.accent],
                        ['customBgFront', 'Front BG', activeTheme.bgFront],
                        ['customBgBack', 'Back BG', activeTheme.bgBack],
                        ['customText', 'Primary Text', activeTheme.primaryText]
                      ].map(([key, label, color]) => (
                        <label
                          key={key}
                          className="text-[11px] font-medium text-slate-700 flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="color"
                            value={color.match(/^#[0-9a-fA-F]{6}$/) ? color : '#2563EB'}
                            onChange={e => setCardData({ ...cardData, [key]: e.target.value })}
                            className="h-7 w-7 rounded border border-slate-300 cursor-pointer"
                          />
                          <span className="truncate">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Card Finish Style */}
                  <div className="pt-4 border-t border-slate-100">
                    <label className="text-xs font-semibold text-slate-700 block mb-2">Card Finish Sheen</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'glass', label: 'Glass Sheen' },
                        { id: 'matte', label: 'Matte Soft' },
                        { id: 'metallic', label: 'Metallic Foil' }
                      ].map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setCardData({ ...cardData, finishStyle: f.id as CardFinishStyle })}
                          className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                            (cardData.finishStyle || 'glass') === f.id
                              ? 'border-blue-600 bg-blue-50 text-blue-700'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: LOGO & EMBLEM */}
              {activeTab === 'emblem' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5 animate-in fade-in">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <Building className="h-4 w-4 text-blue-600" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                      Branding: Custom Logo or Vector Emblem
                    </h2>
                  </div>

                  {/* Logo Upload */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Upload Custom Logo (PNG / JPG / WebP)
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-xs"
                      >
                        <UploadCloud className="h-4 w-4 text-blue-600" />
                        <span>{logoPreview ? 'Change Logo Image' : 'Choose Logo File'}</span>
                      </button>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={e => {
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
                            setCardData(prev => ({ ...prev, logoDataUrl: null }));
                          }}
                          className="text-xs text-red-600 hover:underline font-semibold"
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Vector Emblems Picker */}
                  <div className="pt-4 border-t border-slate-100">
                    <label className="text-xs font-semibold text-slate-700 block mb-2">
                      Or Choose a Built-in Vector Emblem (Rendered sharp if no logo is uploaded)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'monogram', label: 'Initials Monogram' },
                        { id: 'spark', label: 'Nova Spark' },
                        { id: 'cube', label: 'Isometric Cube' },
                        { id: 'shield', label: 'Security Shield' },
                        { id: 'hexagon', label: 'Tech Hexagon' },
                        { id: 'leaf', label: 'Organic Leaf' },
                        { id: 'infinity', label: 'Infinity Loop' },
                        { id: 'pulse', label: 'Cardio Pulse' }
                      ].map(em => (
                        <button
                          key={em.id}
                          type="button"
                          onClick={() => setCardData({ ...cardData, emblemIcon: em.id as CardEmblemIcon })}
                          className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition ${
                            (cardData.emblemIcon || 'monogram') === em.id
                              ? 'border-blue-600 bg-blue-50 text-blue-700'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {em.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scale & Positioning Sliders */}
                  <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Logo Scale: {Math.round((cardData.logoScale || 1) * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.6"
                        max="1.6"
                        step="0.1"
                        value={cardData.logoScale || 1}
                        onChange={e => setCardData({ ...cardData, logoScale: Number(e.target.value) })}
                        className="w-full accent-blue-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Horizontal Pos: {cardData.logoX ?? 88}%
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="90"
                        step="1"
                        value={cardData.logoX ?? 88}
                        onChange={e => setCardData({ ...cardData, logoX: Number(e.target.value) })}
                        className="w-full accent-blue-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Vertical Pos: {cardData.logoY ?? 16}%
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="90"
                        step="1"
                        value={cardData.logoY ?? 16}
                        onChange={e => setCardData({ ...cardData, logoY: Number(e.target.value) })}
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: QR CODE */}
              {activeTab === 'qr' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5 animate-in fade-in">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <QrIcon className="h-4 w-4 text-blue-600" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                      Scannable QR Code Setup
                    </h2>
                  </div>

                  {/* Primary Toggle: Auto-Generate & Embed Contact URL QR Code */}
                  <div className="p-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/90 to-indigo-50/70 shadow-2xs">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs shrink-0 mt-0.5">
                          <QrIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                              Auto-Generate & Embed QR Code (Contact URL)
                            </h3>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                (cardData.embedContactUrlQr ?? cardData.qrType === 'website')
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/60'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {(cardData.embedContactUrlQr ?? cardData.qrType === 'website') ? 'Active on Card' : 'Disabled'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            Automatically encodes and embeds a scannable QR code on the visiting card linking directly to your contact URL.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(cardData.embedContactUrlQr ?? cardData.qrType === 'website')}
                        aria-label="Toggle auto-embed contact URL QR code in QR setup"
                        onClick={() => handleToggleContactUrlQr(!Boolean(cardData.embedContactUrlQr ?? cardData.qrType === 'website'))}
                        className={`relative inline-flex h-6.5 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                          (cardData.embedContactUrlQr ?? cardData.qrType === 'website')
                            ? 'bg-blue-600'
                            : 'bg-slate-300'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            (cardData.embedContactUrlQr ?? cardData.qrType === 'website')
                              ? 'translate-x-5.5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Destination URL Display & Link preview */}
                    <div className="mt-3 pt-3 border-t border-blue-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 truncate text-slate-700">
                        <span className="font-semibold text-slate-500">Destination:</span>
                        <span className="font-mono text-blue-700 font-semibold truncate">
                          {normalizeContactUrl(cardData.website)}
                        </span>
                      </div>
                      <a
                        href={normalizeContactUrl(cardData.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 shrink-0 self-start sm:self-auto"
                      >
                        <span>Test destination link</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        QR Action Type
                      </label>
                      <select
                        value={
                          (cardData.embedContactUrlQr ?? cardData.qrType === 'website')
                            ? 'website'
                            : cardData.qrType
                        }
                        onChange={e => {
                          const val = e.target.value as any;
                          if (val === 'website') {
                            setCardData({ ...cardData, qrType: 'website', embedContactUrlQr: true });
                          } else if (val === 'none') {
                            setCardData({ ...cardData, qrType: 'none', embedContactUrlQr: false });
                          } else {
                            setCardData({ ...cardData, qrType: val, embedContactUrlQr: false });
                          }
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium focus:border-blue-600 focus:outline-none"
                      >
                        <option value="website">Direct Website Link (Contact URL)</option>
                        <option value="vcard">Digital vCard (Save to Contacts)</option>
                        <option value="whatsapp">WhatsApp Direct Chat</option>
                        <option value="phone">Direct Phone Call</option>
                        <option value="email">Direct Email Message</option>
                        <option value="none">No QR Code</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">QR Foreground Color</label>
                      <select
                        value={cardData.qrColor || '#0F172A'}
                        onChange={e => setCardData({ ...cardData, qrColor: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium"
                      >
                        <option value="#0F172A">Charcoal / Onyx</option>
                        <option value="#1E3A8A">Deep Navy Blue</option>
                        <option value="#064E3B">Forest Emerald</option>
                        <option value="#7C2D12">Warm Mahogany</option>
                        <option value="#581C87">Deep Violet</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        QR Size: {cardData.qrSize || 150} px
                      </label>
                      <input
                        type="range"
                        min="110"
                        max="190"
                        step="10"
                        value={cardData.qrSize || 150}
                        onChange={e => setCardData({ ...cardData, qrSize: Number(e.target.value) })}
                        className="w-full accent-blue-600"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Horizontal Position: {cardData.qrX ?? 85}%
                      </label>
                      <input
                        type="range"
                        min="12"
                        max="88"
                        step="1"
                        value={cardData.qrX ?? 85}
                        onChange={e => setCardData({ ...cardData, qrX: Number(e.target.value) })}
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </div>

                  {/* Direct vCard Download */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Download Contact File (.vcf)</p>
                      <p className="text-[11px] text-slate-500">
                        Test and save your contact card directly to your smartphone address book.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadVCardFile(cardData)}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download .vcf</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 5: PRINT & LAYOUT */}
              {activeTab === 'print' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5 animate-in fade-in">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <Sliders className="h-4 w-4 text-blue-600" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                      Print Specifications & Layout Geometry
                    </h2>
                  </div>

                  {/* Layout Grid */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-2">Structure Layout</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {[
                        { id: 'glass-card', label: 'Glass Floating' },
                        { id: 'modern', label: 'Modern Clean' },
                        { id: 'split', label: 'Two-Tone Stripe' },
                        { id: 'accent-border', label: 'Framed Border' },
                        { id: 'classic', label: 'Corporate Classic' },
                        { id: 'neo-brutalist', label: 'Neo-Brutalist' },
                        { id: 'minimal-zen', label: 'Minimal Zen' },
                        { id: 'executive-banner', label: 'Executive Banner' }
                      ].map(l => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setCardData({ ...cardData, layout: l.id as CardLayoutId })}
                          className={`py-2 px-2.5 rounded-xl border text-center transition font-semibold ${
                            cardData.layout === l.id
                              ? 'border-blue-600 bg-blue-50 text-blue-700'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Physical Standard & Typography */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Standard Size</label>
                      <select
                        value={cardData.size || 'us'}
                        onChange={e => setCardData({ ...cardData, size: e.target.value as any })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium"
                      >
                        {Object.entries(CARD_SIZES).map(([k, s]) => (
                          <option key={k} value={k}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Orientation</label>
                      <select
                        value={cardData.orientation || 'landscape'}
                        onChange={e => setCardData({ ...cardData, orientation: e.target.value as any })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium"
                      >
                        <option value="landscape">Landscape (Horizontal)</option>
                        <option value="portrait">Portrait (Vertical)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Corner Radius</label>
                      <select
                        value={cardData.cornerRadius || 'rounded'}
                        onChange={e => setCardData({ ...cardData, cornerRadius: e.target.value as CardCornerRadius })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium"
                      >
                        <option value="none">Sharp 90° (Standard Cut)</option>
                        <option value="rounded">Modern Rounded (3mm / 16px)</option>
                        <option value="extra">Curved Round (6mm / 24px)</option>
                      </select>
                    </div>
                  </div>

                  {/* Typography Font */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Typography Family</label>
                      <select
                        value={cardData.font || 'sans'}
                        onChange={e => setCardData({ ...cardData, font: e.target.value as any })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium"
                      >
                        <option value="sans">Modern Sans (Clean & Tech)</option>
                        <option value="serif">Editorial Serif (Luxury & Law)</option>
                        <option value="mono">JetBrains Mono (Developer & Web3)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Text Scale: {Math.round((cardData.fontScale || 1) * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.75"
                        max="1.25"
                        step="0.05"
                        value={cardData.fontScale || 1}
                        onChange={e => setCardData({ ...cardData, fontScale: Number(e.target.value) })}
                        className="w-full accent-blue-600 mt-2"
                      />
                    </div>
                  </div>

                  {/* Background Graphic Motif */}
                  <div className="pt-3 border-t border-slate-100">
                    <label className="text-xs font-semibold text-slate-700 block mb-2">Graphic Motif</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {[
                        { id: 'radial-glow', label: 'Radial Flare' },
                        { id: 'cyber-grid', label: 'Cyber Grid' },
                        { id: 'gold-border', label: 'Gold Filigree' },
                        { id: 'geometric-lines', label: 'Angular Lines' },
                        { id: 'minimal-dots', label: 'Dot Matrix' },
                        { id: 'diagonal-stripe', label: 'Corner Ribbon' },
                        { id: 'none', label: 'Solid Minimal' }
                      ].map(p => (
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
              )}

              {/* TAB 6: SMART AI ASSISTANT */}
              {activeTab === 'ai' && (
                <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 rounded-2xl p-6 text-white shadow-lg border border-indigo-500/30 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wand2 className="h-5 w-5 text-indigo-400" />
                      <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                        Smart AI Card Stylist
                      </h2>
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                      Neural & Smart Fallback
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Describe your brand, industry, or preferred vibe to craft a tailored aesthetic palette, motif, and layout in seconds.
                  </p>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleGenerateAiStyle();
                      }}
                      placeholder="e.g. Minimalist Tokyo architecture firm, Cyberpunk crypto studio..."
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
                          <span>Generating...</span>
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
                      <span>Style Inspirations:</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_AI_PROMPTS.map(p => (
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

                  {aiStatusMessage && (
                    <p
                      role="status"
                      className="rounded-lg bg-indigo-950/60 border border-indigo-500/30 p-2 text-xs text-indigo-100"
                    >
                      {aiStatusMessage}
                    </p>
                  )}

                  {cardData.aiRationale && (
                    <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-xs text-indigo-200">
                      <span className="font-semibold text-indigo-300 block mb-0.5">
                        {cardData.customPalette?.name || 'Bespoke Palette'}:
                      </span>
                      <p className="text-[11px] text-slate-300">{cardData.aiRationale}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Live Interactive Card Canvas Preview & Exports (5 cols) */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
                {/* Mode Selector & Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setPreviewMode('flip')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        previewMode === 'flip'
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Interactive Flip
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('side-by-side')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        previewMode === 'side-by-side'
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Side by Side
                    </button>
                  </div>

                  {/* Bleed Guide Toggle */}
                  <button
                    type="button"
                    onClick={() => setCardData(prev => ({ ...prev, showBleedGuides: !prev.showBleedGuides }))}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                      cardData.showBleedGuides
                        ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    title="Toggle print safe & bleed guide overlay"
                  >
                    {cardData.showBleedGuides ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    <span>Guides</span>
                  </button>
                </div>

                {/* Card Canvas Container */}
                {previewMode === 'flip' ? (
                  <div className="space-y-3">
                    <div
                      ref={cardPreviewRef}
                      className="relative w-full rounded-2xl shadow-xl transition-all duration-300"
                      style={{
                        aspectRatio: isPortrait
                          ? cardData.size === 'eu'
                            ? '55 / 85'
                            : '4 / 7'
                          : cardData.size === 'eu'
                          ? '85 / 55'
                          : '7 / 4'
                      }}
                    >
                      {renderCardSideContent(activeSide)}
                    </div>

                    {/* Flip Card Button */}
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveSide(activeSide === 'front' ? 'back' : 'front')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold shadow-xs transition"
                      >
                        <Layers className="h-3.5 w-3.5 text-blue-600" />
                        <span>Flip to {activeSide === 'front' ? 'Back Side' : 'Front Side'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Side-by-side View */
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase text-slate-400 mb-1">Front Side</p>
                      <div
                        className="relative w-full rounded-2xl shadow-md"
                        style={{
                          aspectRatio: isPortrait
                            ? cardData.size === 'eu'
                              ? '55 / 85'
                              : '4 / 7'
                            : cardData.size === 'eu'
                            ? '85 / 55'
                            : '7 / 4'
                        }}
                      >
                        {renderCardSideContent('front')}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase text-slate-400 mb-1">Back Side</p>
                      <div
                        className="relative w-full rounded-2xl shadow-md"
                        style={{
                          aspectRatio: isPortrait
                            ? cardData.size === 'eu'
                              ? '55 / 85'
                              : '4 / 7'
                            : cardData.size === 'eu'
                            ? '85 / 55'
                            : '7 / 4'
                        }}
                      >
                        {renderCardSideContent('back')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Dimensions badge */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-100">
                  <span>{cardData.size === 'eu' ? '85 × 55 mm' : '3.5 × 2.0 inches'}</span>
                  <span>{isPortrait ? cardSize.heightPx : cardSize.widthPx} × {isPortrait ? cardSize.widthPx : cardSize.heightPx} px (300 DPI)</span>
                </div>

                {/* Export Options Suite */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Export Print-Ready Assets
                  </h4>

                  {/* Multi-Page PDF Download */}
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={handleDownloadPdf}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download 2-Page Print PDF (Front & Back)</span>
                  </button>

                  {/* PNG Exports */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => handleDownloadImage('front', 'png')}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-xs"
                    >
                      <Download className="h-3.5 w-3.5 text-blue-600" />
                      <span>Front PNG (300 DPI)</span>
                    </button>
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => handleDownloadImage('back', 'png')}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-xs"
                    >
                      <Download className="h-3.5 w-3.5 text-blue-600" />
                      <span>Back PNG (300 DPI)</span>
                    </button>
                  </div>

                  {/* JPG Exports */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => handleDownloadImage('front', 'jpeg')}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
                    >
                      <Download className="h-3.5 w-3.5 text-blue-600" />
                      <span>Front JPG</span>
                    </button>
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => handleDownloadImage('back', 'jpeg')}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
                    >
                      <Download className="h-3.5 w-3.5 text-blue-600" />
                      <span>Back JPG</span>
                    </button>
                  </div>

                  {/* Utility Action Buttons: Save/Load JSON & Print */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <button
                      type="button"
                      onClick={handlePrintSheet}
                      className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold transition"
                      title="Direct Print Sheet"
                    >
                      <Printer className="h-3.5 w-3.5 text-blue-600" />
                      <span>Print Sheet</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold transition"
                      title="Save design to JSON file"
                    >
                      <FileJson className="h-3.5 w-3.5 text-blue-600" />
                      <span>Save JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => jsonInputRef.current?.click()}
                      className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold transition"
                      title="Import previously saved design"
                    >
                      <Upload className="h-3.5 w-3.5 text-blue-600" />
                      <span>Load JSON</span>
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

          {/* Specifications & Commercial Standards Guide */}
          <div className="mt-12 rounded-2xl bg-white border border-slate-200 p-8 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900">
              Commercial Print Standards & Zero-Error Guide
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Export US standard (3.5" × 2.0") or International European (85 × 55 mm) business cards at exact 300 DPI high-resolution bitmap definitions. Every exported PDF and PNG maintains strict coordinate scaling, ensuring razor-sharp clarity for professional offset or digital printing.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 mb-1">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Exact 300 DPI Aspect Ratio</span>
                </div>
                <p className="text-xs text-slate-500">
                  Matches standard physical card dimensions (1050 × 600 px for US, 1004 × 650 px for EU) compatible with Moo, VistaPrint, and local print shops.
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 mb-1">
                  <QrIcon className="h-4 w-4" />
                  <span>Instant Digital vCard QR</span>
                </div>
                <p className="text-xs text-slate-500">
                  Scanning the card with an iPhone or Android camera immediately prompts users to save full contact information into their address book.
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 mb-1">
                  <Printer className="h-4 w-4" />
                  <span>2-Page Multi-Page PDF</span>
                </div>
                <p className="text-xs text-slate-500">
                  Embeds Front and Back card assets with precise point dimensions, perfect for commercial double-sided card cutting machines.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
