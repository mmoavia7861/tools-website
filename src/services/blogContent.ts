import { useEffect, useState } from 'react';
import { STARTER_BLOG_POSTS, type BlogPostItem } from '../data/initialContent';

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export function readBlogPost(raw: unknown, id: string): BlogPostItem | null {
  if (!raw || typeof raw !== 'object' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return null;
  const data = raw as Record<string, unknown>;
  const slug = text(data.slug, 128);
  const title = text(data.title, 200);
  const excerpt = text(data.excerpt, 500);
  const content = text(data.content, 50000);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !title || !excerpt || !content || typeof data.published !== 'boolean') return null;
  return {
    id, slug, title, excerpt, content, published: data.published,
    metaTitle: text(data.metaTitle, 200) || title + ' | ToolsCresta',
    metaDescription: text(data.metaDescription, 300) || excerpt,
    author: text(data.author, 120) || 'ToolsCresta Team',
    readTime: text(data.readTime, 40) || '5 min read',
    createdAt: text(data.createdAt, 35) || new Date().toISOString(),
    updatedAt: text(data.updatedAt, 35) || new Date().toISOString(),
  };
}

/** Articles remain static until the owner explicitly enables the Firestore CMS.
 * Once managed, only published Firestore articles can appear to visitors.
 */
export function usePublicBlogPosts(): { posts: BlogPostItem[]; managed: boolean; error: boolean; loading: boolean } {
  const [posts, setPosts] = useState<BlogPostItem[]>(STARTER_BLOG_POSTS.filter(p => p.published));
  const [managed, setManaged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};
    void import('./firebase').then(({ db, doc, onSnapshot }) => {
      if (disposed) return;
      unsubscribe = onSnapshot(doc(db, 'site_content', 'blog_state'), snapshot => {
        if (disposed) return;
        const isManaged = snapshot.exists() && snapshot.data()?.managed === true;
        if (isManaged) setFeedLoading(true);
        setManaged(isManaged);
        setLoading(false);
      }, () => { if (!disposed) { setError(true); setLoading(false); } });
    }).catch(() => { if (!disposed) { setError(true); setLoading(false); } });
    return () => { disposed = true; unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!managed) {
      setPosts(STARTER_BLOG_POSTS.filter(p => p.published));
      setFeedLoading(false);
      return;
    }
    let disposed = false;
    let unsubscribe = () => {};
    setFeedLoading(true);
    // Query only published articles so Firestore public rules can safely filter.
    void import('./firebase').then(({ db, collection, onSnapshot, query, where }) => {
      if (disposed) return;
      unsubscribe = onSnapshot(query(collection(db, 'blog_posts'), where('published', '==', true)),
        snapshot => {
          if (disposed) return;
          setPosts(snapshot.docs.map(document => readBlogPost(document.data(), document.id))
            .filter((post): post is BlogPostItem => post !== null)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
          setError(false); setFeedLoading(false);
        },
        () => {
          if (!disposed) { setPosts([]); setError(true); setFeedLoading(false); }
        });
    }).catch(() => {
      if (!disposed) { setPosts([]); setError(true); setFeedLoading(false); }
    });
    return () => { disposed = true; unsubscribe(); };
  }, [managed]);
  return { posts, managed, error, loading: loading || feedLoading };
}
