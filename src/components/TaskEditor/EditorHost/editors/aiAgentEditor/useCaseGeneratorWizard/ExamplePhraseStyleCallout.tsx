/**
 * Invito compatto (passo 2 wizard): propagare lo stile delle frasi modificate alle altre rigenerate dall’IA.
 */

import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

export interface ExamplePhraseStyleCalloutProps {
  visible: boolean;
  busy: boolean;
  onApply: () => void | Promise<void>;
}

export function ExamplePhraseStyleCallout({
  visible,
  busy,
  onApply,
}: ExamplePhraseStyleCalloutProps): React.ReactElement | null {
  const [pulse, setPulse] = React.useState(true);

  React.useEffect(() => {
    if (!visible) {
      setPulse(true);
      return;
    }
    const t = window.setTimeout(() => setPulse(false), 7200);
    return () => window.clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`mb-3 rounded-lg border border-violet-500/45 bg-violet-950/40 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(167,139,250,0.12)] ${
        pulse ? 'animate-pulse' : ''
      }`}
      role="status"
    >
      <p className="text-xs leading-relaxed text-amber-50/95">
        Ho visto che hai modificato delle frasi.
        <br />
        Se vuoi, posso aggiornare le altre imitando il tuo stile.
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
        Verranno riscritte solo le frasi ancora alla versione di generazione IA precedente, non quelle che hai già
        sistemato.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onApply()}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
        {busy ? 'Omogeneizzando…' : 'Omogeneizza messaggi'}
      </button>
    </div>
  );
}
