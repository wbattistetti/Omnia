/**
 * Preferenza «LLM manual handoff» del wizard use case: quando attiva, i pulsanti di generazione
 * AI (Step 1 `generate_use_cases`, Step 2 `assemble_conversation`) NON chiamano l'LLM interno,
 * ma aprono un modale di handoff dove il designer copia il prompt verso un motore esterno
 * (es. ChatGPT-5) e incolla la risposta JSON da elaborare.
 *
 * Granularità: per istanza utente (browser tab), non per task. È una modalità di lavoro del
 * designer, non un attributo del task; quindi vive in `localStorage` con una chiave unica.
 *
 * Nota persistenza: usiamo `localStorage` con guard try/catch per supportare contesti in cui
 * il storage è negato (incognito ristretto, SSR). Default = OFF se valore mancante/corrotto.
 */
import React from 'react';

const STORAGE_KEY = 'omnia.aiAgent.externalLLMHandoff';

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

export interface ExternalLLMHandoffPref {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  toggle: () => void;
}

/**
 * Hook che restituisce la preferenza corrente e gli helper per modificarla, sincronizzandosi
 * con `localStorage`. La lettura avviene una sola volta al primo render.
 */
export function useExternalLLMHandoffPref(): ExternalLLMHandoffPref {
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
