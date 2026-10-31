import React from 'react';
import { ShieldCheck, Lock, Sparkles } from 'lucide-react';

interface FooterProps {
  navigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ navigate }) => {
  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600 mt-20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                <svg
                  className="h-4 w-4 fill-current"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-[#0F172A]">
                Rank<span className="text-blue-600">Nova</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Fast, secure, and private online utilities. Browser-first tools with optional server processing. See our Privacy Policy for details.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Browser processing where supported</span>
            </div>
          </div>

          {/* Launch Tools - EXACTLY 3 Launch Tools */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Online Utilities
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href={`${import.meta.env.BASE_URL}qr-code-generator/`}
                  onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('/qr-code-generator'); } }}
                  className="text-slate-600 hover:text-blue-600 transition"
                >
                  QR Code Generator
                </a>
              </li>
              <li>
                <a
                  href={`${import.meta.env.BASE_URL}compress-pdf/`}
                  onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('/compress-pdf'); } }}
                  className="text-slate-600 hover:text-blue-600 transition"
                >
                  PDF Compressor
                </a>
              </li>
              <li>
                <a
                  href={`${import.meta.env.BASE_URL}image-to-pdf/`}
                  onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('/image-to-pdf'); } }}
                  className="text-slate-600 hover:text-blue-600 transition"
                >
                  Image to PDF Converter
                </a>
              </li>
              <li>
                <a
                  href={`${import.meta.env.BASE_URL}edit-pdf/`}
                  onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('/edit-pdf'); } }}
                  className="text-slate-600 hover:text-blue-600 transition"
                >
                  PDF Editor & Organizer
                </a>
              </li>
              <li>
                <a
                  href={`${import.meta.env.BASE_URL}background-remover/`}
                  onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('/background-remover'); } }}
                  className="text-slate-600 hover:text-blue-600 transition"
                >
                  AI Background Remover
                </a>
              </li>
              <li>
                <a
                  href={`${import.meta.env.BASE_URL}visiting-card-generator/`}
                  onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('/visiting-card-generator'); } }}
                  className="text-slate-600 hover:text-blue-600 transition"
                >
                  Visiting Card Maker
                </a>
              </li>
            </ul>
          </div>

          {/* Company & Resources */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Resources & Support
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href={`${import.meta.env.BASE_URL}blog/`}
                  onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('/blog'); } }}
                  className="text-slate-600 hover:text-blue-600 transition"
                >
                  Guides & Blog
                </a>
              </li>
              <li>
                <a
                  href={`${import.meta.env.BASE_URL}about/`}
                  onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('/about'); } }}
                  className="text-slate-600 hover:text-blue-600 transition"
                >
                  About RankNova
                </a>
              </li>
              <li>
                <a
                  href={`${import.meta.env.BASE_URL}contact/`}
                  onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('/contact'); } }}
                  className="text-slate-600 hover:text-blue-600 transition"
                >
                  Contact & Support
                </a>
              </li>
              <li>
                <a
                  href={`${import.meta.env.BASE_URL}admin/`}
                  onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('/admin'); } }}
                  className="text-slate-600 hover:text-blue-600 transition flex items-center gap-1"
                >
                  <Lock className="h-3 w-3 text-slate-400" />
                  <span>Admin Portal</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Governance */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Legal & Privacy
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href={`${import.meta.env.BASE_URL}privacy-policy/`}
                  onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('/privacy-policy'); } }}
                  className="text-slate-600 hover:text-blue-600 transition"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href={`${import.meta.env.BASE_URL}terms/`}
                  onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('/terms'); } }}
                  className="text-slate-600 hover:text-blue-600 transition"
                >
                  Terms of Service
                </a>
              </li>
              <li>
                <a
                  href={`${import.meta.env.BASE_URL}acceptable-use/`}
                  onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('/acceptable-use'); } }}
                  className="text-slate-600 hover:text-blue-600 transition"
                >
                  Acceptable Use Policy
                </a>
              </li>
              <li>
                <a
                  href={`${import.meta.env.BASE_URL}copyright-dmca/`}
                  onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('/copyright-dmca'); } }}
                  className="text-slate-600 hover:text-blue-600 transition"
                >
                  Copyright & DMCA
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 border-t border-slate-100 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© {new Date().getFullYear()} RankNova. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              Free tools • Privacy information available
            </span>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('ranknova_privacy_consent');
                window.location.reload();
              }}
              className="text-slate-400 hover:text-slate-600 hover:underline"
            >
              Reset Cookie Preferences
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
