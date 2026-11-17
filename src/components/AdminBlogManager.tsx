import React, { useEffect, useState } from 'react';
import { Edit3, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { db, collection, deleteDoc, doc, getDoc, getDocs, setDoc } from '../services/firebase';
import { STARTER_BLOG_POSTS, type BlogPostItem } from '../data/initialContent';
import { readBlogPost } from '../services/blogContent';

const blogState = () => doc(db, 'site_content', 'blog_state');
const blankPost = (): BlogPostItem => ({
  id: 'post-' + Date.now(), slug: '', title: '', metaTitle: '', metaDescription: '',
  excerpt: '', content: '', author: 'ToolsCresta Team', published: false,
  readTime: '5 min read', createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

export const AdminBlogManager: React.FC = () => {
  const [managed, setManaged] = useState(false);
  const [posts, setPosts] = useState<BlogPostItem[]>([]);
  const [draft, setDraft] = useState<BlogPostItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const reload = async () => {
    setLoading(true); setError('');
    try {
      const state = await getDoc(blogState());
      const live = state.exists() && state.data()?.managed === true;
      setManaged(live);
      if (!live) setPosts(STARTER_BLOG_POSTS);
      else {
        const snapshots = await getDocs(collection(db, 'blog_posts'));
        setPosts(snapshots.docs.map(s => readBlogPost(s.data(), s.id)).filter((p): p is BlogPostItem => p !== null)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      }
    } catch { setError('Unable to load blog CMS. Check named Firestore database and OTP-only rules.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);

  const activate = async () => {
    if (busy || managed) return;
    if (!window.confirm('Import the 3 built-in posts to Firestore and activate live Blog CMS?')) return;
    setBusy(true); setError('');
    try {
      // All article writes happen before enabling the live feed; visitors are
      // never switched to an empty collection by an incomplete migration.
      for (const post of STARTER_BLOG_POSTS) {
        await setDoc(doc(db, 'blog_posts', post.id), post);
      }
      await setDoc(blogState(), { managed: true, updatedAt: new Date().toISOString() });
      setManaged(true); setNotice('Live Blog CMS activated; existing articles copied to Firebase.');
      await reload();
    } catch { setError('Migration was incomplete. Please retry. Live blog was not switched until all writes succeeded.'); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!managed || !draft || busy) return;
    const candidate: BlogPostItem = {
      ...draft, title: draft.title.trim().slice(0, 200),
      slug: draft.slug.trim().toLowerCase(),
      excerpt: draft.excerpt.trim().slice(0, 500),
      content: draft.content.trim().slice(0, 50000),
      metaTitle: draft.metaTitle.trim().slice(0, 200),
      metaDescription: draft.metaDescription.trim().slice(0, 300),
      updatedAt: new Date().toISOString()
    };
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.slug) ||
        !candidate.title || !candidate.excerpt || !candidate.content) {
      setError('Title, excerpt and body are required; use a slug like how-to-compress-pdf.');
      return;
    }
    if (posts.some(post => post.id !== candidate.id && post.slug === candidate.slug)) {
      setError('This article slug is already in use.'); return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      await setDoc(doc(db, 'blog_posts', candidate.id), candidate);
      setDraft(null); setNotice(candidate.published ? 'Article published in Firebase.' : 'Draft saved in Firebase.');
      await reload();
    } catch { setError('Could not save article. Check Firebase rules and try again.'); }
    finally { setBusy(false); }
  };

  const remove = async (post: BlogPostItem) => {
    if (!managed || busy || !window.confirm('Unpublish/remove ' + post.title + '?')) return;
    setBusy(true); setError('');
    try {
      // Unpublishing retains the edit history for the original starter posts.
      if (STARTER_BLOG_POSTS.some(p => p.id === post.id))
        await setDoc(doc(db, 'blog_posts', post.id), { ...post, published: false, updatedAt: new Date().toISOString() });
      else await deleteDoc(doc(db, 'blog_posts', post.id));
      setDraft(null); setNotice('Article removed from the public blog.');
      await reload();
    } catch { setError('Could not change article.'); }
    finally { setBusy(false); }
  };

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Blog Content Management</h2>
        <p className="mt-1 text-sm text-slate-600">{managed
          ? 'Articles are saved in Firebase. Drafts are hidden from public visitors.'
          : 'Current starter articles are built into the website. Activate live editing once to copy them into Firebase.'}</p>
      </div>
      {managed
        ? <button type="button" onClick={() => setDraft(blankPost())}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" /> New article</button>
        : <button type="button" onClick={() => void activate()} disabled={busy || loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Migrating…' : 'Activate Live Blog CMS'}</button>}
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {loading ? <p className="text-sm text-slate-500">Loading articles…</p> :
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
      {posts.map(post => <div key={post.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <span className={post.published ? 'text-xs font-semibold text-emerald-700' : 'text-xs font-semibold text-amber-700'}>
            {post.published ? 'Published' : 'Draft'}</span>
          <h3 className="text-sm font-bold text-slate-900">{post.title}</h3>
          <p className="text-xs text-slate-500">/blog/{post.slug}</p>
        </div>
        {managed && <div className="flex gap-3">
          <button type="button" onClick={() => { setDraft({ ...post }); setError(''); }}
            className="text-sm font-semibold text-blue-700"><Edit3 className="inline h-4 w-4" /> Edit</button>
          <button type="button" onClick={() => void remove(post)} disabled={busy}
            className="text-sm font-semibold text-red-700 disabled:opacity-50"><Trash2 className="inline h-4 w-4" /> Remove</button>
        </div>}
      </div>)}
      {posts.length === 0 && <p className="p-5 text-sm text-slate-600">No articles yet. Create your first article.</p>}
    </div>}
    {managed && draft && <form className="space-y-4 border-t border-slate-200 pt-5"
      onSubmit={event => { event.preventDefault(); void save(); }}>
      <h3 className="font-semibold text-slate-900">{posts.some(p => p.id === draft.id) ? 'Edit article' : 'New article'}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          ['title', 'Title', 200], ['slug', 'URL slug', 128],
          ['metaTitle', 'SEO title', 200], ['metaDescription', 'SEO description', 300],
          ['author', 'Author', 120], ['readTime', 'Reading time', 40]
        ] as const).map(([field, label, max]) => <label key={field} className="text-xs font-semibold text-slate-700">
          {label}<input value={draft[field]} maxLength={max} onChange={event => setDraft(current => current ? { ...current, [field]: event.target.value } : current)}
            className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
        </label>)}
      </div>
      <label className="block text-xs font-semibold text-slate-700">Short excerpt
        <textarea rows={3} maxLength={500} value={draft.excerpt}
          onChange={event => setDraft(current => current ? { ...current, excerpt: event.target.value } : current)}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
      </label>
      <label className="block text-xs font-semibold text-slate-700">Article content (Markdown, max 50,000 chars)
        <textarea rows={14} maxLength={50000} value={draft.content}
          onChange={event => setDraft(current => current ? { ...current, content: event.target.value } : current)}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={draft.published}
          onChange={event => setDraft(current => current ? { ...current, published: event.target.checked } : current)} />
        Publish this article
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <Save className="mr-1 inline h-4 w-4" /> {busy ? 'Saving…' : 'Save article'}</button>
        <button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-slate-300 px-5 py-2 text-sm">Cancel</button>
      </div>
    </form>}
    {managed && <button type="button" onClick={() => void reload()} disabled={busy}
      className="text-sm font-semibold text-blue-700"><RefreshCw className="mr-1 inline h-4 w-4" /> Refresh articles</button>}
  </section>;
};
