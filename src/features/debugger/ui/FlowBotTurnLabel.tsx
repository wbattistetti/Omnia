/**
 * Messaggio bot in flow mode: icona + testo; hover → matita per aprire l’editor traduzione (se c’è textKey).
 * Errori di compilazione con `compilationFixError`: pulsante Fix come nel debugger Run.
 */
import React from 'react';
import { Bot, Pencil } from 'lucide-react';
import { executeNavigationIntent, resolveNavigationIntent } from '@domain/compileErrors';
import { getStepIcon } from '@responseEditor/ChatSimulator/chatSimulatorUtils';
import type { Message } from '@components/ChatSimulator/UserMessage';

export function FlowBotTurnLabel(props: {
  message: Message;
  onEditTranslation: (messageId: string, currentText: string) => void;
}) {
  const { message, onEditTranslation } = props;
  const text = String(message.text || '').trim() || '(vuoto)';
  const canEdit = Boolean(message.textKey);
  const hasFix = Boolean(message.compilationFixError);

  const onCompilationFix = React.useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const err = message.compilationFixError;
      if (!err) return;
      try {
        await executeNavigationIntent(resolveNavigationIntent(err));
      } catch (errx) {
        console.error('[FlowBotTurnLabel] Fix navigation failed:', errx);
      }
    },
    [message.compilationFixError]
  );

  const bubbleTone =
    hasFix || message.stepType === 'error'
      ? 'border-amber-500/50 bg-amber-950/40 text-amber-50 dark:border-amber-500/45 dark:bg-amber-950/35'
      : canEdit
        ? 'border-slate-200 bg-slate-50 hover:bg-slate-100/90 text-slate-900 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800'
        : 'border-slate-100 bg-slate-50/60 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200';

  return (
    <div
      className={`group flex items-start gap-2 w-full max-w-xs lg:max-w-md xl:max-w-xl rounded-lg border px-3 py-2 text-sm transition-colors ${bubbleTone}`}
    >
      <Bot size={16} className="text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" aria-hidden />
      {message.stepType ? (
        <span className="shrink-0 mt-0.5 [&_svg]:text-amber-500">
          {getStepIcon(message.stepType, message.color)}
        </span>
      ) : null}
      <span className="flex-1 min-w-0 whitespace-pre-line break-words">{text}</span>
      <div className="flex items-start gap-1 shrink-0 mt-0.5 flex-wrap justify-end">
        {hasFix ? (
          <button
            type="button"
            onClick={onCompilationFix}
            className="text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-md bg-gray-900 text-white hover:bg-gray-800 dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            Fix
          </button>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            className="shrink-0 p-1 rounded text-slate-600 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-700 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto focus:outline-none focus:ring-2 focus:ring-purple-400"
            title="Modifica traduzione"
            aria-label="Modifica traduzione"
            onClick={() => onEditTranslation(message.id, message.text)}
          >
            <Pencil size={14} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
