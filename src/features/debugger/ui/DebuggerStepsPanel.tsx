/**
 * Variante pannello scrollabile (opzionale): stesse schede turno di FlowDebuggerUtteranceStrip.
 */
import React from 'react';
import { ChevronDown, ChevronRight, MessageSquareText } from 'lucide-react';
import type { DebuggerStep } from '../core/DebuggerStep';
import { DebuggerStepDetailContent } from './DebuggerStepDetailContent';

export function DebuggerStepsPanel(props: {
  steps: readonly DebuggerStep[];
  onStepNoteChange: (stepId: string, note: string) => void;
  onReplayHighlight: (step: DebuggerStep) => void;
  className?: string;
}) {
  const { steps, onStepNoteChange, onReplayHighlight, className } = props;
  const [openId, setOpenId] = React.useState<string | null>(null);

  if (steps.length === 0) {
    return (
      <div
        className={`text-xs text-slate-600 px-3 py-2.5 border-b border-lime-800/35 bg-lime-50/90 ${className || ''}`}
        role="status"
      >
        <p className="font-medium text-slate-800">Schede turno (debug)</p>
        <p className="mt-1 leading-snug">
          Dopo <span className="font-semibold">Play</span>, ogni invio crea una scheda espandibile (in flow mode è sopra
          la textbox).
        </p>
      </div>
    );
  }

  return (
    <div
      className={`border-b border-lime-800/40 bg-lime-50/95 max-h-[38vh] overflow-y-auto shrink-0 ${className || ''}`}
    >
      <div className="px-3 py-1.5 sticky top-0 bg-lime-50/95 border-b border-lime-800/20 z-[1]">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
          Schede turno (debug) · {steps.length} invio{steps.length === 1 ? '' : 'i'}
        </div>
      </div>
      <ul className="space-y-1.5 px-2 pb-2 pt-1">
        {steps.map((step) => {
          const expanded = openId === step.id;
          const utter = String(step.utterance || '').trim() || '(vuoto)';

          return (
            <li key={step.id} className="rounded-md border border-slate-200/90 bg-white shadow-sm">
              <button
                type="button"
                className="w-full flex items-start gap-2 text-left px-2 py-1.5 hover:bg-slate-50/90 rounded-t-md"
                onClick={() => setOpenId(expanded ? null : step.id)}
              >
                {expanded ? (
                  <ChevronDown size={16} className="text-slate-500 shrink-0 mt-0.5" aria-hidden />
                ) : (
                  <ChevronRight size={16} className="text-slate-500 shrink-0 mt-0.5" aria-hidden />
                )}
                <MessageSquareText size={15} className="text-slate-500 shrink-0 mt-0.5" aria-hidden />
                <span className="flex-1 min-w-0 text-sm text-slate-900 line-clamp-2" title={utter}>
                  <span className="text-slate-500 font-medium">Tu ·</span>{' '}
                  <span className="font-medium">«{utter}»</span>
                </span>
                <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono max-w-[100px] truncate">
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
    </div>
  );
}
