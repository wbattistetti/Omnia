/**
 * Modale globale: per ogni chiamata IA agent-design chiede esplicitamente di procedere
 * quando `VITE_OMNIA_AI_AGENT_GENERATE_CONFIRM` è attivo (anche la prima richiesta).
 */

import React from 'react';
import {
  AI_AGENT_GENERATE_CONFIRM_EVENT,
  type AiAgentGenerateConfirmEventDetail,
} from '../../utils/aiAgentGenerateConfirmGate';

export function AiAgentGenerateConfirmDialog(): React.ReactElement | null {
  const queueRef = React.useRef<Array<(ok: boolean) => void>>([]);
  const [, setVersion] = React.useState(0);
  const bump = React.useCallback(() => setVersion((v) => v + 1), []);

  React.useEffect(() => {
    const h = (ev: Event) => {
      const e = ev as CustomEvent<AiAgentGenerateConfirmEventDetail>;
      if (typeof e.detail?.resolve !== 'function') return;
      queueRef.current.push(e.detail.resolve);
      bump();
    };
    window.addEventListener(AI_AGENT_GENERATE_CONFIRM_EVENT, h as EventListener);
    return () => window.removeEventListener(AI_AGENT_GENERATE_CONFIRM_EVENT, h as EventListener);
  }, [bump]);

  const pending = queueRef.current.length;
  if (pending === 0) return null;

  const proceed = () => {
    queueRef.current.shift()?.(true);
    bump();
  };

  const cancel = () => {
    queueRef.current.shift()?.(false);
    bump();
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ai-agent-generate-confirm-title"
      aria-describedby="ai-agent-generate-confirm-desc"
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/55 p-4"
      onClick={cancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-sky-700/80 bg-slate-900 p-5 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="ai-agent-generate-confirm-title" className="text-lg font-semibold text-sky-100">
          Richiesta all&apos;intelligenza artificiale
        </h2>
        <p id="ai-agent-generate-confirm-desc" className="mt-3 text-sm text-slate-300 leading-relaxed">
          Stai per inviare una chiamata al servizio IA (generazione / anteprima agent). Conferma per
          procedere oppure annulla.
        </p>
        {pending > 1 ? (
          <p className="mt-2 text-xs text-amber-200/90">
            Totale richieste in attesa di conferma: {pending} (confermate una alla volta).
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
            onClick={cancel}
          >
            Annulla
          </button>
          <button
            type="button"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            onClick={proceed}
          >
            Procedi
          </button>
        </div>
      </div>
    </div>
  );
}
