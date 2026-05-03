/**
 * Design-time simulated chat: agent bubble toolbar hosts confirm/cancel via EditableText toolbar API
 * (same pattern as ResponseEditor EditableText + external actions).
 */
import React from 'react';
import type { AIAgentPreviewTurn } from '@types/aiAgentPreview';
import { AI_AGENT_PREVIEW_STYLES } from '@types/aiAgentPreview';
import { Check, Pencil, StickyNote, Trash2, X } from 'lucide-react';
import { EditableText, type EditableTextToolbarApi } from '@components/common/EditableText';

export interface AIAgentPreviewChatPanelProps {
  selectedStyleId: string;
  onStyleIdChange: (styleId: string) => void;
  turns: AIAgentPreviewTurn[];
  onTurnsChange: (next: AIAgentPreviewTurn[]) => void;
  emptyPlaceholder: React.ReactNode;
  /** When true, style and message/note editing are disabled (frozen design). */
  readOnly?: boolean;
  /** Hide the style row (e.g. when the parent renders the selector in a shared header). */
  hideStyleSelector?: boolean;
  /** When true, the scroll area has no inner rounded border (parent provides the outer shell). */
  flushMessagesArea?: boolean;
}

function replaceTurn(turns: AIAgentPreviewTurn[], index: number, patch: Partial<AIAgentPreviewTurn>) {
  return turns.map((t, i) => (i === index ? { ...t, ...patch } : t));
}

function hasSavedNoteText(turn: AIAgentPreviewTurn): boolean {
  return (turn.designerNote ?? '').trim().length > 0;
}

const AGENT_EDITABLE_TEXT_STYLE: React.CSSProperties = {
  background: 'rgb(2 6 23)',
  color: '#f1f5f9',
  border: '1px solid rgb(139 92 246 / 0.45)',
  borderRadius: 6,
  width: '100%',
  minHeight: 72,
};

const NOTE_EDITABLE_TEXT_STYLE: React.CSSProperties = {
  background: 'rgb(2 6 23)',
  color: 'rgb(254 243 199 / 0.9)',
  border: '1px solid rgb(217 119 6 / 0.45)',
  borderRadius: 6,
  width: '100%',
  minHeight: 64,
};

