/**
 * Host modale per {@link DesignerLlmSetupPanel}: stesso pannello Omnia Tutor ovunque.
 * Il provider tiene stato; {@link DesignerLlmSetupOverlay} va montato nel contenitore giusto
 * (`contained` = cornice portale, `viewport` = app Omnia intera).
 */

import React from 'react';
import { X } from 'lucide-react';
import type { AgentReviewDesignerLlmSnapshot } from '@domain/agentReviewChannel/reviewDocument';
import { DesignerLlmSetupPanel } from './DesignerLlmSetupPanel';

export interface DesignerLlmSetupOpenOptions {
  publishedSnapshot?: AgentReviewDesignerLlmSnapshot | null;
}

interface DesignerLlmSetupHostContextValue {
  isOpen: boolean;
  publishedSnapshot: AgentReviewDesignerLlmSnapshot | null;
  openPanel: (options?: DesignerLlmSetupOpenOptions) => void;
  closePanel: () => void;
}

const DesignerLlmSetupHostContext = React.createContext<DesignerLlmSetupHostContextValue | null>(
  null
);

export interface DesignerLlmSetupHostProps {
  children: React.ReactNode;
  /** Snapshot predefinito (es. modello pubblicato nel portale review). */
  defaultPublishedSnapshot?: AgentReviewDesignerLlmSnapshot | null;
}

/** Solo context — monta {@link DesignerLlmSetupOverlay} nel layout (portale vs app). */
export function DesignerLlmSetupHost({
  children,
  defaultPublishedSnapshot = null,
}: DesignerLlmSetupHostProps): React.ReactElement {
  const [isOpen, setIsOpen] = React.useState(false);
  const [publishedSnapshot, setPublishedSnapshot] = React.useState<
    AgentReviewDesignerLlmSnapshot | null
  >(defaultPublishedSnapshot);

  React.useEffect(() => {
    setPublishedSnapshot(defaultPublishedSnapshot);
  }, [defaultPublishedSnapshot]);

  const openPanel = React.useCallback((options?: DesignerLlmSetupOpenOptions) => {
    if (options && 'publishedSnapshot' in options) {
      setPublishedSnapshot(options.publishedSnapshot ?? null);
    }
    setIsOpen(true);
  }, []);

  const closePanel = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = React.useMemo<DesignerLlmSetupHostContextValue>(
    () => ({ isOpen, publishedSnapshot, openPanel, closePanel }),
    [isOpen, publishedSnapshot, openPanel, closePanel]
  );

  return (
    <DesignerLlmSetupHostContext.Provider value={value}>{children}</DesignerLlmSetupHostContext.Provider>
  );
}

export type DesignerLlmSetupOverlayScope = 'viewport' | 'contained';

export interface DesignerLlmSetupOverlayProps {
  /** `contained` = overlay nella cornice del portale; `viewport` = fullscreen app. */
  scope?: DesignerLlmSetupOverlayScope;
}

/** Modale con scroll interno — non allunga la pagina. */
export function DesignerLlmSetupOverlay({
  scope = 'viewport',
}: DesignerLlmSetupOverlayProps): React.ReactElement | null {
  const ctx = React.useContext(DesignerLlmSetupHostContext);
  const isOpen = Boolean(ctx?.isOpen);
  const closePanel = ctx?.closePanel;
  const publishedSnapshot = ctx?.publishedSnapshot ?? null;

  React.useEffect(() => {
    if (!isOpen || !closePanel) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closePanel]);

  React.useEffect(() => {
    if (!isOpen || scope !== 'viewport') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen, scope]);

  if (!isOpen || !ctx || !closePanel) return null;

  const backdropClass =
    scope === 'contained'
      ? 'absolute inset-0 z-[200] flex items-center justify-center overflow-hidden bg-black/70 p-3'
      : 'fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-black/70 p-4';

  return (
    <div
      className={backdropClass}
      role="dialog"
      aria-modal="true"
      aria-labelledby="designer-llm-setup-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) closePanel();
      }}
    >
      <div className="flex max-h-full min-h-0 w-full max-w-3xl flex-col rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 id="designer-llm-setup-title" className="text-base font-semibold text-slate-100">
              Motore IA designer
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Stessa configurazione dell’Omnia Tutor: modello, reasoning, cost comparator.
            </p>
          </div>
          <button
            type="button"
            onClick={closePanel}
            className="shrink-0 rounded-md border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            aria-label="Chiudi configurazione motore IA"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <DesignerLlmSetupPanel publishedSnapshot={publishedSnapshot} />
        </div>
      </div>
    </div>
  );
}

/** Apre la modale con il pannello Omnia Tutor completo. */
export function useDesignerLlmSetupHost(): DesignerLlmSetupHostContextValue {
  const ctx = React.useContext(DesignerLlmSetupHostContext);
  if (!ctx) {
    throw new Error('useDesignerLlmSetupHost must be used within DesignerLlmSetupHost');
  }
  return ctx;
}

/** Hook opzionale — ritorna null fuori dall’host (es. test). */
export function useOptionalDesignerLlmSetupHost(): DesignerLlmSetupHostContextValue | null {
  return React.useContext(DesignerLlmSetupHostContext);
}
