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
      metaDesc: 'RankNova privacy policy: Learn how RankNova handles browser tools, optional cloud processing, contact messages, cookies, and Firebase services.'
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
                Effective Date: October 31, 2026 • Version 1.1
              </p>
            </div>

            {/* Disclaimer box */}
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                <strong>Legal Notice:</strong> These terms describe how the current RankNova website operates.
                They should be reviewed for accuracy and local legal compliance before a commercial launch.
              </p>
            </div>

            {/* Document Content */}
            {docType === 'privacy-policy' && (
              <div className="prose prose-slate max-w-none text-sm text-slate-700 space-y-6">
                <section>
                  <h2 className="text-lg font-bold text-slate-900">1. Who We Are and What This Policy Covers</h2>
                  <p>
                    RankNova provides online QR code, PDF, image-editing and visiting-card tools at this website.
                    This policy explains how our site handles information when you use the tools, submit inquiries
                    or authenticate as an administrator. For privacy inquiries, use our{' '}
                    <button type="button" onClick={() => navigate('/contact')} className="text-blue-600 hover:underline">Contact Us page</button>.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-bold text-slate-900">2. Tool Files and Uploaded Content</h2>
                  <p>
                    QR payloads are generated locally in your browser. PDF and image utilities offer browser-based
                    processing, but some features may send file content to a server or third-party processing
                    provider when you explicitly select an online or AI-assisted feature. Please do not use
                    sensitive documents with these features unless you are comfortable with that processing.
                  </p>
                  <p>
                    Our current application code does not intentionally save processed files to a permanent
                    public file library. Temporary memory, network transmission and service-provider logs
                    may still exist. We cannot guarantee that every third-party service retains no data.
                    On-device processing is the more private option where available.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-bold text-slate-900">3. Contact Messages and Account Information</h2>
                  <p>
                    When you send a support request we collect the name, email address, category and message you provide,
                    together with a submission timestamp. The contact form attempts to store these records in Google
                    Firebase Firestore for us to respond and manage inquiries. It displays a success confirmation only
                    after storage succeeds. We retain support messages as needed for handling inquiries and related
                    obligations; you may ask us to review or delete a submission using the contact page.
                  </p>
                  <p>
                    Administrator sign-in uses Firebase Authentication and Google sign-in. Account information,
                    such as an authorized admin's email address and user ID, may be processed by these services.
                    Google's and Firebase's infrastructure may process ordinary operational logs and security data.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-bold text-slate-900">4. Cookies, Local Storage and Ads</h2>
                  <p>
                    We store your cookie preference selection in browser local storage. Your browser and service
                    providers may also use storage needed for authentication, security and site operation. Choosing
                    an analytics preference does not, by itself, mean an analytics service is enabled.
                  </p>
                  <p>
                    Advertising is not activated by default in the current site. If Google AdSense or other advertising
                    partners are enabled later, third-party vendors including Google may use cookies to serve ads
                    based on prior visits to this and other websites, subject to applicable consent requirements.
                    You can manage Google's advertising personalization at{' '}
                    <a href="https://myadcenter.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">My Ad Center</a>
                    {' '}and find additional advertising opt-out options at{' '}
                    <a href="https://www.aboutads.info/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">aboutads.info</a>.
                    We will update this notice and implement appropriate consent controls before enabling applicable ads.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-bold text-slate-900">5. External Services and Data Security</h2>
                  <p>
                    We use GitHub Pages to host the public website and Google Firebase for application features.
                    Optional neural image processing may download model assets from external content delivery networks;
                    selected cloud AI features may contact their configured providers. Third parties apply their
                    own privacy and retention practices. We use reasonable technical precautions, but no online
                    system can guarantee absolute security.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-bold text-slate-900">6. Your Choices and Requests</h2>
                  <p>
                    Depending on your location, you may have rights to request access, correction or deletion
                    of personal information. Contact us with enough detail to identify your request without
                    including passwords or unnecessary sensitive documents. We may need to verify a request
                    and may retain limited information where required by law.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-bold text-slate-900">7. Policy Updates</h2>
                  <p>
                    We may update this policy when tools, service providers or legal obligations change.
                    The effective date shown above identifies the most recent published version.
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
                    RankNova respects creators' intellectual property. We review copyright complaints about content hosted on this website.
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