export function AIAgentPreviewChatPanel({
  selectedStyleId,
  onStyleIdChange,
  turns,
  onTurnsChange,
  emptyPlaceholder,
  readOnly = false,
  hideStyleSelector = false,
  flushMessagesArea = false,
}: AIAgentPreviewChatPanelProps) {
  const [editingMessageIndex, setEditingMessageIndex] = React.useState<number | null>(null);
  const [editingNoteIndex, setEditingNoteIndex] = React.useState<number | null>(null);
  const [expandedNotePanelIndex, setExpandedNotePanelIndex] = React.useState<number | null>(null);

  const messageToolbarRef = React.useRef<EditableTextToolbarApi | null>(null);
  const noteToolbarRef = React.useRef<EditableTextToolbarApi | null>(null);

  React.useEffect(() => {
    if (readOnly) {
      setEditingMessageIndex(null);
      setEditingNoteIndex(null);
      setExpandedNotePanelIndex(null);
    }
  }, [readOnly]);

  React.useEffect(() => {
    setExpandedNotePanelIndex((prev) => {
      if (prev === null) return prev;
      return prev < turns.length ? prev : null;
    });
  }, [turns.length]);

  const beginEditMessage = (index: number) => {
    setEditingMessageIndex(index);
    setEditingNoteIndex(null);
  };

  const beginEditNote = (index: number) => {
    setEditingNoteIndex(index);
    setEditingMessageIndex(null);
  };

  /** Drop empty placeholder notes when closing panel or canceling a fresh note. */
  const stripEmptyPlaceholderNote = React.useCallback(
    (index: number) => {
      const t = turns[index];
      if (!t || t.designerNote === undefined) return;
      if (t.designerNote.trim() === '') {
        onTurnsChange(replaceTurn(turns, index, { designerNote: undefined }));
      }
    },
    [onTurnsChange, turns]
  );

  const collapseNotePanel = (index: number) => {
    if (editingNoteIndex === index) {
      setEditingNoteIndex(null);
    }
    stripEmptyPlaceholderNote(index);
    setExpandedNotePanelIndex(null);
  };

  const expandNotePanel = (index: number) => {
    const turn = turns[index];
    if (turn.designerNote === undefined) {
      onTurnsChange(replaceTurn(turns, index, { designerNote: '' }));
      setEditingNoteIndex(index);
    }
    setExpandedNotePanelIndex(index);
    setEditingMessageIndex(null);
  };

  const toggleNotePanel = (index: number) => {
    if (expandedNotePanelIndex === index) {
      collapseNotePanel(index);
    } else {
      expandNotePanel(index);
    }
  };

  const deleteNote = (index: number) => {
    onTurnsChange(replaceTurn(turns, index, { designerNote: undefined }));
    if (editingNoteIndex === index) setEditingNoteIndex(null);
    if (expandedNotePanelIndex === index) setExpandedNotePanelIndex(null);
  };

  const runToolbarConfirm = () => {
    if (editingMessageIndex !== null) messageToolbarRef.current?.confirm();
    else if (editingNoteIndex !== null) noteToolbarRef.current?.confirm();
  };

  const runToolbarCancel = () => {
    if (editingMessageIndex !== null) messageToolbarRef.current?.cancel();
    else if (editingNoteIndex !== null) noteToolbarRef.current?.cancel();
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {!hideStyleSelector ? (
        <div className="flex items-center gap-2 mb-2 shrink-0">
          <label htmlFor="ai-agent-preview-style" className="text-xs text-slate-500 whitespace-nowrap">
            Stile
          </label>
          <select
            id="ai-agent-preview-style"
            value={selectedStyleId}
            onChange={(e) => onStyleIdChange(e.target.value)}
            disabled={readOnly}
            className="flex-1 min-w-0 rounded-md bg-slate-900 border border-slate-600 px-2 py-1.5 text-sm text-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {AI_AGENT_PREVIEW_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {turns.length === 0 ? (
        <div className="flex-1 min-h-0">{emptyPlaceholder}</div>
      ) : (
        <div
          className={
            flushMessagesArea
              ? 'flex-1 min-h-0 bg-slate-950/50 p-3 space-y-3 overflow-y-auto'
              : 'flex-1 min-h-0 rounded-md border border-slate-800 bg-slate-950/50 p-3 space-y-3 overflow-y-auto'
          }
        >
          {turns.map((turn, i) => {
            const isAssistant = turn.role === 'assistant';
            const isEditingMessage = editingMessageIndex === i;
            const isEditingNote = editingNoteIndex === i;
            const hasNote = hasSavedNoteText(turn);
            const showInteractiveNotePanel = isAssistant && !readOnly && expandedNotePanelIndex === i;
            const showReadOnlyNotePanel = isAssistant && readOnly && hasNote;
            const rowToolbarPinned = isEditingMessage || isEditingNote;

            return (
              <div key={i} className="space-y-1">
                {isAssistant ? (
                  <div
                    className={`group relative text-sm rounded-lg px-3 py-2 border mr-2 bg-violet-950/50 border-violet-800/70 ${
                      isEditingMessage ? 'ring-2 ring-violet-500' : ''
                    }`}
                  >
                    {!readOnly ? (
                      <div
                        className={`absolute top-1 right-1 z-10 flex gap-0.5 items-center transition-opacity ${
                          rowToolbarPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {rowToolbarPinned ? (
                          <>
                            <button
                              type="button"
                              title="Conferma"
                              aria-label="Conferma"
                              onClick={runToolbarConfirm}
                              className="p-1 rounded bg-slate-900/90 border border-slate-600 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              title="Annulla"
                              aria-label="Annulla"
                              onClick={runToolbarCancel}
                              className="p-1 rounded bg-slate-900/90 border border-slate-600 text-red-400 hover:text-red-300 hover:bg-slate-800"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : null}
                        {!isEditingMessage && !isEditingNote ? (
                          <button
                            type="button"
                            title="Modifica messaggio"
                            onClick={() => beginEditMessage(i)}
                            className="p-1 rounded bg-slate-900/90 border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800"
                          >
                            <Pencil size={14} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          title={
                            expandedNotePanelIndex === i
                              ? 'Chiudi nota'
                              : hasNote
                                ? 'Mostra nota'
                                : 'Aggiungi nota'
                          }
                          aria-expanded={expandedNotePanelIndex === i}
                          onClick={() => toggleNotePanel(i)}
                          className={`p-1 rounded bg-slate-900/90 border ${
                            hasNote
                              ? 'border-amber-500/60 text-amber-400 hover:text-amber-300 hover:bg-slate-800'
                              : 'border-slate-600 text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <StickyNote size={14} />
                        </button>
                      </div>
                    ) : null}
                    <span className="text-[10px] uppercase tracking-wide text-violet-400/80 block mb-0.5">Agente</span>
                    {isEditingMessage ? (
                      <div className="w-full min-w-0 pt-0.5">
                        <EditableText
                          value={turn.content}
                          editing
                          onSave={(trimmed) => {
                            onTurnsChange(replaceTurn(turns, i, { content: trimmed }));
                            setEditingMessageIndex(null);
                          }}
                          onCancel={() => setEditingMessageIndex(null)}
                          showActionButtons={false}
                          toolbarApiRef={messageToolbarRef}
                          enableVoice={false}
                          multiline
                          showLanguageWarning={false}
                          expectedLanguage="it"
                          displayMode="text"
                          placeholder="Messaggio agente…"
                          style={AGENT_EDITABLE_TEXT_STYLE}
                          className="text-sm"
                        />
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap pr-1">{turn.content}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm rounded-lg px-3 py-2 bg-slate-800/80 border border-slate-700 ml-6">
                    <span className="text-[10px] uppercase tracking-wide text-slate-500 block mb-0.5">Utente</span>
                    <div className="whitespace-pre-wrap">{turn.content}</div>
                  </div>
                )}

                {showReadOnlyNotePanel ? (
                  <div className="relative ml-1 mr-2 pl-3 border-l-2 border-amber-700/60">
                    <span className="text-[10px] uppercase tracking-wide text-amber-600/90 block mb-0.5">Nota</span>
                    <p className="text-xs text-amber-100/80 whitespace-pre-wrap pr-2">{turn.designerNote}</p>
                  </div>
                ) : null}

                {showInteractiveNotePanel ? (
                  <div
                    className={`group/note relative ml-1 mr-2 pl-3 border-l-2 border-amber-700/60 ${
                      isEditingNote ? 'ring-1 ring-amber-600/50 rounded-r' : ''
                    }`}
                  >
                    {!readOnly ? (
                      <div className="absolute top-0.5 right-0 z-10 flex gap-0.5 opacity-0 group-hover/note:opacity-100 transition-opacity">
                        {!isEditingNote ? (
                          <button
                            type="button"
                            title="Modifica nota"
                            onClick={() => beginEditNote(i)}
                            className="p-1 rounded bg-slate-900/90 border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800"
                          >
                            <Pencil size={14} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          title="Elimina nota"
                          onClick={() => deleteNote(i)}
                          className="p-1 rounded bg-slate-900/90 border border-slate-600 text-slate-300 hover:text-red-300 hover:bg-slate-800"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : null}
                    <span className="text-[10px] uppercase tracking-wide text-amber-600/90 block mb-0.5">Nota</span>
                    {isEditingNote ? (
                      <div className="w-full min-w-0 pt-0.5">
                        <EditableText
                          value={turn.designerNote ?? ''}
                          editing
                          onSave={(trimmed) => {
                            onTurnsChange(
                              replaceTurn(turns, i, {
                                designerNote: trimmed.length > 0 ? trimmed : undefined,
                              })
                            );
                            setEditingNoteIndex(null);
                          }}
                          onCancel={() => {
                            setEditingNoteIndex(null);
                            stripEmptyPlaceholderNote(i);
                          }}
                          showActionButtons={false}
                          toolbarApiRef={noteToolbarRef}
                          enableVoice={false}
                          multiline
                          showLanguageWarning={false}
                          expectedLanguage="it"
                          displayMode="text"
                          placeholder="Istruzioni per questo turno…"
                          style={NOTE_EDITABLE_TEXT_STYLE}
                          className="text-xs"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-amber-100/80 whitespace-pre-wrap pr-8">
                        {hasNote ? (
                          turn.designerNote
                        ) : (
                          <span className="text-slate-500 italic">(nota vuota)</span>
                        )}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
