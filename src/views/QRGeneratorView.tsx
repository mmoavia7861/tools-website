import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Link as LinkIcon,
  Type,
  Wifi,
  Contact,
  Download,
  Copy,
  Check,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Palette
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { AdSlot } from '../components/AdSlot';
import {
  buildWifiPayload,
  buildVCardPayload,
  validateUrl,
  type WifiPayload,
  type VCardPayload
} from '../utils/qr';

type QRContentType = 'url' | 'text' | 'wifi' | 'vcard';

export const QRGeneratorView: React.FC = () => {
  const [contentType, setContentType] = useState<QRContentType>('url');

  // Input states
  const [urlInput, setUrlInput] = useState('https://ranknova.app');
  const [textInput, setTextInput] = useState('');
  const [wifiData, setWifiData] = useState<WifiPayload>({
    ssid: '',
    password: '',
    encryption: 'WPA',
    hidden: false
  });
  const [vcardData, setVcardData] = useState<VCardPayload>({
    firstName: '',
    lastName: '',
    organization: '',
    title: '',
    phone: '',
    email: '',
    website: ''
  });

  // Customization states
  const [errorCorrection, setErrorCorrection] = useState<'L' | 'M' | 'Q' | 'H'>('M');
  const [fgColor, setFgColor] = useState('#0F172A');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [margin, setMargin] = useState(2);
  const [downloadSize, setDownloadSize] = useState<number>(1024);

  // Status & copy feedback
  const [copied, setCopied] = useState(false);
  const [svgString, setSvgString] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Compute final payload string based on current tab
  const getPayload = (): string => {
    switch (contentType) {
      case 'url': {
        const validated = validateUrl(urlInput);
        if (!validated.valid && urlInput.trim() !== '') {
          return urlInput.trim();
        }
        return validated.formatted || 'https://ranknova.app';
      }
      case 'text':
        return textInput.trim() || 'RankNova Privacy-First Tools';
      case 'wifi':
        return buildWifiPayload({
          ssid: wifiData.ssid.trim() || 'MyNetwork',
          password: wifiData.password,
          encryption: wifiData.encryption,
          hidden: wifiData.hidden
        });
      case 'vcard':
        return buildVCardPayload({
          firstName: vcardData.firstName.trim() || 'Jane',
          lastName: vcardData.lastName?.trim() || 'Doe',
          organization: vcardData.organization,
          title: vcardData.title,
          phone: vcardData.phone,
          email: vcardData.email,
          website: vcardData.website
        });
      default:
        return 'https://ranknova.app';
    }
  };

  // Re-generate QR code whenever parameters change
  useEffect(() => {
    const payload = getPayload();
    setErrorMessage(null);

    if (!payload) return;

    // 1. Render on Canvas for display preview
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        payload,
        {
          errorCorrectionLevel: errorCorrection,
          color: {
            dark: fgColor,
            light: bgColor
          },
          margin: margin,
          width: 320
        },
        (err) => {
          if (err) {
            console.error('QR Canvas Error:', err);
            setErrorMessage('Data is too large for the selected error correction level.');
          }
        }
      );
    }

    // 2. Generate clean vector SVG string
    QRCode.toString(
      payload,
      {
        type: 'svg',
        errorCorrectionLevel: errorCorrection,
        color: {
          dark: fgColor,
          light: bgColor
        },
        margin: margin
      },
      (err, string) => {
        if (!err && string) {
          setSvgString(string);
        }
      }
    );
  }, [contentType, urlInput, textInput, wifiData, vcardData, errorCorrection, fgColor, bgColor, margin]);

  // High-Resolution PNG Download
  const handleDownloadPng = async () => {
    const payload = getPayload();
    if (!payload) return;

    try {
      // Create off-screen canvas with requested high resolution
      const offscreen = document.createElement('canvas');
      await QRCode.toCanvas(offscreen, payload, {
        errorCorrectionLevel: errorCorrection,
        color: {
          dark: fgColor,
          light: bgColor
        },
        margin: margin,
        width: downloadSize
      });

      const dataUrl = offscreen.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `ranknova-qr-${contentType}-${downloadSize}px.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // Clean Vector SVG Download
  const handleDownloadSvg = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ranknova-qr-${contentType}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy encoded string to clipboard
  const handleCopyPayload = async () => {
    const payload = getPayload();
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleReset = () => {
    setUrlInput('https://ranknova.app');
    setTextInput('');
    setWifiData({ ssid: '', password: '', encryption: 'WPA', hidden: false });
    setVcardData({ firstName: '', lastName: '', organization: '', title: '', phone: '', email: '', website: '' });
    setErrorCorrection('M');
    setFgColor('#0F172A');
    setBgColor('#FFFFFF');
    setMargin(2);
    setDownloadSize(1024);
  };

  return (
    <>
      <SEOHead
        title="Free QR Code Generator — PNG & SVG | RankNova"
        description="Create QR codes for URLs, text, Wi-Fi, and vCards. Customize size and colors, then download your QR code as PNG or SVG for free. 100% on-device privacy."
        canonicalPath="/qr-code-generator"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'RankNova Free QR Code Generator',
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
              <QrCode className="h-3.5 w-3.5" />
              <span>Client-Side Generation • No Server Transmission</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Free QR Code Generator
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Generate static barcodes for websites, contact cards, and Wi-Fi networks.
              Download in high-resolution PNG or infinite-scale vector SVG.
            </p>
          </div>

          {/* Main Tool Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Configuration Controls (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
              {/* Content Type Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Select Data Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setContentType('url')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-semibold transition ${
                      contentType === 'url'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    <span>Website URL</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContentType('text')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-semibold transition ${
                      contentType === 'text'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Type className="h-3.5 w-3.5" />
                    <span>Plain Text</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContentType('wifi')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-semibold transition ${
                      contentType === 'wifi'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Wifi className="h-3.5 w-3.5" />
                    <span>Wi-Fi Access</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContentType('vcard')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-semibold transition ${
                      contentType === 'vcard'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Contact className="h-3.5 w-3.5" />
                    <span>vCard Contact</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Form per Type */}
              <div className="space-y-4 pt-2">
                {contentType === 'url' && (
                  <div>
                    <label htmlFor="url-input" className="block text-xs font-medium text-slate-700 mb-1">
                      Target Website URL
                    </label>
                    <div className="relative">
                      <input
                        id="url-input"
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      RankNova encodes this URL locally. Our servers will never connect to or crawl this address.
                    </p>
                  </div>
                )}

                {contentType === 'text' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="text-input" className="block text-xs font-medium text-slate-700">
                        Plain Text Message
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {textInput.length} characters
                      </span>
                    </div>
                    <textarea
                      id="text-input"
                      rows={4}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Type or paste any text, notes, or instructions..."
                      className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                )}

                {contentType === 'wifi' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="wifi-ssid" className="block text-xs font-medium text-slate-700 mb-1">
                          Network Name (SSID)
                        </label>
                        <input
                          id="wifi-ssid"
                          type="text"
                          value={wifiData.ssid}
                          onChange={(e) => setWifiData({ ...wifiData, ssid: e.target.value })}
                          placeholder="e.g. Office_Guest"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="wifi-enc" className="block text-xs font-medium text-slate-700 mb-1">
                          Security Type
                        </label>
                        <select
                          id="wifi-enc"
                          value={wifiData.encryption}
                          onChange={(e) => setWifiData({ ...wifiData, encryption: e.target.value as any })}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        >
                          <option value="WPA">WPA / WPA2 / WPA3</option>
                          <option value="WEP">WEP</option>
                          <option value="nopass">None (Open Network)</option>
                        </select>
                      </div>
                    </div>

                    {wifiData.encryption !== 'nopass' && (
                      <div>
                        <label htmlFor="wifi-pass" className="block text-xs font-medium text-slate-700 mb-1">
                          Wi-Fi Password
                        </label>
                        <input
                          id="wifi-pass"
                          type="text"
                          value={wifiData.password}
                          onChange={(e) => setWifiData({ ...wifiData, password: e.target.value })}
                          placeholder="Network Password"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    )}

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 mt-2">
                      <input
                        type="checkbox"
                        checked={wifiData.hidden}
                        onChange={(e) => setWifiData({ ...wifiData, hidden: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Hidden SSID Network</span>
                    </label>
                  </div>
                )}

                {contentType === 'vcard' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="vc-fn" className="block text-xs font-medium text-slate-700 mb-1">
                          First Name
                        </label>
                        <input
                          id="vc-fn"
                          type="text"
                          value={vcardData.firstName}
                          onChange={(e) => setVcardData({ ...vcardData, firstName: e.target.value })}
                          placeholder="First Name"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="vc-ln" className="block text-xs font-medium text-slate-700 mb-1">
                          Last Name
                        </label>
                        <input
                          id="vc-ln"
                          type="text"
                          value={vcardData.lastName}
                          onChange={(e) => setVcardData({ ...vcardData, lastName: e.target.value })}
                          placeholder="Last Name"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="vc-org" className="block text-xs font-medium text-slate-700 mb-1">
                          Organization
                        </label>
                        <input
                          id="vc-org"
                          type="text"
                          value={vcardData.organization}
                          onChange={(e) => setVcardData({ ...vcardData, organization: e.target.value })}
                          placeholder="Company or Studio"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="vc-title" className="block text-xs font-medium text-slate-700 mb-1">
                          Job Title
                        </label>
                        <input
                          id="vc-title"
                          type="text"
                          value={vcardData.title}
                          onChange={(e) => setVcardData({ ...vcardData, title: e.target.value })}
                          placeholder="Title or Position"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="vc-phone" className="block text-xs font-medium text-slate-700 mb-1">
                          Phone Number
                        </label>
                        <input
                          id="vc-phone"
                          type="tel"
                          value={vcardData.phone}
                          onChange={(e) => setVcardData({ ...vcardData, phone: e.target.value })}
                          placeholder="+1 (555) 000-0000"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="vc-email" className="block text-xs font-medium text-slate-700 mb-1">
                          Email Address
                        </label>
                        <input
                          id="vc-email"
                          type="email"
                          value={vcardData.email}
                          onChange={(e) => setVcardData({ ...vcardData, email: e.target.value })}
                          placeholder="name@example.com"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Design & Color Controls */}
              <div className="border-t border-slate-200/80 pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Palette className="h-4 w-4 text-blue-600" />
                    <span>Styling & Colors</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset Defaults</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Foreground Color */}
                  <div>
                    <label htmlFor="fg-color" className="block text-xs font-medium text-slate-700 mb-1">
                      QR Pattern Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="fg-color"
                        type="color"
                        value={fgColor}
                        onChange={(e) => setFgColor(e.target.value)}
                        className="h-9 w-12 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                      />
                      <input
                        type="text"
                        value={fgColor}
                        onChange={(e) => setFgColor(e.target.value)}
                        className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono uppercase text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Background Color */}
                  <div>
                    <label htmlFor="bg-color" className="block text-xs font-medium text-slate-700 mb-1">
                      Background Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="bg-color"
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="h-9 w-12 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                      />
                      <input
                        type="text"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono uppercase text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Error Correction & Margin */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label htmlFor="ecc-select" className="block text-xs font-medium text-slate-700 mb-1">
                      Error Correction Level
                    </label>
                    <select
                      id="ecc-select"
                      value={errorCorrection}
                      onChange={(e) => setErrorCorrection(e.target.value as any)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="L">Level L (7% Recovery - High Density)</option>
                      <option value="M">Level M (15% Recovery - Recommended)</option>
                      <option value="Q">Level Q (25% Recovery - High Reliability)</option>
                      <option value="H">Level H (30% Recovery - Maximum Durability)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="margin-range" className="block text-xs font-medium text-slate-700 mb-1">
                      Quiet Zone (Margin): {margin} modules
                    </label>
                    <input
                      id="margin-range"
                      type="range"
                      min={0}
                      max={5}
                      step={1}
                      value={margin}
                      onChange={(e) => setMargin(parseInt(e.target.value, 10))}
                      className="w-full accent-blue-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Preview & Downloads (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 flex flex-col items-center text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                  Live Preview
                </span>

                {/* Canvas Container */}
                <div className="relative rounded-2xl p-4 border border-slate-200 bg-slate-50/50 flex items-center justify-center min-h-[300px]">
                  <canvas ref={canvasRef} className="rounded-lg shadow-2xs max-w-full h-auto" />
                </div>

                {errorMessage && (
                  <p className="mt-3 text-xs text-red-600 font-medium">{errorMessage}</p>
                )}

                {/* Resolution selector for PNG download */}
                <div className="w-full mt-6 text-left">
                  <label htmlFor="png-res-select" className="block text-xs font-medium text-slate-700 mb-1">
                    Export Resolution (PNG)
                  </label>
                  <select
                    id="png-res-select"
                    value={downloadSize}
                    onChange={(e) => setDownloadSize(parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                  >
                    <option value={512}>512 x 512 px (Standard Web)</option>
                    <option value={1024}>1024 x 1024 px (High Resolution Print)</option>
                    <option value={2048}>2048 x 2048 px (Ultra HD Banner)</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="w-full grid grid-cols-2 gap-3 mt-4">
                  <button
                    type="button"
                    onClick={handleDownloadPng}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSvg}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <Download className="h-4 w-4 text-slate-500" />
                    <span>Download SVG</span>
                  </button>
                </div>

                {/* Secondary copy action */}
                <button
                  type="button"
                  onClick={handleCopyPayload}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">Copied encoded payload!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Encoded Content</span>
                    </>
                  )}
                </button>
              </div>

              {/* Privacy badge */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Pure Client-Side Generation</p>
                  <p className="mt-0.5 text-emerald-800">
                    Your QR payload is generated entirely within your browser's JavaScript engine. It is never logged or sent across any network.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Reserved Ad Location */}
          <div className="mt-12">
            <AdSlot slotId="qr-page-bottom" format="horizontal" />
          </div>

          {/* Substantial SEO Guide & Educational Content */}
          <div className="mt-16 bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-12 space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Understanding QR Codes: How They Work and Best Practices
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Quick Response (QR) codes are 2-dimensional optical barcodes designed to store arbitrary data in an error-tolerant matrix.
                Unlike 1D linear barcodes, QR codes use mathematical Reed-Solomon redundancy algorithms that permit accurate decoding even if up to 30% of the surface area is scratched, torn, or partially obscured.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Error Correction Guidance</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Choose Level L (7%) for compact codes with maximum data capacity. Choose Level M (15%) for everyday print media.
                  Use Level Q (25%) or Level H (30%) if the code will be exposed to outdoor elements or if you plan to overlay a central logo.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Static vs. Redirect Codes</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  RankNova generates permanent static QR codes. Static codes store your actual payload directly.
                  They do not depend on third-party redirection servers, ensuring your barcode will function indefinitely without subscription fees.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Vector SVG vs. Raster PNG</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  For websites and digital screens, high-resolution PNG is ideal. For large billboards, physical signage, and professional print materials, download vector SVG to scale infinitely without pixelation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
