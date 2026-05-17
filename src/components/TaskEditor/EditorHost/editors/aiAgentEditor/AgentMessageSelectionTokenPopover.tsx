/**
 * Azioni contestuali: Semantic token, Style token, Untokenize; editor varianti per style token.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { Brackets } from 'lucide-react';
import type { AgentTokenSelectionPopoverAction } from './agentMessageTokenHelpers';
import type { AIAgentPhraseStyleToken } from '@domain/useCaseBundle/schema';
import {
  LABEL_AGENT_MSG_SELECTION_SEMANTIC_TOKEN,
  LABEL_AGENT_MSG_SELECTION_STYLE_TOKEN,
  LABEL_AGENT_MSG_SELECTION_UNTOKEN,
} from './constants';
import { StyleTokenVariantsEditor } from './StyleTokenVariantsEditor';

export interface AgentMessageSelectionTokenPopoverProps {
  readonly action: AgentTokenSelectionPopoverAction;
  readonly disabled: boolean;
  readonly onSemanticToken: () => void;
  readonly onStyleToken: () => void;
  readonly onUntokenize: () => void;
  readonly fixedAnchor?: { top: number; left: number } | null;
  /** Se la selezione è dentro uno style token, mostra editor varianti. */
  readonly activeStyleToken?: AIAgentPhraseStyleToken | null;
  readonly onStyleTokenVariantsChange?: (variants: string[]) => void;
}

export function AgentMessageSelectionTokenPopover({
  action,
  disabled,
  onSemanticToken,
  onStyleToken,
  onUntokenize,
  fixedAnchor = null,
  activeStyleToken = null,
  onStyleTokenVariantsChange,
}: AgentMessageSelectionTokenPopoverProps): React.ReactElement | null {
  if (action === 'none') {
    return null;
  }
  const isUntoken = action === 'untokenize';

  const toolbar = (
    <div
      className={`flex w-max max-w-[min(100vw-1rem,20rem)] shrink-0 flex-col rounded-md border border-emerald-600/55 bg-slate-950 px-1 py-1 shadow-md shadow-black/30 ring-1 ring-emerald-900/50 ${
        fixedAnchor ? 'mt-0' : 'mt-0.5'
      }`}
      role="toolbar"
      aria-label={
        isUntoken ? 'Rimuovi token o modifica varianti stile' : 'Tokenizza la selezione'
      }
      style={
        fixedAnchor
          ? {
              position: 'fixed',
              top: fixedAnchor.top,
              left: fixedAnchor.left,
              transform: 'translateX(-100%)',
              zIndex: 80,
            }
          : undefined
      }
    >
      <div className="flex flex-wrap items-stretch gap-0.5">
        {isUntoken ? (
          <button
            type="button"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onUntokenize}
            className="inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[10px] font-semibold text-amber-100/95 hover:bg-emerald-900/70 disabled:cursor-not-allowed disabled:opacity-40"
            title="Rimuove il token (semantic o style) che contiene la selezione"
          >
            {LABEL_AGENT_MSG_SELECTION_UNTOKEN}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onSemanticToken}
              className="inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[10px] font-semibold text-amber-100 hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-40"
              title="Slot semantico […] — valori variabili (data, nome, …)"
            >
              <Brackets size={11} className="shrink-0 opacity-90" aria-hidden />
              {LABEL_AGENT_MSG_SELECTION_SEMANTIC_TOKEN}
            </button>
            <button
              type="button"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onStyleToken}
              className="inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[10px] font-semibold text-sky-100 hover:bg-sky-950/50 disabled:cursor-not-allowed disabled:opacity-40"
              title="Style token «…» — varianti di formulazione (giusto, va bene, …)"
            >
              {LABEL_AGENT_MSG_SELECTION_STYLE_TOKEN}
            </button>
          </>
        )}
      </div>
      {isUntoken && activeStyleToken && onStyleTokenVariantsChange ? (
        <StyleTokenVariantsEditor
          token={activeStyleToken}
          disabled={disabled}
          onChange={onStyleTokenVariantsChange}
        />
      ) : null}
    </div>
  );

  if (fixedAnchor && typeof document !== 'undefined') {
    return createPortal(toolbar, document.body);
  }
  return toolbar;
}
