/**
 * Messaggio bot in flow mode: icona + testo; hover → matita per aprire l’editor traduzione (se c’è textKey).
 */
import { Bot, Pencil } from 'lucide-react';
import type { Message } from '@components/ChatSimulator/UserMessage';

export function FlowBotTurnLabel(props: {
  message: Message;
  onEditTranslation: (messageId: string, currentText: string) => void;
}) {
  const { message, onEditTranslation } = props;
  const text = String(message.text || '').trim() || '(vuoto)';
  const canEdit = Boolean(message.textKey);

  return (
    <div
      className={`group flex items-start gap-2 w-full max-w-xs lg:max-w-md rounded-lg border px-3 py-2 text-sm transition-colors ${
        canEdit
          ? 'border-slate-200 bg-slate-50 hover:bg-slate-100/90 text-slate-900'
          : 'border-slate-100 bg-slate-50/60 text-slate-700'
      }`}
    >
      <Bot size={16} className="text-slate-600 shrink-0 mt-0.5" aria-hidden />
      <span className="flex-1 min-w-0 break-words">{text}</span>
      {canEdit ? (
        <button
          type="button"
          className="shrink-0 p-1 rounded text-slate-600 hover:bg-slate-200/80 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto focus:outline-none focus:ring-2 focus:ring-purple-400"
          title="Modifica traduzione"
          aria-label="Modifica traduzione"
          onClick={() => onEditTranslation(message.id, message.text)}
        >
          <Pencil size={14} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
