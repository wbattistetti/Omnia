/**
 * Modale globale: burst guard su chiamate IA agent-design (429 dal backend).
 */

import React from 'react';
import {
  AI_AGENT_HIGH_FREQUENCY_EVENT,
  type AiAgentHighFrequencyEventDetail,
} from '../../utils/aiAgentHighFrequencyAlert';

export function AiAgentHighFrequencyDialog(): React.ReactElement | null {
  const [open, setOpen] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onBurst = (ev: Event) => {
      const e = ev as CustomEvent<AiAgentHighFrequencyEventDetail>;
      const msg = e.detail?.serverMessage;
      setServerMessage(typeof msg === 'string' && msg.trim() ? msg.trim() : null);
      setOpen(true);
    };
    window.addEventListener(AI_AGENT_HIGH_FREQUENCY_EVENT, onBurst);
    return () => window.removeEventListener(AI_AGENT_HIGH_FREQUENCY_EVENT, onBurst);
  }, []);

  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ai-agent-high-frequency-title"
      aria-describedby="ai-agent-high-frequency-desc"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-xl border border-amber-700/80 bg-slate-900 p-5 text-slate-100 shadow-2xl"
        onClick={(clickEv) => clickEv.stopPropagation()}
      >
        <h2 id="ai-agent-high-frequency-title" className="text-lg font-semibold text-amber-100">
          Verifica: alta frequenza di chiamate all&apos;intelligenza artificiale
        </h2>
        <p id="ai-agent-high-frequency-desc" className="mt-3 text-sm text-slate-300 leading-relaxed">
          Sono arrivate troppe richieste al servizio IA in un breve intervallo. Attendi qualche
          secondo prima di riprovare, per evitare costi eccessivi e sovraccarico.
        </p>
        {serverMessage ? (
          <p className="mt-3 rounded-md border border-slate-600 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 break-words">
            {serverMessage}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            onClick={() => setOpen(false)}
          >
            Ho capito
          </button>
        </div>
      </div>
    </div>
  );
}
