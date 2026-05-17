/**
 * Azioni contestuali: Semantic token, Style token, Untokenize; editor varianti per style token.
 * Posizionamento fixed con flip sopra se non c'è spazio sotto il caret.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { Brackets, Eraser, Quote, X } from 'lucide-react';
import type { AgentTokenSelectionPopoverAction } from './agentMessageTokenHelpers';
import type { AIAgentPhraseStyleToken } from '@domain/useCaseBundle/schema';
import {
  LABEL_AGENT_MSG_SELECTION_SEMANTIC_TOKEN,
  LABEL_AGENT_MSG_SELECTION_STYLE_TOKEN,
  LABEL_AGENT_MSG_SELECTION_UNTOKEN,
} from './constants';
import { StyleTokenVariantsEditor } from './StyleTokenVariantsEditor';
import {
  type AgentMessageTokenPopoverAnchor,
  resolveFloatingPopoverPosition,
} from './agentMessageTokenPopoverAnchor';

export type { AgentMessageTokenPopoverAnchor };

export interface AgentMessageSelectionTokenPopoverProps {
  readonly action: AgentTokenSelectionPopoverAction;
  readonly disabled: boolean;
  readonly onSemanticToken: () => void;
  readonly onStyleToken: () => void;
  readonly onUntokenize: () => void;
  readonly fixedAnchor?: AgentMessageTokenPopoverAnchor | null;
  readonly activeStyleToken?: AIAgentPhraseStyleToken | null;
  readonly onStyleTokenVariantsChange?: (variants: string[]) => void;
  /** Chiude il pannello senza modificare il testo (collassa la selezione). */
  readonly onClose: () => void;
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
  onClose,
}: AgentMessageSelectionTokenPopoverProps): React.ReactElement | null {
  const toolbarRef = React.useRef<HTMLDivElement | null>(null);
  const [resolvedPosition, setResolvedPosition] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const [placement, setPlacement] = React.useState<'below' | 'above'>('below');

  const isUntoken = action === 'untokenize';
  const showStyleVariants =
    isUntoken && activeStyleToken && onStyleTokenVariantsChange;

  React.useLayoutEffect(() => {
    if (!fixedAnchor || !toolbarRef.current || action === 'none') {
      setResolvedPosition(null);
      return;
    }
    const measure = () => {
      const el = toolbarRef.current;
      if (!el || !fixedAnchor) return;
      const { top, left, placement: p } = resolveFloatingPopoverPosition({
        anchor: fixedAnchor,
        popoverWidth: el.offsetWidth,
        popoverHeight: el.offsetHeight,
      });
      setResolvedPosition({ top, left });
      setPlacement(p);
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [fixedAnchor, action, showStyleVariants, activeStyleToken?.variants.length]);

  if (action === 'none') {
    return null;
  }

  const fixedTop = fixedAnchor ? resolvedPosition?.top ?? fixedAnchor.top : undefined;
  const fixedLeft = fixedAnchor ? resolvedPosition?.left ?? fixedAnchor.left : undefined;

  const toolbar = (
    <div
      ref={toolbarRef}
      className={`relative flex w-fit max-w-[min(100vw-1rem,20rem)] shrink-0 flex-col gap-0 rounded-md border bg-slate-950 px-2 pb-1.5 pt-1 shadow-md shadow-black/35 ring-1 ${
        showStyleVariants
          ? 'border-sky-600/45 ring-sky-900/40'
          : 'border-emerald-600/55 ring-emerald-900/50'
      } ${fixedAnchor ? '' : 'mt-0.5'}`}
      role="toolbar"
      aria-label={
        isUntoken ? 'Rimuovi token o modifica varianti stile' : 'Tokenizza la selezione'
      }
      data-placement={placement}
      style={
        fixedAnchor
          ? {
              position: 'fixed',
              top: fixedTop,
              left: fixedLeft,
              zIndex: 80,
            }
          : undefined
      }
    >
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClose}
        className="absolute right-0.5 top-0.5 z-10 flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800/90 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        title="Chiudi pannello"
        aria-label="Chiudi pannello"
      >
        <X size={14} aria-hidden />
      </button>
      {isUntoken ? (
        <div className="flex w-full justify-start pr-7">
          <button
            type="button"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onUntokenize}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-amber-100/95 hover:bg-amber-950/40 disabled:cursor-not-allowed disabled:opacity-40"
            title="Rimuove il token (semantic o style) che contiene la selezione"
          >
            <Eraser size={14} className="shrink-0 opacity-90" aria-hidden />
            {LABEL_AGENT_MSG_SELECTION_UNTOKEN}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-start gap-1 pr-7">
          <button
            type="button"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onSemanticToken}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-950/45 disabled:cursor-not-allowed disabled:opacity-40"
            title="Slot semantico […] — valori variabili (data, nome, …)"
          >
            <Brackets size={14} className="shrink-0 opacity-90" aria-hidden />
            {LABEL_AGENT_MSG_SELECTION_SEMANTIC_TOKEN}
          </button>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onStyleToken}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-sky-100 hover:bg-sky-950/45 disabled:cursor-not-allowed disabled:opacity-40"
            title="Style token «…» — varianti di formulazione (giusto, va bene, …)"
          >
            <Quote size={14} className="shrink-0 opacity-90" aria-hidden />
            {LABEL_AGENT_MSG_SELECTION_STYLE_TOKEN}
          </button>
        </div>
      )}
      {showStyleVariants ? (
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
