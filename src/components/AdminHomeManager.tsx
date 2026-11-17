import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { db, doc, getDoc, setDoc } from '../services/firebase';
import { DEFAULT_HOME_SETTINGS, readHomeSettings, type HomeSettings } from '../data/toolCatalog';

export const AdminHomeManager: React.FC = () => {
  const [settings, setSettings] = useState<HomeSettings>(DEFAULT_HOME_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    void getDoc(doc(db, 'site_content', 'homepage'))
      .then(snapshot => { if (active) setSettings(snapshot.exists() ? readHomeSettings(snapshot.data()) : DEFAULT_HOME_SETTINGS); })
      .catch(() => { if (active) setError('Could not load existing homepage content. Reload before making changes.'); });
    return () => { active = false; };
  }, []);

  const update = (field: keyof HomeSettings, value: string) => {
    setSettings(current => ({ ...current, [field]: value })); setDirty(true); setNotice('');
  };
  const save = async () => {
    if (busy || !dirty) return;
    if (!settings.headline.trim() || !settings.highlight.trim() || !settings.description.trim() || !settings.announcement.trim()) {
      setError('All homepage fields are required.'); return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      await setDoc(doc(db, 'site_content', 'homepage'), { ...readHomeSettings(settings), updatedAt: new Date().toISOString() });
      setDirty(false); setNotice('Homepage copy saved to Firestore and published for new visits.');
    } catch {
      setError('Could not save homepage content. Check Firestore rules and OTP admin access.');
    } finally { setBusy(false); }
  };
  const fields: { key: keyof HomeSettings; label: string; max: number }[] = [
    { key: 'headline', label: 'Main heading', max: 100 },
    { key: 'highlight', label: 'Blue heading / highlight', max: 100 },
    { key: 'description', label: 'Hero description', max: 400 },
    { key: 'announcement', label: 'Small announcement above heading', max: 140 }
  ];
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 space-y-5">
    <div>
      <h2 className="text-lg font-bold text-slate-900">Homepage Content Editor</h2>
      <p className="mt-1 text-sm text-slate-600">Edit live homepage hero text without touching GitHub. Saved text is escaped by React; it cannot execute HTML or JavaScript.</p>
    </div>
    <div className="grid gap-4">
      {fields.map(field => <label key={field.key} className="text-sm font-semibold text-slate-700">
        {field.label} <span className="font-normal text-xs text-slate-500">({settings[field.key].length}/{field.max})</span>
        {field.key === 'description' ? <textarea value={settings[field.key]} maxLength={field.max} rows={3}
          onChange={e => update(field.key, e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-3 text-sm" />
        : <input value={settings[field.key]} maxLength={field.max} onChange={e => update(field.key, e.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-3 text-sm" />}
      </label>)}
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <button type="button" onClick={() => void save()} disabled={!dirty || busy || !!error && !dirty}
      className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
      <Save className="mr-1 inline h-4 w-4" />{busy ? 'Saving…' : 'Save homepage'}
    </button>
  </section>;
};
