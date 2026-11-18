import { useEffect, useState } from 'react';
import {
  DEFAULT_TOOLS, DEFAULT_HOME_SETTINGS, validateToolCatalog, readHomeSettings,
  type ToolEntry, type HomeSettings
} from '../data/toolCatalog';

/**
 * Firebase is intentionally imported AFTER the first paint.
 * The home shell, labels and default cards must never load the entire
 * Firebase Auth + Firestore SDK in their critical JavaScript bundle.
 */
export function usePublicToolCatalog(): { tools: ToolEntry[]; loading: boolean; error: boolean } {
  const [tools, setTools] = useState<ToolEntry[]>(DEFAULT_TOOLS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};
    void import('./firebase').then(({ db, doc, onSnapshot }) => {
      if (disposed) return;
      unsubscribe = onSnapshot(doc(db, 'site_content', 'tool_catalog'), snapshot => {
        if (disposed) return;
        if (snapshot.exists()) {
          const parsed = validateToolCatalog(snapshot.data());
          if (parsed !== null) { setTools(parsed); setError(false); }
          else setError(true);
        } else { setTools(DEFAULT_TOOLS); setError(false); }
        setLoading(false);
      }, () => {
        if (!disposed) { setError(true); setLoading(false); }
      });
    }).catch(() => {
      if (!disposed) { setError(true); setLoading(false); }
    });
    return () => { disposed = true; unsubscribe(); };
  }, []);
  return { tools, loading, error };
}

export function usePublicHomeSettings(): HomeSettings {
  const [settings, setSettings] = useState<HomeSettings>(DEFAULT_HOME_SETTINGS);
  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};
    void import('./firebase').then(({ db, doc, onSnapshot }) => {
      if (disposed) return;
      unsubscribe = onSnapshot(doc(db, 'site_content', 'homepage'), snapshot => {
        if (!disposed) setSettings(snapshot.exists()
          ? readHomeSettings(snapshot.data()) : DEFAULT_HOME_SETTINGS);
      }, () => { if (!disposed) setSettings(DEFAULT_HOME_SETTINGS); });
    }).catch(() => { if (!disposed) setSettings(DEFAULT_HOME_SETTINGS); });
    return () => { disposed = true; unsubscribe(); };
  }, []);
  return settings;
}
