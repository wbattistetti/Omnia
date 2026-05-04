/**
 * Riga SEND: criterio avanzamento collassato (label + Test + chip contesto) e apertura editor completo (overlay).
 */

import React from 'react';
import { Pencil, Play } from 'lucide-react';
import type { BackendInputAdvancementEntry } from '../../../../../domain/advancement/backendAdvancementConfig';
import type { AdvancementValueType } from '../../../../../domain/advancement/advancementDsl';
import {
  type AdvancementPlayContextBundle,
  type AdvancementQuickTestRowState,
  type SendRowSnapshot,
} from '../../../../../domain/advancement/advancementQuickTest';
import { AdvancementQuickTestChips } from './AdvancementQuickTestChips';

const NL_MAX = 72;

function ellipsis(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

export interface SendParamAdvancementRowEditorProps {
  wireKey: string;
  advancementEntry: BackendInputAdvancementEntry;
  sendRowSnapshot: SendRowSnapshot | undefined;
  paramType: AdvancementValueType;
  getPlayContext: (wk: string) => AdvancementPlayContextBundle;
  onOpenFullEditor: () => void;
  /** Stato chip test da parent (commitAdvancementQuickTest). */
  quickTestUi?: AdvancementQuickTestRowState;
  onRunQuickTest: () => void;
}

export function SendParamAdvancementRowEditor({
  wireKey: _wireKey,
  advancementEntry,
  sendRowSnapshot,
  paramType: _paramType,
  getPlayContext: _getPlayContext,
  onOpenFullEditor,
  quickTestUi,
  onRunQuickTest,
}: SendParamAdvancementRowEditorProps) {
  const nl = (advancementEntry.naturalLanguage || '').trim();
  const dsl = (advancementEntry.dslExpression || '').trim();

  const openEditor = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpenFullEditor();
    },
    [onOpenFullEditor]
  );

  const handlePlay = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRunQuickTest();
    },
    [onRunQuickTest]
  );

  return (
    <div className="group/advstrip flex min-h-7 max-w-[min(560px,72vw)] shrink-0 flex-wrap items-center gap-1 border-l border-teal-500/25 py-0.5 pl-2">
      <button
        type="button"
        onClick={openEditor}
        title={nl || dsl || 'Apri editor avanzamento'}
        className="min-w-0 flex-1 truncate rounded px-0.5 text-left text-[10px] leading-snug text-teal-100/95 hover:bg-slate-800/60"
      >
        {nl ? (
          <span>{ellipsis(nl, NL_MAX)}</span>
        ) : dsl ? (
          <span className="text-slate-400" title={dsl}>
            {ellipsis(dsl, NL_MAX)}
          </span>
        ) : (
          <span className="text-slate-500">clicca per definire avanzamento</span>
        )}
      </button>
      <button
        type="button"
        onClick={openEditor}
        className="shrink-0 rounded p-0.5 text-teal-300/90 opacity-0 transition-opacity hover:bg-slate-700/80 group-hover/advstrip:opacity-100"
        title="Modifica criterio di avanzamento"
        aria-label="Modifica criterio di avanzamento"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      {dsl ? (
        <button
          type="button"
          onClick={handlePlay}
          className="h-7 shrink-0 rounded border border-teal-500/45 p-0.5 text-teal-300/95 hover:bg-teal-500/15"
          title="Test avanzamento (letterali SEND + PREV globale)"
          aria-label="Test avanzamento"
        >
          <Play className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      ) : null}
      <AdvancementQuickTestChips state={quickTestUi} compact />
    </div>
  );
}
