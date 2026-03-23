/**
 * Design-time simulated chat: style selector, agent bubble toolbars (edit / note),
 * note block toolbars (edit / delete).
 */
import React from 'react';
import type { AIAgentPreviewTurn } from '@types/aiAgentPreview';
import { AI_AGENT_PREVIEW_STYLES } from '@types/aiAgentPreview';
import { Pencil, StickyNote, Trash2 } from 'lucide-react';

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
}

function replaceTurn(turns: AIAgentPreviewTurn[], index: number, patch: Partial<AIAgentPreviewTurn>) {
  return turns.map((t, i) => (i === index ? { ...t, ...patch } : t));
}

export function AIAgentPreviewChatPanel({
  selectedStyleId,
  onStyleIdChange,
  turns,
  onTurnsChange,
  emptyPlaceholder,
  readOnly = false,
  hideStyleSelector = false,
}: AIAgentPreviewChatPanelProps) {
  const [editingMessageIndex, setEditingMessageIndex] = React.useState<number | null>(null);
  const [editingNoteIndex, setEditingNoteIndex] = React.useState<number | null>(null);
  const [draftText, setDraftText] = React.useState('');

  React.useEffect(() => {
    if (readOnly) {
      setEditingMessageIndex(null);
      setEditingNoteIndex(null);
    }
  }, [readOnly]);

  const beginEditMessage = (index: number) => {
    setEditingMessageIndex(index);
    setDraftText(turns[index]?.content ?? '');
    setEditingNoteIndex(null);
  };

  const saveEditMessage = () => {
    if (editingMessageIndex === null) return;
    onTurnsChange(replaceTurn(turns, editingMessageIndex, { content: draftText }));
    setEditingMessageIndex(null);
  };

  const cancelEditMessage = () => {
    setEditingMessageIndex(null);
  };

  const beginEditNote = (index: number) => {
    setEditingNoteIndex(index);
    setDraftText(turns[index]?.designerNote ?? '');
    setEditingMessageIndex(null);
  };

  const saveEditNote = () => {
    if (editingNoteIndex === null) return;
    const trimmed = draftText.trim();
    onTurnsChange(
      replaceTurn(turns, editingNoteIndex, {
        designerNote: trimmed.length > 0 ? trimmed : undefined,
      })
    );
    setEditingNoteIndex(null);
  };

  const cancelEditNote = () => {
    setEditingNoteIndex(null);
  };

  const addNote = (index: number) => {
    onTurnsChange(replaceTurn(turns, index, { designerNote: '' }));
    setEditingNoteIndex(index);
    setDraftText('');
    setEditingMessageIndex(null);
  };

  const deleteNote = (index: number) => {
    onTurnsChange(replaceTurn(turns, index, { designerNote: undefined }));
    if (editingNoteIndex === index) setEditingNoteIndex(null);
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
        <div className="flex-1 min-h-0 rounded-md border border-slate-800 bg-slate-950/50 p-3 space-y-3 overflow-y-auto">
          {turns.map((turn, i) => {
            const isAssistant = turn.role === 'assistant';
            const isEditingMessage = editingMessageIndex === i;
            const isEditingNote = editingNoteIndex === i;
            const hasNote = turn.designerNote !== undefined && turn.designerNote !== '';

            return (
              <div key={i} className="space-y-1">
                {isAssistant ? (
                  <div
                    className={`group relative text-sm rounded-lg px-3 py-2 border mr-6 bg-violet-950/50 border-violet-800/70 ${
                      isEditingMessage ? 'ring-2 ring-violet-500' : ''
                    }`}
                  >
                    {!readOnly ? (
                      <div className="absolute top-1 right-1 z-10 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          title="Modifica messaggio"
                          onClick={() => beginEditMessage(i)}
                          className="p-1 rounded bg-slate-900/90 border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          title={turn.designerNote !== undefined ? 'Modifica nota' : 'Aggiungi nota'}
                          onClick={() =>
                            turn.designerNote !== undefined ? beginEditNote(i) : addNote(i)
                          }
                          className="p-1 rounded bg-slate-900/90 border border-slate-600 text-slate-300 hover:text-amber-200 hover:bg-slate-800"
                        >
                          <StickyNote size={14} />
                        </button>
                      </div>
                    ) : null}
                    <span className="text-[10px] uppercase tracking-wide text-violet-400/80 block mb-0.5">Agente</span>
                    {isEditingMessage ? (
                      <div className="space-y-2 pr-6">
                        <textarea
                          value={draftText}
                          onChange={(e) => setDraftText(e.target.value)}
                          className="w-full min-h-[72px] rounded bg-slate-950 border border-slate-600 px-2 py-1 text-sm text-slate-100"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={saveEditMessage}
                            className="px-2 py-1 text-xs rounded bg-violet-600 hover:bg-violet-500"
                          >
                            Salva
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditMessage}
                            className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600"
                          >
                            Annulla
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pr-8 whitespace-pre-wrap">{turn.content}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm rounded-lg px-3 py-2 bg-slate-800/80 border border-slate-700 ml-6">
                    <span className="text-[10px] uppercase tracking-wide text-slate-500 block mb-0.5">Utente</span>
                    <div className="whitespace-pre-wrap">{turn.content}</div>
                  </div>
                )}

                {isAssistant && turn.designerNote !== undefined ? (
                  <div
                    className={`group/note relative ml-1 mr-6 pl-3 border-l-2 border-amber-700/60 ${
                      isEditingNote ? 'ring-1 ring-amber-600/50 rounded-r' : ''
                    }`}
                  >
                    {!readOnly ? (
                      <div className="absolute top-0.5 right-0 z-10 flex gap-0.5 opacity-0 group-hover/note:opacity-100 transition-opacity">
                        <button
                          type="button"
                          title="Modifica nota"
                          onClick={() => beginEditNote(i)}
                          className="p-1 rounded bg-slate-900/90 border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800"
                        >
                          <Pencil size={14} />
                        </button>
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
                      <div className="space-y-2 pr-8">
                        <textarea
                          value={draftText}
                          onChange={(e) => setDraftText(e.target.value)}
                          placeholder="Istruzioni per questo turno…"
                          className="w-full min-h-[64px] rounded bg-slate-950 border border-slate-600 px-2 py-1 text-xs text-amber-100/90"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={saveEditNote}
                            className="px-2 py-1 text-xs rounded bg-amber-700 hover:bg-amber-600"
                          >
                            Salva nota
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (turn.designerNote === '' && !draftText.trim()) {
                                deleteNote(i);
                              }
                              cancelEditNote();
                            }}
                            className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600"
                          >
                            Annulla
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-100/80 whitespace-pre-wrap pr-8">
                        {hasNote ? turn.designerNote : <span className="text-slate-500 italic">(nota vuota)</span>}
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
