import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { db, doc, getDoc, setDoc } from '../services/firebase';
import {
  DEFAULT_TOOLS, INSTALLED_TOOLS, validateToolCatalog,
  type ToolEntry
} from '../data/toolCatalog';

const catalogRef = () => doc(db, 'site_content', 'tool_catalog');
const emptyEditor: ToolEntry = {
  id: '', title: '', description: '', path: '', status: 'draft',
  enabled: false, featured: false, sortOrder: 500
};

export const AdminToolManager: React.FC = () => {
  const [items, setItems] = useState<ToolEntry[]>(DEFAULT_TOOLS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<ToolEntry>(emptyEditor);
  const [editId, setEditId] = useState<string | null>(null);
  const [newInstalledId, setNewInstalledId] = useState('');

  const reload = async () => {
    setLoading(true); setError('');
    try {
      const snapshot = await getDoc(catalogRef());
      if (snapshot.exists()) {
        const parsed = validateToolCatalog(snapshot.data());
        if (parsed === null) throw Error('Invalid tool catalog document. No changes were made.');
        setItems(parsed);
      } else setItems(DEFAULT_TOOLS);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tool catalog.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  const change = (id: string, updates: Partial<ToolEntry>) => {
    setItems(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
    setDirty(true); setNotice('');
  };

  const unused = useMemo(() => INSTALLED_TOOLS.filter(tool => !items.some(item => item.id === tool.id)), [items]);

  const addInstalled = () => {
    const selected = INSTALLED_TOOLS.find(tool => tool.id === newInstalledId);
    if (!selected || items.some(item => item.id === selected.id)) return;
    setItems(current => [...current, {
      ...selected, enabled: true, featured: false, status: 'installed',
      sortOrder: current.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1
    }]);
    setNewInstalledId(''); setDirty(true); setNotice('');
  };

  const addDraft = () => {
    const id = editor.id.trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]{0,62}$/.test(id) ||
        INSTALLED_TOOLS.some(tool => tool.id === id) ||
        items.some(item => item.id === id)) {
      setError('Use a unique lowercase draft ID, such as image-resizer. Built-in tool IDs cannot be used.');
      return;
    }
    if (!editor.title.trim() || !editor.description.trim()) {
      setError('Draft title and description are required.'); return;
    }
    setItems(current => [...current, {
      ...editor, id, path: '', status: 'draft', enabled: false, featured: false,
      title: editor.title.trim().slice(0, 100),
      description: editor.description.trim().slice(0, 360)
    }]);
    setEditor(emptyEditor); setDirty(true); setError('');
  };

  const remove = (tool: ToolEntry) => {
    if (!window.confirm(tool.status === 'installed'
      ? 'Remove ' + tool.title + ' from the public directory? Its code is NOT deleted; you can re-add it here.'
      : 'Delete this unpublished tool idea?')) return;
    setItems(current => current.filter(item => item.id !== tool.id));
    setDirty(true); setNotice('');
  };

  const save = async () => {
    setError(''); setNotice('');
    const parsed = validateToolCatalog({ items });
    if (parsed === null) {
      setError('Catalog validation failed. Use unique IDs, short descriptions and installed routes only.');
      return;
    }
    setBusy(true);
    try {
      // Firestore rules (deployed separately) must enforce owner + email OTP.
      await setDoc(catalogRef(), { items: parsed, updatedAt: new Date().toISOString() });
      setItems(parsed); setDirty(false);
      setNotice('Tool directory saved to Firebase. New public visits will use these settings.');
    } catch {
      setError('Could not save. Verify owner-only Firestore rules and your OTP-authenticated Firebase session.');
    } finally { setBusy(false); }
  };

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 space-y-5">
    <div className="flex flex-wrap justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Online Tool Manager</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Show, hide, rename, feature or reorder tools already built into ToolsCresta.
          Removal unlists the tool and blocks its in-app route; executable code is not deleted.
          A brand-new converter requires development, tests and deployment before it can go live.
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => void reload()} disabled={loading || busy}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50">
          <RefreshCw className="inline h-4 w-4 mr-1" /> Reload
        </button>
        <button type="button" onClick={() => void save()} disabled={loading || busy || !dirty}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <Save className="inline h-4 w-4 mr-1" /> {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
    {dirty && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      You have unsaved changes. Save changes to update the live directory.
    </p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="flex gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />{notice}</p>}
    {loading ? <p className="text-sm text-slate-500">Reading tool catalog…</p> :
    <div className="space-y-3">
      {items.length === 0 && <p className="rounded-lg bg-slate-50 p-3 text-sm">No tools listed. Add installed tools below.</p>}
      {items.map(tool => <article key={tool.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">{tool.status === 'draft' ? 'Draft idea — NOT public' : tool.path}</p>
            <h3 className="font-semibold text-slate-900">{tool.title}</h3>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            {tool.status === 'installed' && <>
              <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={tool.enabled}
                onChange={e => change(tool.id, { enabled: e.target.checked })} /> Live</label>
              <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={tool.featured}
                onChange={e => change(tool.id, { featured: e.target.checked })} /> Featured</label>
            </>}
            <button type="button" onClick={() => { setEditId(editId === tool.id ? null : tool.id); setError(''); }}
              className="text-blue-700 underline">{editId === tool.id ? 'Close editor' : 'Edit details'}</button>
            <button type="button" onClick={() => remove(tool)} className="text-red-700 underline">
              <Trash2 className="inline h-4 w-4" /> Remove
            </button>
          </div>
        </div>
        {editId === tool.id && <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">Tool name
            <input value={tool.title} maxLength={100} onChange={e => change(tool.id, { title: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-700">Order (0–1000)
            <input type="number" min={0} max={1000} value={tool.sortOrder}
              onChange={e => change(tool.id, { sortOrder: Math.max(0, Math.min(1000, Number(e.target.value) || 0)) })}
              className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Description
            <textarea value={tool.description} maxLength={360} rows={2}
              onChange={e => change(tool.id, { description: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
          </label>
        </div>}
      </article>)}
    </div>}

    <div className="border-t border-slate-200 pt-5 space-y-3">
      <h3 className="font-semibold">Add an already-installed tool</h3>
      <div className="flex flex-wrap gap-2">
        <select value={newInstalledId} onChange={e => setNewInstalledId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2.5 text-sm">
          <option value="">Choose an installed tool…</option>
          {unused.map(tool => <option key={tool.id} value={tool.id}>{tool.title}</option>)}
        </select>
        <button type="button" disabled={!newInstalledId} onClick={addInstalled}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <Plus className="mr-1 inline h-4 w-4" /> Add installed
        </button>
      </div>
    </div>

    <div className="border-t border-slate-200 pt-5 space-y-3">
      <h3 className="font-semibold">Plan a new tool (unpublished draft)</h3>
      <p className="text-xs text-slate-500">Drafts do not create working APIs or public tool pages.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700">Draft ID
          <input value={editor.id} maxLength={63} placeholder="image-resizer"
            onChange={e => setEditor(item => ({ ...item, id: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
        </label>
        <label className="text-xs font-semibold text-slate-700">Tool name
          <input value={editor.title} maxLength={100} placeholder="Image Resizer"
            onChange={e => setEditor(item => ({ ...item, title: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
        </label>
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Requirements / description
          <textarea value={editor.description} maxLength={360} rows={2}
            onChange={e => setEditor(item => ({ ...item, description: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
        </label>
      </div>
      <button type="button" onClick={addDraft}
        className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700">
        <Plus className="mr-1 inline h-4 w-4" /> Add draft to list
      </button>
    </div>
  </section>;
};
