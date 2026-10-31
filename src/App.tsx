/**
 * RankNova Application Root
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
import { HomeView } from './views/HomeView';
import { QRGeneratorView } from './views/QRGeneratorView';
import { PDFCompressorView } from './views/PDFCompressorView';
import { ImageToPdfView } from './views/ImageToPdfView';
import { BackgroundRemoverView } from './views/BackgroundRemoverView';
import { BlogView } from './views/BlogView';
import { BlogPostView } from './views/BlogPostView';
import { AboutView } from './views/AboutView';
import { ContactView } from './views/ContactView';
import { LegalView, type LegalDocType } from './views/LegalView';
import { PDFEditorView } from './views/PDFEditorView';
import { VisitingCardView } from './views/VisitingCardView';
import { AdminView } from './views/AdminView';
import { NotFoundView } from './views/NotFoundView';
import { testConnection } from './services/firebase';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  // Handle browser back/forward buttons
  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);

    // Mandated by Firebase Skill: Validate connection on boot
    testConnection().catch(() => {
      // Handled silently
    });

    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
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
        {renderCurrentRoute()}
      </main>
      <Footer navigate={navigate} />
      <CookieBanner />
    </div>
  );
}
