import React, { useState } from 'react';
import {
  QrCode,
  FileText,
  Sparkles,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  EyeOff,
  Cpu,
  CreditCard
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { AdSlot } from '../components/AdSlot';
import { FAQ_ITEMS, STARTER_BLOG_POSTS } from '../data/initialContent';

interface HomeViewProps {
  navigate: (path: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ navigate }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'RankNova',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://ranknova.app',
    description: 'Free, fast, and privacy-first online tools: QR Code Generator, PDF Compressor, and AI Background Remover.',
    publisher: {
      '@type': 'Organization',
      name: 'RankNova'
    }
  };

  return (
    <>
      <SEOHead
        title="RankNova — Free QR Code, PDF Compression & Background Removal Tools"
        description="Create QR codes, compress PDF files, and remove image backgrounds online with RankNova. Fast, simple tools designed with privacy and security in mind."
        canonicalPath="/"
        jsonLd={jsonLd}
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 border-b border-slate-200/60 bg-gradient-to-b from-blue-50/40 via-white to-slate-50/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-xs font-semibold text-blue-700 shadow-xs mb-6">
            <ShieldCheck className="h-4 w-4" />
            <span>Privacy-First Architecture • Zero File Persistence</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-[#0F172A] sm:text-5xl md:text-6xl max-w-4xl mx-auto leading-tight">
            Free Online Tools. <br />
            <span className="text-blue-600">Fast, Secure, Private.</span>
          </h1>

          <p className="mt-5 max-w-2xl mx-auto text-base sm:text-lg text-slate-600 leading-relaxed">
            Create QR codes, compress PDFs, and remove image backgrounds with simple tools built for speed and strict privacy.
            No accounts required, no hidden tracking, and no watermarks.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/qr-code-generator')}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-medium text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition"
            >
              <span>Explore Free Tools</span>
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/about')}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-base font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              How RankNova Protects Privacy
            </button>
          </div>

          {/* Quick trust badges */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto text-left">
            <div className="flex items-center gap-2.5 rounded-xl bg-white/80 p-3 border border-slate-100 shadow-xs">
              <Cpu className="h-5 w-5 text-blue-600 shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-slate-900">On-Device Logic</p>
                <p className="text-slate-500">Fast browser processing</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-white/80 p-3 border border-slate-100 shadow-xs">
              <EyeOff className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-slate-900">Zero Storage</p>
                <p className="text-slate-500">No uploads retained</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-white/80 p-3 border border-slate-100 shadow-xs">
              <Zap className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-slate-900">100% Free</p>
                <p className="text-slate-500">No paywalls or limits</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-white/80 p-3 border border-slate-100 shadow-xs">
              <Lock className="h-5 w-5 text-indigo-600 shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-slate-900">No Signup</p>
                <p className="text-slate-500">Immediate access</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Tools Section - EXACTLY THREE TOOLS */}
      <section className="py-16 md:py-20 bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
              Essential Production Tools
            </h2>
            <p className="mt-2 text-slate-600 text-sm sm:text-base">
              Each utility is engineered for single-purpose excellence, honest output metrics, and total client privacy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Tool 1: QR Code Generator */}
            <div className="flex flex-col justify-between rounded-2xl bg-white border border-slate-200/90 p-6 shadow-xs hover:shadow-md hover:border-blue-300 transition duration-200">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-4">
                  <QrCode className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">QR Code Generator</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Generate clean QR codes for URLs, text, Wi-Fi, and vCards. Customize colors and margin, then export SVG or high-res PNG.
                </p>
                <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Pure client-side encoding</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Crisp vector SVG & PNG export</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/qr-code-generator')}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-blue-700 transition"
                >
                  <span>Launch QR Tool</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 2: PDF Compressor */}
            <div className="flex flex-col justify-between rounded-2xl bg-white border border-slate-200/90 p-6 shadow-xs hover:shadow-md hover:border-blue-300 transition duration-200">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">PDF Compressor</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Reduce PDF document size using object stream compaction and duplicate font pruning. Reports honest before/after metrics.
                </p>
                <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>On-device processing first</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Honest reduction percentages</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/compress-pdf')}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-blue-700 transition"
                >
                  <span>Launch Compressor</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 3: Image to PDF Converter */}
            <div className="flex flex-col justify-between rounded-2xl bg-white border border-slate-200/90 p-6 shadow-xs hover:shadow-md hover:border-blue-300 transition duration-200">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-4">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Images to PDF</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Convert JPG, PNG, and WebP images into a single formatted PDF document. Drag to reorder pages with customizable A4/Letter margins.
                </p>
                <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>100% on-device conversion</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Custom page sizes & margins</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/image-to-pdf')}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-blue-700 transition"
                >
                  <span>Convert Images</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 4: PDF Editor & Organizer */}
            <div className="flex flex-col justify-between rounded-2xl bg-white border border-slate-200/90 p-6 shadow-xs hover:shadow-md hover:border-blue-300 transition duration-200">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 mb-4">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">PDF Editor & Organizer</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Open any existing PDF to rotate individual pages, reorder or duplicate slides, remove pages, and stamp custom watermarks or pagination.
                </p>
                <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Visual page cards & rotation</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Watermark & page numbering</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/edit-pdf')}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-blue-700 transition"
                >
                  <span>Launch PDF Editor</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 5: AI Background Remover */}
            <div className="flex flex-col justify-between rounded-2xl bg-white border border-slate-200/90 p-6 shadow-xs hover:shadow-md hover:border-blue-300 transition duration-200">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600 mb-4">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">AI Background Remover</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Isolate foreground subjects from portraits and product shots. Export transparent PNGs or solid-color flattened JPEGs.
                </p>
                <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>32-bit transparent PNG alpha</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Before / after split comparison</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/background-remover')}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-blue-700 transition"
                >
                  <span>Launch Remover</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 6: Visiting Card Maker */}
            <div className="flex flex-col justify-between rounded-2xl bg-white border border-slate-200/90 p-6 shadow-xs hover:shadow-md hover:border-blue-300 transition duration-200">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-4">
                  <CreditCard className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Visiting Card Maker</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Design professional business and visiting cards with front & back layouts, contact vCard QR codes, custom themes, and 300 DPI print-ready PDF export.
                </p>
                <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Front & Back 3.5" × 2" layouts</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Scannable vCard QR & 300 DPI PDF</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/visiting-card-generator')}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-blue-700 transition"
                >
                  <span>Design Visiting Card</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reserved Compliant AdSlot */}
      <div className="mx-auto max-w-5xl px-4">
        <AdSlot slotId="home-mid-banner" format="horizontal" />
      </div>

      {/* Trust & Privacy Section */}
      <section className="py-16 bg-white border-y border-slate-200/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Engineered for Integrity
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                Tools that respect your confidential documents and images
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed text-sm sm:text-base">
                Most web utilities secretly upload your files to remote cloud buckets, sell analytics to data brokers,
                or silently compress documents by degrading text into unreadable pixels. RankNova was built to be fundamentally different.
              </p>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Zero Retention Policy</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      We do not store uploaded PDFs or images in databases. Temporary processing memory is cleared immediately.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">No URL Fetching (SSRF Guard)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      When you generate a QR code for a website, our servers never ping or scrape the URL. The string is encoded strictly on your device.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Honest Metrics</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      If an already-optimized PDF cannot be reduced further, we tell you directly. We never fake numbers or inflate compression statistics.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-8 shadow-xs">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Comparison Checklist</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-slate-200/80">
                  <span className="text-slate-600">On-device client-side QR generation</span>
                  <span className="font-semibold text-emerald-600">✓ RankNova (Yes)</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-200/80">
                  <span className="text-slate-600">Permanent PDF upload retention</span>
                  <span className="font-semibold text-emerald-600">✕ None (Zero retention)</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-200/80">
                  <span className="text-slate-600">Requires registration or credit card</span>
                  <span className="font-semibold text-emerald-600">✕ Never</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-200/80">
                  <span className="text-slate-600">Transparent PNG alpha export</span>
                  <span className="font-semibold text-emerald-600">✓ Full 32-bit RGBA</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-600">Ad placement policy compliance</span>
                  <span className="font-semibold text-emerald-600">✓ Strict separation</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Three Simple Steps to Results
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Every workflow is streamlined for speed without annoying modal gates or forced surveys.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-xl bg-white p-6 border border-slate-200 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-sm mb-4">
                1
              </div>
              <h3 className="font-bold text-slate-900">Select or Drop Your File</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Choose a PDF, image, or enter your QR payload. Files are immediately inspected for valid magic-byte signatures.
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 border border-slate-200 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-sm mb-4">
                2
              </div>
              <h3 className="font-bold text-slate-900">Adjust Output Settings</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Pick your compression level, QR colors and margin, or transparent vs flattened solid background format.
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 border border-slate-200 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-sm mb-4">
                3
              </div>
              <h3 className="font-bold text-slate-900">Download Instantly</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Download high-resolution PNG, vector SVG, or optimized PDF. Your files are never held hostage or watermarked.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Educational Guides Section */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Educational Resources & Guides
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Deepen your knowledge of digital document structures, barcode redundancy, and graphics encoding.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/blog')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              <span>View all guides</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STARTER_BLOG_POSTS.slice(0, 3).map((post) => (
              <article
                key={post.id}
                className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-6 hover:bg-white hover:shadow-md transition duration-200"
              >
                <div>
                  <div className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider mb-2">
                    {post.readTime}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition">
                    <button
                      type="button"
                      onClick={() => navigate(`/blog/${post.slug}`)}
                      className="text-left"
                    >
                      {post.title}
                    </button>
                  </h3>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => navigate(`/blog/${post.slug}`)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    <span>Read Article</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-[#F8FAFC] border-t border-slate-200">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Frequently Asked Questions
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Clear answers regarding privacy, file processing, and tool limitations.
            </p>
          </div>

          <div className="space-y-4">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-white transition shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="flex w-full items-center justify-between px-6 py-4 text-left font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-xl"
                    aria-expanded={isOpen}
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-blue-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
};
