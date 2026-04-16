/**
 * Schede turno collegate al composer: sopra la textbox, una card espandibile per ogni invio (debug flow).
 */
import React from 'react';
import { ChevronDown, ChevronRight, MessageSquareText } from 'lucide-react';
import type { DebuggerStep } from '../core/DebuggerStep';
import { DebuggerStepDetailContent } from './DebuggerStepDetailContent';

export function FlowDebuggerUtteranceStrip(props: {
  steps: readonly DebuggerStep[];
  onStepNoteChange: (stepId: string, note: string) => void;
  onReplayHighlight: (step: DebuggerStep) => void;
}) {
  const { steps, onStepNoteChange, onReplayHighlight } = props;
  const [openId, setOpenId] = React.useState<string | null>(null);
  const prevLenRef = React.useRef(0);

  React.useEffect(() => {
    if (steps.length > prevLenRef.current && steps.length > 0) {
      setOpenId(steps[steps.length - 1].id);
    }
    prevLenRef.current = steps.length;
  }, [steps]);

  if (steps.length === 0) {
    return (
      <p className="text-[11px] text-slate-600 leading-snug mb-2">
        Dopo <span className="font-semibold">Play</span>, ogni <span className="font-semibold">Invio</span> crea qui sotto
        una scheda espandibile con NLU e stato grafo; la textbox resta sempre l&apos;ultima riga per il prossimo messaggio.
      </p>
    );
  }

  return (
    <ul className="space-y-2 max-h-[min(40vh,280px)] overflow-y-auto mb-2 pr-0.5">
      {steps.map((step) => {
        const expanded = openId === step.id;
        const utter = String(step.utterance || '').trim() || '(vuoto)';
        return (
          <li key={step.id} className="rounded-lg border border-lime-800/25 bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              className="w-full flex items-start gap-2 text-left px-2 py-1.5 hover:bg-lime-50/80"
              onClick={() => setOpenId(expanded ? null : step.id)}
            >
              {expanded ? (
                <ChevronDown size={16} className="text-slate-500 shrink-0 mt-0.5" aria-hidden />
              ) : (
                <ChevronRight size={16} className="text-slate-500 shrink-0 mt-0.5" aria-hidden />
              )}
              <MessageSquareText size={15} className="text-lime-800/80 shrink-0 mt-0.5" aria-hidden />
              <span className="flex-1 min-w-0 text-sm text-slate-900 line-clamp-2" title={utter}>
                <span className="text-slate-500 font-medium">Tu ·</span>{' '}
                <span className="font-medium">«{utter}»</span>
              </span>
              <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono max-w-[90px] truncate">
                {step.grammar?.type || '—'}
              </span>
            </button>
            {expanded ? (
              <DebuggerStepDetailContent
                step={step}
                onStepNoteChange={onStepNoteChange}
                onReplayHighlight={onReplayHighlight}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
