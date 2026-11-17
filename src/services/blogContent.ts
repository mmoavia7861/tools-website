import { useEffect, useState } from 'react';
import { db, collection, doc, onSnapshot, query, where } from './firebase';
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
export function usePublicBlogPosts(): { posts: BlogPostItem[]; managed: boolean; error: boolean } {
  const [posts, setPosts] = useState<BlogPostItem[]>(STARTER_BLOG_POSTS.filter(p => p.published));
  const [managed, setManaged] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => onSnapshot(doc(db, 'site_content', 'blog_state'), snapshot => {
    setManaged(snapshot.exists() && snapshot.data()?.managed === true);
  }, () => setError(true)), []);
  useEffect(() => {
    if (!managed) { setPosts(STARTER_BLOG_POSTS.filter(p => p.published)); return; }
    // Firestore security rules require this filter for public list queries.
    return onSnapshot(query(collection(db, 'blog_posts'), where('published', '==', true)),
      snapshot => {
        setPosts(snapshot.docs.map(doc => readBlogPost(doc.data(), doc.id)).filter((post): post is BlogPostItem => post !== null)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setError(false);
      },
      () => { setPosts([]); setError(true); }
    );
  }, [managed]);
  return { posts, managed, error };
}
