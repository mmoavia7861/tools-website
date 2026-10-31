import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { db, collection, setDoc, doc } from '../services/firebase';

export const ContactView: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<
    'General question' | 'Tool issue' | 'Privacy request' | 'Copyright/DMCA' | 'Security report'
  >('General question');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState(''); // Anti-bot honeypot

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // If bot filled the honeypot, silently succeed
    if (honeypot.trim() !== '') {
      setSubmitted(true);
      return;
    }

    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const messageData = {
        name: name.trim().slice(0, 120),
        email: email.trim().slice(0, 256),
        category,
        message: message.trim().slice(0, 5000),
        status: 'new',
        createdAt: new Date().toISOString()
      };

      // Show success only after the inquiry is genuinely stored.
      // GitHub Pages has no /api/contact backend, and the old API fallback
      // acknowledged messages without persisting them.
      await setDoc(doc(db, 'contact_messages', messageId), messageData);
      setSubmitted(true);
    } catch (err: unknown) {
      console.warn('Contact message was not saved:', err);
      setErrorMessage('We could not save your message. Please try again shortly; no submission was confirmed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Contact RankNova — Support, Privacy & DMCA Inquiries"
        description="Contact the RankNova engineering team for technical support, privacy data requests, security disclosures, and DMCA inquiries."
        canonicalPath="/contact"
      />

      <div className="py-12 bg-[#F8FAFC]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center max-w-xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80 mb-3">
              <Mail className="h-3.5 w-3.5" />
              <span>Direct Support & Security Reports</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Contact & Inquiries
            </h1>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Have a question about our tools, a bug to report, or a privacy inquiry? Fill out the form below.
            </p>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs p-6 sm:p-10">
            {submitted ? (
              <div className="text-center py-8 space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Message Received</h2>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Thank you for reaching out. Your message was saved for our team to review. We cannot promise a specific response time.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setName('');
                    setEmail('');
                    setMessage('');
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Send Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {errorMessage && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Honeypot field (hidden from screen, bots fill it) */}
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="website-url-extra">Leave this empty</label>
                  <input
                    id="website-url-extra"
                    type="text"
                    tabIndex={-1}
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    autoComplete="off"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-name" className="block text-xs font-semibold text-slate-700 mb-1">
                      Your Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-email" className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-category" className="block text-xs font-semibold text-slate-700 mb-1">
                    Inquiry Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="contact-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="General question">General question</option>
                    <option value="Tool issue">Tool issue or bug report</option>
                    <option value="Privacy request">Privacy or data inquiry (GDPR / CCPA)</option>
                    <option value="Copyright/DMCA">Copyright / DMCA Takedown Notice</option>
                    <option value="Security report">Security vulnerability report</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-xs font-semibold text-slate-700 mb-1">
                    Message Details <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Please describe your question or issue in detail..."
                    className="w-full rounded-xl border border-slate-300 p-3.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Maximum 5,000 characters. Never submit passwords or confidential document contents.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-6 font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {isSubmitting ? (
                    <span>Submitting message...</span>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Submit Inquiry</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
