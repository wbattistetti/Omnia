/**
 * Hook che restituisce la coordinata `bottom` (pixel, viewport-relative) della toolbar globale
 * dell'app. È usato dalle modalità «fullscreen editor» per posizionare il proprio portal subito
 * sotto la toolbar — l'editor occupa l'intera area dell'app SOTTO la toolbar, senza coprirla.
 *
 * Logica:
 *   1. Trova l'elemento DOM marcato con `[data-omnia-app-toolbar]` (vedi `Toolbar.tsx`).
 *   2. Misura `getBoundingClientRect().bottom` come distanza in px dal top del viewport.
 *   3. Mantiene il valore aggiornato in risposta a:
 *      - `ResizeObserver` (la toolbar cambia altezza, es. perché aggiunge una riga);
 *      - `window.resize` (cambia il viewport, anche se la toolbar non cambia, comunque la coord
 *        rimane stabile — abbiamo un re-measure di sicurezza);
 *      - `MutationObserver` su `body` (l'app monta la toolbar dopo il primo render).
 *
 * Restituisce `null` finché la toolbar non viene trovata (es. su splash screen, landing page).
 * In quel caso il chiamante deve fallback a `0` (full viewport) o ritardare il fullscreen.
 *
 * Side-effect-free: l'hook non muta il DOM, solo osserva.
 */
import React from 'react';

const TOOLBAR_SELECTOR = '[data-omnia-app-toolbar]';

export function useAppToolbarBottom(): number | null {
  const [bottom, setBottom] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let observedEl: Element | null = null;

    const measure = (): void => {
      const el = document.querySelector(TOOLBAR_SELECTOR);
      if (!el) {
        setBottom((prev) => (prev === null ? prev : null));
        return;
      }
      const rect = el.getBoundingClientRect();
      const next = rect.bottom;
      setBottom((prev) => (prev !== null && Math.abs(prev - next) < 0.5 ? prev : next));
    };

    const ensureObservedElement = (): void => {
      const el = document.querySelector(TOOLBAR_SELECTOR);
      if (el === observedEl) return;
      if (resizeObserver && observedEl) resizeObserver.unobserve(observedEl);
      observedEl = el;
      if (resizeObserver && el) resizeObserver.observe(el);
    };

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => measure());
    }

    /**
     * Il `body` può montare/smontare la toolbar dinamicamente (es. landing → mainApp). Osserviamo
     * la mutazione dei figli per ri-attaccare il `ResizeObserver` quando l'elemento appare.
     */
    mutationObserver = new MutationObserver(() => {
      ensureObservedElement();
      measure();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const onWindowResize = (): void => measure();
    window.addEventListener('resize', onWindowResize);

    ensureObservedElement();
    measure();

    return () => {
      window.removeEventListener('resize', onWindowResize);
      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
    };
  }, []);

  return bottom;
}
