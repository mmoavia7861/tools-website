import React, { useEffect } from 'react';

export interface SEOProps {
  title: string;
  description: string;
  canonicalPath?: string;
  jsonLd?: Record<string, unknown>;
}

const PRIMARY_ORIGIN = 'https://toolscresta.com';

function upsertMeta(attribute: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export const SEOHead: React.FC<SEOProps> = ({
  title, description, canonicalPath = '', jsonLd
}) => {
  useEffect(() => {
    document.title = title;
    const routePath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
    const normalized = routePath === '/' ? '/' : `${routePath.replace(/\/+$/, '')}/`;
    // Always prefer the user-owned production domain over GitHub Pages or workers.dev mirrors.
    const canonicalUrl = PRIMARY_ORIGIN + normalized;
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:site_name', 'ToolsCresta');
    upsertMeta('property', 'og:type', normalized.startsWith('/blog/') ? 'article' : 'website');
    upsertMeta('name', 'twitter:card', 'summary');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);

    // React renders plain text content; never inject user-supplied HTML as structured data.
    let scriptTag = document.getElementById('toolscresta-jsonld') as HTMLScriptElement | null;
    if (jsonLd) {
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.id = 'toolscresta-jsonld';
        scriptTag.type = 'application/ld+json';
        document.head.appendChild(scriptTag);
      }
      scriptTag.textContent = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
    } else if (scriptTag) {
      scriptTag.remove();
    }
  }, [title, description, canonicalPath, jsonLd]);

  return null;
};
