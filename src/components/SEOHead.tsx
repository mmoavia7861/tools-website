import React, { useEffect } from 'react';

export interface SEOProps {
  title: string;
  description: string;
  canonicalPath?: string;
  jsonLd?: Record<string, any>;
}

export const SEOHead: React.FC<SEOProps> = ({
  title,
  description,
  canonicalPath = '',
  jsonLd
}) => {
  useEffect(() => {
    document.title = title;

    // Update meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);

    // Update OpenGraph tags
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);

    // Canonical link
    const origin = window.location.origin;
    const basePrefix = import.meta.env.BASE_URL.replace(/\/$/, '');
    const routePath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
    const normalizedPath = routePath === '/' ? '/' : `${routePath.replace(/\/$/, '')}/`;
    const fullCanonical = `${origin}${basePrefix}${normalizedPath}`;
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', fullCanonical);

    // JSON-LD structured data
    let scriptTag = document.getElementById('ranknova-jsonld') as HTMLScriptElement | null;
    if (jsonLd) {
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.id = 'ranknova-jsonld';
        scriptTag.type = 'application/ld+json';
        document.head.appendChild(scriptTag);
      }
      scriptTag.textContent = JSON.stringify(jsonLd);
    } else if (scriptTag) {
      scriptTag.remove();
    }
  }, [title, description, canonicalPath, jsonLd]);

  return null;
};
