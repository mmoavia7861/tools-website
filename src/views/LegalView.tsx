import React from 'react';
import { ShieldCheck, FileCheck, AlertTriangle, Scale } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';

export type LegalDocType = 'privacy-policy' | 'terms' | 'acceptable-use' | 'copyright-dmca';

interface LegalViewProps {
  docType: LegalDocType;
  navigate: (path: string) => void;
}

export const LegalView: React.FC<LegalViewProps> = ({ docType, navigate }) => {
  const titles: Record<LegalDocType, { title: string; metaTitle: string; metaDesc: string }> = {
    'privacy-policy': {
      title: 'Privacy Policy',
      metaTitle: 'Privacy Policy | RankNova',
      metaDesc: 'RankNova privacy policy: Learn about our client-side processing, zero file retention, and data minimization practices.'
    },
    terms: {
      title: 'Terms of Service',
      metaTitle: 'Terms of Service | RankNova',
      metaDesc: 'RankNova terms of service governing usage of our online utility applications and website.'
    },
    'acceptable-use': {
      title: 'Acceptable Use Policy',
      metaTitle: 'Acceptable Use Policy | RankNova',
      metaDesc: 'Guidelines and restrictions regarding prohibited content, abuse, and system integrity on RankNova.'
    },
    'copyright-dmca': {
      title: 'Copyright & DMCA Notice',
      metaTitle: 'Copyright & DMCA Takedown Procedure | RankNova',
      metaDesc: 'RankNova copyright policies and instructions for submitting digital millennium copyright act takedown notices.'
    }
  };

  const current = titles[docType];

  return (
    <>
      <SEOHead
        title={current.metaTitle}
        description={current.metaDesc}
        canonicalPath={`/${docType}`}
      />

      <div className="py-12 bg-[#F8FAFC]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 mb-8 border-b border-slate-200 pb-4">
            <button
              type="button"
              onClick={() => navigate('/privacy-policy')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                docType === 'privacy-policy' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => navigate('/terms')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                docType === 'terms' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Terms of Service
            </button>
            <button
              type="button"
              onClick={() => navigate('/acceptable-use')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                docType === 'acceptable-use' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Acceptable Use
            </button>
            <button
              type="button"
              onClick={() => navigate('/copyright-dmca')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                docType === 'copyright-dmca' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Copyright & DMCA
            </button>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs p-8 sm:p-12 space-y-8">
            {/* Header */}
            <div className="border-b border-slate-200 pb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Official Document
              </span>
              <h1 className="mt-1 text-3xl font-extrabold text-slate-900">
                {current.title}
              </h1>
              <p className="mt-2 text-xs text-slate-500">
                Effective Date: October 30, 2026 • Version 1.0
              </p>
            </div>

            {/* Disclaimer box */}
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                <strong>Legal Notice:</strong> These templates are drafted for transparency and technical honesty.
                They do not constitute formal legal advice and should be reviewed by qualified legal counsel in accordance with your local jurisdiction.
              </p>
            </div>

            {/* Document Content */}
            {docType === 'privacy-policy' && (
              <div className="prose prose-slate max-w-none text-sm text-slate-700 space-y-6">
                <section>
                  <h2 className="text-lg font-bold text-slate-900">1. Core Privacy Principle: Zero Retention</h2>
                  <p>
                    RankNova operates under the principles of <strong>data minimization, purpose limitation, and privacy by design</strong>.
                    Our tools are designed to process files locally inside your browser whenever technically feasible.
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>QR Code Generator:</strong> Encodes payloads completely on your device. We do not fetch or crawl user URLs.</li>
                    <li><strong>PDF Compressor:</strong> Optimizes document streams in-browser first. If server-side processing is explicitly chosen, the file is held in transient memory and deleted immediately after delivery.</li>
                    <li><strong>AI Background Remover:</strong> Images are processed in isolated transient memory. No user images are ever stored in permanent databases.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-bold text-slate-900">2. Information We Do Not Collect</h2>
                  <p>
                    RankNova does not collect your national ID, credit card details, physical address, age, or date of birth.
                    We do not sell, rent, or trade user data to third-party data brokers.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-bold text-slate-900">3. Cookies and Analytics</h2>
                  <p>
                    We use strictly essential cookies for site security and CSRF mitigation. Optional anonymous performance analytics
                    are disabled by default until you grant consent via our Cookie Preferences banner.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-bold text-slate-900">4. Your Privacy Rights (GDPR & CCPA)</h2>
                  <p>
                    Depending on your location, you have rights to access, delete, or limit the use of any personal data.
                    Because we do not store accounts or uploaded files, we retain virtually zero personal identifiers.
                    To submit a formal privacy inquiry, please visit our <button type="button" onClick={() => navigate('/contact')} className="text-blue-600 hover:underline">Contact Form</button>.
                  </p>
                </section>
              </div>
            )}

            {docType === 'terms' && (
              <div className="prose prose-slate max-w-none text-sm text-slate-700 space-y-6">
                <section>
                  <h2 className="text-lg font-bold text-slate-900">1. Acceptance of Terms</h2>
                  <p>
                    By accessing or using RankNova, you agree to be bound by these Terms of Service.
                    If you do not agree to these terms, you must discontinue using our services immediately.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-bold text-slate-900">2. Free Service and No Warranty</h2>
                  <p>
                    RankNova utilities are provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind,
                    express or implied. While we strive for maximum accuracy, we do not guarantee uninterrupted uptime or specific compression ratios.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-bold text-slate-900">3. User Responsibility</h2>
                  <p>
                    You retain full ownership and responsibility for the files and payloads you process through RankNova.
                    You warrant that you hold all necessary copyrights and rights to process your uploaded documents and images.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-bold text-slate-900">4. Limitation of Liability</h2>
                  <p>
                    To the maximum extent permitted by applicable law, RankNova and its operators shall not be liable for any indirect,
                    incidental, consequential, or punitive damages arising from the use of or inability to use our tools.
                  </p>
                </section>
              </div>
            )}

            {docType === 'acceptable-use' && (
              <div className="prose prose-slate max-w-none text-sm text-slate-700 space-y-6">
                <section>
                  <h2 className="text-lg font-bold text-slate-900">1. Prohibited Activities</h2>
                  <p>When using RankNova, you must not:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Upload malicious files, malware, trojans, or decompression bombs.</li>
                    <li>Generate QR codes pointing to known phishing domains, fraud sites, or illegal resources.</li>
                    <li>Process sexually explicit content involving minors, non-consensual imagery, or violent extremist materials.</li>
                    <li>Attempt to probe, scan, or exploit security vulnerabilities or bypass rate limits.</li>
                    <li>Deploy automated scrapers, denial-of-service floods, or unauthorized API harvesters.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-bold text-slate-900">2. Abuse Enforcement</h2>
                  <p>
                    Violations of this Acceptable Use Policy may result in immediate IP throttling, permanent firewall blacklisting,
                    and referral to law enforcement authorities where criminal activity is detected.
                  </p>
                </section>
              </div>
            )}

            {docType === 'copyright-dmca' && (
              <div className="prose prose-slate max-w-none text-sm text-slate-700 space-y-6">
                <section>
                  <h2 className="text-lg font-bold text-slate-900">1. Notice and Takedown Policy</h2>
                  <p>
                    RankNova respects the intellectual property rights of creators and adheres to the Digital Millennium Copyright Act (17 U.S.C. § 512).
                    Because RankNova does not host public user galleries or retain uploaded files, user-processed assets do not remain on our servers.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-bold text-slate-900">2. Submitting a DMCA Notice</h2>
                  <p>
                    If you believe any static educational guide or article on RankNova infringes your copyright, please submit a written notice containing:
                  </p>
                  <ol className="list-decimal pl-5 mt-2 space-y-1">
                    <li>Identification of the copyrighted work claimed to have been infringed.</li>
                    <li>Identification of the material claimed to be infringing, including URL path.</li>
                    <li>Your full legal name, physical address, telephone number, and email.</li>
                    <li>A statement that you have a good-faith belief that use of the material is not authorized.</li>
                    <li>A statement under penalty of perjury that the information in the notification is accurate.</li>
                    <li>Your physical or electronic signature.</li>
                  </ol>
                  <p className="mt-3">
                    Submit notices via our <button type="button" onClick={() => navigate('/contact')} className="text-blue-600 hover:underline">Contact Form</button> selecting &quot;Copyright/DMCA&quot;.
                  </p>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
