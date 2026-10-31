import React, { useState } from 'react';
import { BookOpen, Clock, ArrowRight, User, Search } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { AdSlot } from '../components/AdSlot';
import { STARTER_BLOG_POSTS, type BlogPostItem } from '../data/initialContent';

interface BlogViewProps {
  navigate: (path: string) => void;
}

export const BlogView: React.FC<BlogViewProps> = ({ navigate }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPosts = STARTER_BLOG_POSTS.filter(
    (post) =>
      post.published &&
      (post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      <SEOHead
        title="RankNova Tech Guides & Educational Blog"
        description="Read in-depth guides on QR code generation, PDF optimization, alpha channel raster graphics, and client-side privacy architecture."
        canonicalPath="/blog"
      />

      <div className="py-12 bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80 mb-3">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Original Engineering Articles</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              RankNova Guides & Resources
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Technical articles exploring digital document optimization, barcode standards, image encoding, and privacy engineering.
            </p>

            {/* Search input */}
            <div className="mt-6 max-w-md mx-auto relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles by topic..."
                className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
              />
            </div>
          </div>

          {/* Posts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {filteredPosts.map((post) => (
              <article
                key={post.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-7 shadow-xs hover:shadow-md hover:border-blue-300 transition duration-200"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                    <span className="font-semibold text-blue-600 uppercase tracking-wider text-[11px]">
                      Article
                    </span>
                    <span className="flex items-center gap-1 text-[11px]">
                      <Clock className="h-3 w-3" />
                      {post.readTime}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900 hover:text-blue-600 transition">
                    <button
                      type="button"
                      onClick={() => navigate(`/blog/${post.slug}`)}
                      className="text-left"
                    >
                      {post.title}
                    </button>
                  </h2>

                  <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>{post.author}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/blog/${post.slug}`)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    <span>Read Article</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>

          {filteredPosts.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">
              No articles found matching &quot;{searchQuery}&quot;.
            </div>
          )}

          {/* Reserved Ad */}
          <div className="mt-16">
            <AdSlot slotId="blog-archive-bottom" format="horizontal" />
          </div>
        </div>
      </div>
    </>
  );
};
