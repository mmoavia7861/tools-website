import React, { useState } from 'react';
import { Menu, X, QrCode, FileText, Sparkles, CreditCard, Lock, ArrowRight } from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  navigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, navigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'QR Generator', path: '/qr-code-generator', icon: QrCode },
    { label: 'PDF Tools', path: '/compress-pdf', icon: FileText },
    { label: 'PDF Editor', path: '/edit-pdf', icon: FileText },
    { label: 'BG Remover', path: '/background-remover', icon: Sparkles },
    { label: 'Visiting Card', path: '/visiting-card-generator', icon: CreditCard },
    { label: 'Blog', path: '/blog' },
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
  ];

  const handleNav = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Brand Logo */}
        <button
          type="button"
          onClick={() => handleNav('/')}
          className="group flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg p-1"
          aria-label="RankNova Home"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20 group-hover:bg-blue-700 transition">
            <svg
              className="h-5 w-5 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* 4-point Nova Spark icon with tool transformation motif */}
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-[#0F172A] font-sans">
            Rank<span className="text-blue-600">Nova</span>
          </span>
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
          {navItems.map((item) => {
            const isActive = currentPath === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item.path)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'text-blue-600 bg-blue-50/80 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Action Controls & Admin */}
        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleNav('/admin')}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              currentPath === '/admin'
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
            title="Owner Admin Dashboard"
          >
            <Lock className="h-3.5 w-3.5 text-slate-500" />
            <span>Admin</span>
          </button>

          <button
            type="button"
            onClick={() => handleNav('/qr-code-generator')}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition"
          >
            <span>Free Tools</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-6 space-y-1 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-3 py-1">
            Free Utilities
          </div>
          {navItems.map((item) => {
            const isActive = currentPath === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium ${
                  isActive
                    ? 'text-blue-600 bg-blue-50 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {Icon && <Icon className="h-4 w-4 text-blue-600" />}
                <span>{item.label}</span>
              </button>
            );
          })}
          <div className="pt-3 border-t border-slate-100 mt-2">
            <button
              type="button"
              onClick={() => handleNav('/admin')}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-400" />
                <span>Admin Portal</span>
              </span>
              <span className="text-xs text-slate-400">Owner access</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
