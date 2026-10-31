import React from 'react';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';

interface NotFoundViewProps {
  navigate: (path: string) => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({ navigate }) => {
  return (
    <>
      <SEOHead
        title="404 — Page Not Found | RankNova"
        description="The requested page could not be found."
        canonicalPath="/404"
      />

      <div className="py-24 bg-[#F8FAFC] flex flex-col items-center justify-center text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-6 shadow-xs">
          <FileQuestion className="h-8 w-8" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
          Error 404
        </span>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
          Page Not Found
        </h1>
        <p className="mt-3 text-sm text-slate-600 max-w-md">
          The page you are looking for does not exist or has been moved. Explore our core tools below.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Homepage</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/qr-code-generator')}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            QR Generator
          </button>
          <button
            type="button"
            onClick={() => navigate('/compress-pdf')}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            PDF Compressor
          </button>
        </div>
      </div>
    </>
  );
};
