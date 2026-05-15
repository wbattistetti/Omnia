/**
 * Varianti strutturali: righe impilate sotto il messaggio canonico (stesso ritmo visivo
 * icona + testo), senza pannello separato. Il pulsante «+» vive nella toolbar del messaggio.
 */

import React from 'react';
import { MessageSquareText, Trash2 } from 'lucide-react';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { ensureUseCasePhrases } from '@domain/useCaseBundle/migrateUseCase';
import {
  UC_AGENT_ROW_EDIT_BTN,
  UC_CLASSIC_TEXTAREA_AGENT,
} from '../useCaseComposerPresentation';

export interface StructuralVariantsEditorProps {
  useCase: AIAgentUseCase;
  busy: boolean;
  onPatch: (variantId: string, patch: { naturalText?: string; when?: string }) => void;
  onRemove: (variantId: string) => void;
}

export function StructuralVariantsEditor({
  useCase,
  busy,
  onPatch,
  onRemove,
}: StructuralVariantsEditorProps): React.ReactElement | null {
  const uc = ensureUseCasePhrases(useCase);
  const phrase = uc.phrases?.[0];
  const extraVariants = (phrase?.variants ?? []).filter((v) => v.variantId !== 'default');

  if (extraVariants.length === 0) return null;

  return (
    <div className="mt-1 space-y-1 border-t border-emerald-800/25 pt-1" aria-label="Varianti strutturali">
      {extraVariants.map((v) => (
        <div
          key={v.variantId}
          className="flex w-full min-w-0 flex-wrap items-start gap-x-1 gap-y-0.5 rounded px-0.5 py-0.5"
        >
          <span
            title={`Variante ${v.variantId}`}
            aria-hidden
            className="mt-0.5 shrink-0 inline-flex h-5 w-5 items-center justify-center text-emerald-300/75"
          >
            <MessageSquareText size={13} />
          </span>
          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <code className="shrink-0 rounded bg-slate-800/80 px-1 py-px font-mono text-[9px] text-slate-400">
                {v.variantId}
              </code>
              <input
                type="text"
                value={v.when ?? ''}
                disabled={busy}
                onChange={(e) => onPatch(v.variantId, { when: e.target.value })}
                className="min-w-0 flex-1 rounded border border-slate-700/80 bg-slate-950/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-200 placeholder:text-slate-600 disabled:opacity-50"
                placeholder="when — es. prima visita"
                aria-label={`when per ${v.variantId}`}
              />
            </div>
            <textarea
              value={v.naturalText ?? ''}
              disabled={busy}
              rows={2}
              spellCheck={false}
              onChange={(e) => onPatch(v.variantId, { naturalText: e.target.value })}
              className={`${UC_CLASSIC_TEXTAREA_AGENT} w-full min-h-[40px] resize-y rounded border border-slate-700/80 bg-slate-950/80 px-1.5 py-1 font-mono text-xs text-slate-100 placeholder:text-slate-600 disabled:opacity-50`}
              placeholder="Template alternativo con [valori]…"
              aria-label={`Template variante ${v.variantId}`}
            />
          </div>
          <button
            type="button"
            disabled={busy}
            title="Rimuovi variante"
            className={UC_AGENT_ROW_EDIT_BTN}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(v.variantId);
            }}
          >
            <Trash2 size={12} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
