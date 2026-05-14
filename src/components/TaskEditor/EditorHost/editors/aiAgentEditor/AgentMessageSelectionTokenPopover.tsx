/**
 * Azioni contestuali «Tokenizza» / «Rimuovi token» vicino alla selezione nel messaggio agente.
 * Con coordinate viewport (`fixedAnchor`) il controllo è `position: fixed` (evita clip + non
 * spinge layout); senza anchor resta flusso inline sotto il campo. L’ancora è il punto in
 * viewport sotto la riga del caret (non sul baseline), con fondo opaco per leggibilità.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { Brackets } from 'lucide-react';
import type { AgentTokenSelectionPopoverAction } from './agentMessageTokenHelpers';
import {
  LABEL_AGENT_MSG_SELECTION_TOKENIZE,
  LABEL_AGENT_MSG_SELECTION_UNTOKEN,
} from './constants';

export interface AgentMessageSelectionTokenPopoverProps {
  readonly action: AgentTokenSelectionPopoverAction;
  readonly disabled: boolean;
  readonly onTokenize: () => void;
  readonly onUntokenize: () => void;
  /** Se impostato, toolbar ancorata in viewport (angolo in basso a destra della selezione). */
  readonly fixedAnchor?: { top: number; left: number } | null;
}

export function AgentMessageSelectionTokenPopover({
  action,
  disabled,
  onTokenize,
  onUntokenize,
  fixedAnchor = null,
}: AgentMessageSelectionTokenPopoverProps): React.ReactElement | null {
  if (action === 'none') {
    return null;
  }
  const isUntoken = action === 'untokenize';
  const toolbar = (
    <div
      className={`flex w-max max-w-[min(100vw-1rem,18rem)] shrink-0 items-center rounded-md border border-emerald-600/55 bg-slate-950 px-0.5 py-0.5 shadow-md shadow-black/30 ring-1 ring-emerald-900/50 ${
        fixedAnchor ? 'mt-0' : 'mt-0.5'
      }`}
      role="toolbar"
      aria-label={isUntoken ? 'Rimuovi token dallo slot selezionato' : 'Tokenizza la selezione'}
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
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        onClick={() => {
          if (isUntoken) onUntokenize();
          else onTokenize();
        }}
        className={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[10px] font-semibold hover:bg-emerald-900/70 disabled:cursor-not-allowed disabled:opacity-40 ${
          isUntoken ? 'text-amber-100/95' : 'text-emerald-100'
        }`}
        title={
          isUntoken
            ? 'Rimuove le quadre dello slot che contiene la selezione'
            : 'Avvolge il testo selezionato (trim) tra [ ]'
        }
      >
        {!isUntoken ? <Brackets size={11} className="shrink-0 opacity-90" aria-hidden /> : null}
        {isUntoken ? LABEL_AGENT_MSG_SELECTION_UNTOKEN : LABEL_AGENT_MSG_SELECTION_TOKENIZE}
      </button>
    </div>
  );
  if (fixedAnchor && typeof document !== 'undefined') {
    return createPortal(toolbar, document.body);
  }
  return toolbar;
}
