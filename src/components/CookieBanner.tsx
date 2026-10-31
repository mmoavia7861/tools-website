import React, { useState, useEffect } from 'react';
import { ShieldCheck, X } from 'lucide-react';

export const CookieBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('ranknova_privacy_consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem(
      'ranknova_privacy_consent',
      JSON.stringify({ essential: true, analytics: true, timestamp: new Date().toISOString() })
    );
    setIsVisible(false);
  };

  const handleEssentialOnly = () => {
    localStorage.setItem(
      'ranknova_privacy_consent',
      JSON.stringify({ essential: true, analytics: false, timestamp: new Date().toISOString() })
    );
    setIsVisible(false);
  };

  const handleSaveCustom = () => {
    localStorage.setItem(
      'ranknova_privacy_consent',
      JSON.stringify({ essential: true, analytics: analyticsConsent, timestamp: new Date().toISOString() })
    );
    setIsVisible(false);
    setShowPreferences(false);
  };

  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Privacy and Cookie Consent"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 rounded-2xl bg-white border border-slate-200 shadow-xl p-5 text-slate-800 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-600">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900">Your Privacy is Protected</h3>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            RankNova uses browser processing where supported. Optional cloud features may send files to processing services.
            We use strictly essential storage to deliver tool functionality.
          </p>

          {showPreferences && (
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">
              <label className="flex items-center justify-between text-slate-700">
                <span className="font-medium">Essential Storage (Required)</span>
                <input type="checkbox" checked disabled className="rounded text-blue-600 focus:ring-blue-500" />
              </label>
              <label className="flex items-center justify-between text-slate-700 cursor-pointer">
                <span>Anonymous Performance Analytics</span>
                <input
                  type="checkbox"
                  checked={analyticsConsent}
                  onChange={(e) => setAnalyticsConsent(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </label>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!showPreferences ? (
              <>
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition"
                >
                  Accept All
                </button>
                <button
                  type="button"
                  onClick={handleEssentialOnly}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition"
                >
                  Essential Only
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreferences(true)}
                  className="text-xs text-blue-600 hover:underline px-1 py-1"
                >
                  Customize
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSaveCustom}
                  className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition"
                >
                  Save Choices
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreferences(false)}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition"
                >
                  Back
                </button>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleEssentialOnly}
          aria-label="Close privacy notice"
          className="text-slate-400 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
