/**
 * ToolsCresta Application Root
 * Free Online Tools — Fast, Secure, Private
 * Exactly Three Public Launch Tools:
 * 1. QR Code Generator
 * 2. PDF Compressor
 * 3. AI Background Remover
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CookieBanner } from './components/CookieBanner';
import { PointerEffects } from './components/PointerEffects';
import { ToolAssistant } from './components/ToolAssistant';
import { HomeView } from './views/HomeView';
const QRGeneratorView = React.lazy(() => import('./views/QRGeneratorView').then(module => ({ default: module.QRGeneratorView })));
const PDFCompressorView = React.lazy(() => import('./views/PDFCompressorView').then(module => ({ default: module.PDFCompressorView })));
const ImageToPdfView = React.lazy(() => import('./views/ImageToPdfView').then(module => ({ default: module.ImageToPdfView })));
const BackgroundRemoverView = React.lazy(() => import('./views/BackgroundRemoverView').then(module => ({ default: module.BackgroundRemoverView })));
const BlogView = React.lazy(() => import('./views/BlogView').then(module => ({ default: module.BlogView })));
const BlogPostView = React.lazy(() => import('./views/BlogPostView').then(module => ({ default: module.BlogPostView })));
const AboutView = React.lazy(() => import('./views/AboutView').then(module => ({ default: module.AboutView })));
const ContactView = React.lazy(() => import('./views/ContactView').then(module => ({ default: module.ContactView })));
const LegalView = React.lazy(() => import('./views/LegalView').then(module => ({ default: module.LegalView })));
const PDFEditorView = React.lazy(() => import('./views/PDFEditorView').then(module => ({ default: module.PDFEditorView })));
const VisitingCardView = React.lazy(() => import('./views/VisitingCardView').then(module => ({ default: module.VisitingCardView })));
const AICardGeneratorView = React.lazy(() => import('./views/AICardGeneratorView').then(module => ({ default: module.AICardGeneratorView })));
const DocumentConverterView = React.lazy(() => import('./views/DocumentConverterView').then(module => ({ default: module.DocumentConverterView })));
const VideoCompressorView = React.lazy(() => import('./views/VideoCompressorView').then(module => ({ default: module.VideoCompressorView })));
const AdminView = React.lazy(() => import('./views/AdminView').then(module => ({ default: module.AdminView })));
import { NotFoundView } from './views/NotFoundView';

// Vite BASE_URL is /tools-website/ on GitHub Pages and / on standalone hosting.
const basePrefix = import.meta.env.BASE_URL.replace(/\/$/, '');
const browserPath = () => {
  const pathname = window.location.pathname;
  if (basePrefix && (pathname === basePrefix || pathname.startsWith(basePrefix + '/'))) {
    return pathname.slice(basePrefix.length) || '/';
  }
  return pathname || '/';
};

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(browserPath);

  // Handle browser back/forward buttons
  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(browserPath());
    };
    window.addEventListener('popstate', onPopState);

    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path: string) => {
    const target = path === '/' ? `${basePrefix}/` : `${basePrefix}${path.replace(/\/$/, '')}/`;
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target);
      setCurrentPath(path);
      window.scrollTo(0, 0);
    }
  };

  // Route matching
  const renderCurrentRoute = () => {
    // Normalization
    const path = currentPath.replace(/\/+$/, '') || '/';

    if (path === '/') {
      return <HomeView navigate={navigate} />;
    }

    if (path === '/qr-code-generator') {
      return <QRGeneratorView />;
    }

    if (path === '/compress-pdf') {
      return <PDFCompressorView />;
    }

    if (path === '/image-to-pdf') {
      return <ImageToPdfView />;
    }

    if (path === '/edit-pdf') {
      return <PDFEditorView />;
    }

    if (path === '/background-remover') {
      return <BackgroundRemoverView />;
    }

    if (path === '/visiting-card-generator' || path === '/visiting-card') {
      return <VisitingCardView />;
    }

    if (path === '/ai-card-generator') return <AICardGeneratorView />;
    if (path === '/wedding-card-maker') return <AICardGeneratorView initialKind="wedding" />;
    if (path === '/birthday-card-maker') return <AICardGeneratorView initialKind="birthday" />;

    if (path === '/pdf-to-word') return <DocumentConverterView mode="pdf-to-word" />;
    if (path === '/word-to-pdf') return <DocumentConverterView mode="word-to-pdf" />;

    if (path === '/compress-video' || path === '/video-compressor') {
      return <VideoCompressorView />;
    }

    if (path === '/blog') {
      return <BlogView navigate={navigate} />;
    }

    if (path.startsWith('/blog/')) {
      const slug = path.replace('/blog/', '');
      return <BlogPostView slug={slug} navigate={navigate} />;
    }

    if (path === '/about') {
      return <AboutView navigate={navigate} />;
    }

    if (path === '/contact') {
      return <ContactView />;
    }

    if (path === '/privacy-policy') {
      return <LegalView docType="privacy-policy" navigate={navigate} />;
    }

    if (path === '/terms') {
      return <LegalView docType="terms" navigate={navigate} />;
    }

    if (path === '/acceptable-use') {
      return <LegalView docType="acceptable-use" navigate={navigate} />;
    }

    if (path === '/copyright-dmca') {
      return <LegalView docType="copyright-dmca" navigate={navigate} />;
    }

    if (path === '/admin') {
      return <AdminView />;
    }

    return <NotFoundView navigate={navigate} />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] font-sans">
      <Navbar currentPath={currentPath} navigate={navigate} />
      <main className="flex-1">
        <React.Suspense fallback={<div role="status" aria-live="polite" className="mx-auto max-w-7xl px-6 py-16 text-center text-slate-600">Loading tool…</div>}>
          {renderCurrentRoute()}
        </React.Suspense>
      </main>
      <Footer navigate={navigate} />
      <CookieBanner />
      <PointerEffects />
      <ToolAssistant navigate={navigate} />
    </div>
  );
}
