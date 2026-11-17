import { useEffect, useState } from 'react';
import { db, doc, onSnapshot } from './firebase';
import {
  DEFAULT_TOOLS, DEFAULT_HOME_SETTINGS, validateToolCatalog, readHomeSettings,
  type ToolEntry, type HomeSettings
} from '../data/toolCatalog';

/** Public, read-only Firestore subscription. In the absence of a published
 * configuration, all already-installed tools retain their original visibility.
 * No admin credentials or secrets are read by this hook.
 */
export function usePublicToolCatalog(): { tools: ToolEntry[]; loading: boolean; error: boolean } {
  const [tools, setTools] = useState<ToolEntry[]>(DEFAULT_TOOLS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => onSnapshot(doc(db, 'site_content', 'tool_catalog'), snapshot => {
    if (snapshot.exists()) {
      const parsed = validateToolCatalog(snapshot.data());
      if (parsed !== null) setTools(parsed);
      else setError(true);
    } else setTools(DEFAULT_TOOLS);
    setLoading(false);
  }, () => { setError(true); setLoading(false); }), []);
  return { tools, loading, error };
}

export function usePublicHomeSettings(): HomeSettings {
  const [settings, setSettings] = useState<HomeSettings>(DEFAULT_HOME_SETTINGS);
  useEffect(() => onSnapshot(doc(db, 'site_content', 'homepage'), snapshot => {
    setSettings(snapshot.exists() ? readHomeSettings(snapshot.data()) : DEFAULT_HOME_SETTINGS);
  }, () => setSettings(DEFAULT_HOME_SETTINGS)), []);
  return settings;
}
