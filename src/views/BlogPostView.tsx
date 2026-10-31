import React from 'react';
import { ArrowLeft, Clock, User, Calendar, ShieldCheck } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { AdSlot } from '../components/AdSlot';
import { STARTER_BLOG_POSTS } from '../data/initialContent';

interface BlogPostViewProps {
  slug: string;
  navigate: (path: string) => void;
}

export const BlogPostView: React.FC<BlogPostViewProps> = ({ slug, navigate }) => {
  const post = STARTER_BLOG_POSTS.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="py-20 text-center max-w-xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-slate-900">Article Not Found</h1>
        <p className="mt-2 text-sm text-slate-600">The requested article could not be located.</p>
        <button
          type="button"
          onClick={() => navigate('/blog')}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Articles</span>
        </button>
      </div>
    );
  }

  // Simple Markdown renderer helper for headings, bold, tables, and lists
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableRows: string[][] = [];

    const flushTable = (key: number) => {
      if (tableRows.length === 0) return null;
      const headers = tableRows[0];
      const rows = tableRows.slice(2); // Skip separator row
      tableRows = [];
      inTable = false;
      return (
        <div key={`table-${key}`} className="my-6 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-900 font-semibold border-b border-slate-200">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="px-4 py-3">{h.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-slate-50/50">
                  {row.map((col, ci) => (
                    <td key={ci} className="px-4 py-2.5 text-slate-700">{col.trim()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Table line
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        inTable = true;
        const cols = trimmed.slice(1, -1).split('|');
        tableRows.push(cols);
        return;
      } else if (inTable) {
        const tableElement = flushTable(idx);
        if (tableElement) elements.push(tableElement);
      }

      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={idx} className="text-lg font-bold text-slate-900 mt-6 mb-2">
            {trimmed.replace('### ', '')}
          </h3>
        );
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={idx} className="text-xl sm:text-2xl font-bold text-slate-900 mt-8 mb-3">
            {trimmed.replace('## ', '')}
          </h2>
        );
      } else if (trimmed.startsWith('- ')) {
        elements.push(
          <li key={idx} className="ml-5 list-disc text-sm text-slate-700 leading-relaxed mb-1">
            {trimmed.replace('- ', '')}
          </li>
        );
      } else if (/^\d+\.\s/.test(trimmed)) {
        elements.push(
          <li key={idx} className="ml-5 list-decimal text-sm text-slate-700 leading-relaxed mb-1">
            {trimmed.replace(/^\d+\.\s/, '')}
          </li>
        );
      } else if (trimmed === '') {
        // blank line
      } else {
        elements.push(
          <p key={idx} className="text-sm sm:text-base text-slate-700 leading-relaxed mb-4">
            {trimmed}
          </p>
        );
      }
    });

    if (inTable) {
      const tableElement = flushTable(9999);
      if (tableElement) elements.push(tableElement);
    }

    return elements;
  };

  const formattedDate = new Date(post.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <>
      <SEOHead
        title={post.metaTitle}
        description={post.metaDescription}
        canonicalPath={`/blog/${post.slug}`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.excerpt,
          author: { '@type': 'Organization', name: post.author },
          datePublished: post.createdAt,
          dateModified: post.updatedAt
        }}
      />

      <article className="py-12 bg-white min-h-[70vh]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Back link */}
          <button
            type="button"
            onClick={() => navigate('/blog')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to All Guides</span>
          </button>

          {/* Article Header */}
          <header className="border-b border-slate-200 pb-8 mb-8">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mb-3">
              <span className="font-semibold text-blue-600 uppercase tracking-wider text-[11px]">
                Engineering Guide
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formattedDate}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {post.readTime}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              {post.title}
            </h1>

            <div className="mt-4 flex items-center gap-2 text-xs text-slate-600">
              <User className="h-4 w-4 text-slate-400" />
              <span>Written by <strong className="text-slate-900 font-semibold">{post.author}</strong></span>
            </div>
          </header>

          {/* Reserved Compliant Ad Slot between title and content */}
          <AdSlot slotId="article-top-banner" format="horizontal" />

          {/* Article Body */}
          <div className="prose prose-slate max-w-none">
            {renderFormattedContent(post.content)}
          </div>

          {/* Trust callout footer */}
          <div className="mt-12 rounded-2xl bg-blue-50/70 border border-blue-200 p-6 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-blue-900">RankNova Educational Standards</h4>
              <p className="mt-1 text-xs text-blue-800 leading-relaxed">
                RankNova guides are written by engineers with verifiable technical accuracy.
                We do not use mass-generated SEO content or invent unverifiable statistics.
              </p>
            </div>
          </div>
        </div>
      </article>
    </>
  );
};
