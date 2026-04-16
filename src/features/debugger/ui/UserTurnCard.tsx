/**
 * Card compatta per un turno utente in flow mode: icona + testo; hover → matita per modificare; chevron a destra espande il dettaglio NLU.
 */
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, MessageSquareText, Pencil } from 'lucide-react';
import type { Message } from '@components/ChatSimulator/UserMessage';
import type { DebuggerStep } from '../core/DebuggerStep';
import { UserTurnDetail } from './UserTurnDetail';

export function UserTurnCard(props: {
  message: Message;
  step: DebuggerStep | undefined;
  expanded: boolean;
  onToggleExpand: () => void;
  onStepNoteChange: (stepId: string, note: string) => void;
  onReplayHighlight: (step: DebuggerStep) => void;
  onEditResponse: (messageId: string, newText: string) => void | Promise<void>;
}) {
  const {
    message,
    step,
    expanded,
    onToggleExpand,
    onStepNoteChange,
    onReplayHighlight,
    onEditResponse,
  } = props;

  const utter = String(message.text || '').trim() || '(vuoto)';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(utter);

  useEffect(() => {
    setDraft(utter);
  }, [utter, message.id]);

  const saveEdit = async () => {
    const t = draft.trim();
    if (!t || t === utter) {
      setEditing(false);
      return;
    }
    await onEditResponse(message.id, t);
    setEditing(false);
  };

  return (
    <div className="rounded-lg border border-purple-200/80 bg-purple-50/40 max-w-xs lg:max-w-md w-full overflow-hidden shadow-sm">
      {editing ? (
        <div className="px-2 py-2 space-y-2">
          <input
            className="w-full px-2 py-1.5 text-sm border rounded border-purple-300"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void saveEdit();
              if (e.key === 'Escape') {
                setDraft(utter);
                setEditing(false);
              }
            }}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs px-2 py-1 rounded bg-slate-900 text-lime-300"
              onClick={() => void saveEdit()}
            >
              Salva e riesegui da qui
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1 rounded border border-slate-300"
              onClick={() => {
                setDraft(utter);
                setEditing(false);
              }}
            >
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="group w-full flex items-center gap-2 px-2 py-2">
            <MessageSquareText size={15} className="text-purple-700 shrink-0" aria-hidden />
            <span className="flex-1 min-w-0 text-sm text-left font-medium text-slate-900 break-words">
              {utter}
            </span>
            <button
              type="button"
              className="shrink-0 p-1 rounded text-slate-600 hover:bg-purple-100/80 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto focus:outline-none focus:ring-2 focus:ring-purple-400"
              title="Modifica risposta"
              aria-label="Modifica risposta"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
            >
              <Pencil size={14} aria-hidden />
            </button>
            <button
              type="button"
              className="shrink-0 p-1 rounded hover:bg-purple-100/80 text-slate-600"
              aria-expanded={expanded}
              aria-label={expanded ? 'Comprimi dettaglio NLU' : 'Espandi dettaglio NLU'}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
            >
              {expanded ? (
                <ChevronDown size={16} className="text-slate-600" aria-hidden />
              ) : (
                <ChevronRight size={16} className="text-slate-600" aria-hidden />
              )}
            </button>
          </div>
          {expanded ? (
            <UserTurnDetail
              step={step}
              onStepNoteChange={onStepNoteChange}
              onReplayHighlight={onReplayHighlight}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
