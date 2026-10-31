import React from 'react';
import { ShieldCheck, Cpu, Lock, CheckCircle2, Server, EyeOff } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';

interface AboutViewProps {
  navigate: (path: string) => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ navigate }) => {
  return (
    <>
      <SEOHead
        title="About RankNova — Privacy-First Online Tools Architecture"
        description="Learn about RankNova's mission, on-device browser processing, zero file persistence policy, and engineering principles."
        canonicalPath="/about"
      />

      <div className="py-12 bg-[#F8FAFC]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Our Principles & Architecture
            </span>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              About RankNova
            </h1>
            <p className="mt-3 text-base text-slate-600 leading-relaxed">
              Fast, focused, and respectful online utilities designed for engineers, creators, and professionals who value privacy and honest metrics.
            </p>
          </div>

          {/* Mission Card */}
          <div className="rounded-2xl bg-white border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-6">
            <h2 className="text-xl font-bold text-slate-900">The Problem with Web Utilities</h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              The modern web utility ecosystem is cluttered with deceptive websites. Uploading a confidential contract or family photograph
              often results in files being retained indefinitely in obscure cloud buckets, hidden tracking pixels scraping visitor identities,
              and manipulative download buttons designed to look like banner advertisements.
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              <strong>RankNova was engineered with a contrarian philosophy:</strong>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <Cpu className="h-4 w-4 text-blue-600" />
                  <span>On-Device Execution First</span>
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Calculations, QR barcode generation, and PDF compaction happen inside your browser using WebAssembly and pure JavaScript.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <EyeOff className="h-4 w-4 text-emerald-600" />
                  <span>Zero Permanent File Storage</span>
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  We never persist your uploaded files in databases or public storage buckets. Any temporary memory buffers are cleared immediately.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <ShieldCheck className="h-4 w-4 text-purple-600" />
                  <span>Honest Measurements</span>
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  We never simulate fake compression percentages. If a document cannot be reduced further without ruining readability, we state it clearly.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <Lock className="h-4 w-4 text-indigo-600" />
                  <span>No Artificial Barriers</span>
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  No forced user registrations, no email captchas, and no watermarks on your downloaded deliverables.
                </p>
              </div>
            </div>
          </div>

          {/* Technical Specifications */}
          <div className="rounded-2xl bg-white border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Technical Specifications & Limits</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-900 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Tool</th>
                    <th className="px-4 py-3">Supported Formats</th>
                    <th className="px-4 py-3">Max Limit</th>
                    <th className="px-4 py-3">Security & Storage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">QR Code Generator</td>
                    <td className="px-4 py-3 text-slate-600">URL, Text, Wi-Fi, vCard</td>
                    <td className="px-4 py-3 text-slate-600">2,000+ characters</td>
                    <td className="px-4 py-3 text-emerald-600 font-medium">100% Client-side (No URL fetch)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">PDF Compressor</td>
                    <td className="px-4 py-3 text-slate-600">Standard PDF (.pdf)</td>
                    <td className="px-4 py-3 text-slate-600">25 MB</td>
                    <td className="px-4 py-3 text-emerald-600 font-medium">On-device first; isolated memory</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">AI Background Remover</td>
                    <td className="px-4 py-3 text-slate-600">PNG, JPG, WebP</td>
                    <td className="px-4 py-3 text-slate-600">15 MB (4096px max)</td>
                    <td className="px-4 py-3 text-emerald-600 font-medium">Memory buffer purged in finally block</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Contact CTA */}
          <div className="text-center pt-4">
            <p className="text-sm text-slate-600">
              Have questions, feedback, or a security report?
            </p>
            <button
              type="button"
              onClick={() => navigate('/contact')}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition"
            >
              Get in Touch with the RankNova Team
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
