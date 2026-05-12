/**
 * Preferenza «AI Agent editor a tutto schermo»: quando attiva, l'editor è renderizzato in un
 * portal che copre tutta l'area dell'app SOTTO la toolbar globale (header dell'applicazione),
 * nascondendo TaskTree, dock pannelli laterali e qualsiasi altra chrome circostante.
 *
 * Granularità: per istanza utente (browser tab), non per task. È una modalità di lavoro del
 * designer, non un attributo del task. Vive in `localStorage` con una chiave dedicata.
 *
 * Default: OFF. La preferenza è persistita anche a chiusura della pagina, così l'utente che
 * lavora abitualmente in fullscreen non deve riattivarla a ogni sessione.
 *
 * Storage: `localStorage` con guard try/catch per modalità incognito ristretto / SSR. Se lo
 * storage non è disponibile la preferenza resta in memoria solo per la sessione corrente.
 */
import React from 'react';

const STORAGE_KEY = 'omnia.aiAgentEditor.fullscreen';

function readPref(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writePref(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore: storage non disponibile, lo stato resta in memoria per la sessione */
  }
}

export interface FullscreenEditorPref {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  toggle: () => void;
}

/**
 * Hook che restituisce lo stato fullscreen e gli helper per modificarlo, sincronizzandosi con
 * `localStorage`. La lettura avviene una sola volta al primo render.
 */
export function useFullscreenEditorPref(): FullscreenEditorPref {
  const [enabled, setEnabledState] = React.useState<boolean>(() => readPref());

  const setEnabled = React.useCallback((value: boolean) => {
    setEnabledState((prev) => {
      if (prev === value) return prev;
      writePref(value);
      return value;
    });
  }, []);

  const toggle = React.useCallback(() => {
    setEnabledState((prev) => {
      const next = !prev;
      writePref(next);
      return next;
    });
  }, []);

  return { enabled, setEnabled, toggle };
}
