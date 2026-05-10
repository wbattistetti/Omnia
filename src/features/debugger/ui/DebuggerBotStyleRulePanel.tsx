/**
 * Flow debugger: esempio di battuta corretta (prefill da analisi IA) e passaggio al Task Editor per raffinare motor / JSON sul tab Use case.
 */

import React from 'react';
import { X } from 'lucide-react';
import { taskRepository } from '@services/TaskRepository';
import { TaskType, templateIdToTaskType } from '@types/taskTypes';

export function DebuggerBotStyleRulePanel(props: {
  sourceTaskId: string;
  /** Prefill da analyze-debug-turn (`correct_assistant_reply_it`). */
  prefillCorrectReply?: string | null;
  onClose?: () => void;
  /** Apre Task Editor sul tab Use case (parent imposta sessionStorage UC se serve). */
  onFixInTaskEditor: () => void;
  /**
   * Contenuto solo: il genitore (`FlowBotTurnLabel`) applica bordo/vetro unico sulla task box espansa.
   */
  embedded?: boolean;
}) {
  const { sourceTaskId, prefillCorrectReply, onClose, embedded, onFixInTaskEditor } = props;
  const [desiredText, setDesiredText] = React.useState('');
  const desiredRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    setDesiredText('');
  }, [sourceTaskId]);

  React.useEffect(() => {
    const p = typeof prefillCorrectReply === 'string' ? prefillCorrectReply.trim() : '';
    if (p.length > 0) {
      setDesiredText(p);
    }
  }, [prefillCorrectReply]);

  const syncTextareaHeight = React.useCallback(() => {
    const el = desiredRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(72, el.scrollHeight)}px`;
  }, []);

  React.useLayoutEffect(() => {
    syncTextareaHeight();
  }, [desiredText, syncTextareaHeight]);

  React.useEffect(() => {
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => syncTextareaHeight());
    });
    const p = desiredRef.current?.parentElement;
    if (p) ro.observe(p);
    return () => ro.disconnect();
  }, [syncTextareaHeight]);

  const task = taskRepository.getTask(sourceTaskId.trim());
  const isAiAgent =
    task != null &&
    (task.type === TaskType.AIAgent || templateIdToTaskType(task.templateId) === TaskType.AIAgent);

  if (!isAiAgent || !sourceTaskId.trim()) {
    return null;
  }

  const body = (
    <div
      className={
        embedded
          ? 'space-y-2 border-t border-sky-400/25 px-3 pb-2 pt-2 text-left dark:border-sky-500/25'
          : 'space-y-3 px-2.5 pb-2.5 pt-2'
      }
    >
      <div>
        <div className="mb-1 flex min-h-[1.5rem] items-center justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:text-sky-200/80">
            Esempio di risposta corretta
          </span>
          <button
            type="button"
            onClick={() => onFixInTaskEditor()}
            className="shrink-0 rounded-md bg-violet-700 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-violet-600 dark:bg-violet-700 dark:hover:bg-violet-600"
          >
            Correggi nel Task Editor
          </button>
        </div>
        <textarea
          ref={desiredRef}
          className="block min-h-[72px] w-full resize-none overflow-hidden whitespace-pre-wrap break-words rounded-md border border-sky-300/50 bg-white/85 px-2 py-1.5 text-xs leading-snug text-slate-900 placeholder:text-slate-400 dark:border-sky-600/40 dark:bg-slate-950/60 dark:text-sky-50 dark:placeholder:text-slate-500"
          value={desiredText}
          onChange={(e) => setDesiredText(e.target.value)}
          placeholder="Qui compare il suggerimento dall’analisi; affina motor e JSON nell’editor AI Agent (tab Use case)."
          rows={1}
        />
      </div>
    </div>
  );

  if (embedded) {
    return body;
  }

  return (
    <div
      className={[
        'mt-1 w-full max-w-xs lg:max-w-md xl:max-w-xl overflow-hidden rounded-lg',
        'border border-sky-400/60 bg-sky-500/[0.07] shadow-inner',
        'dark:border-sky-500/45 dark:bg-sky-950/[0.38]',
        'backdrop-blur-md supports-[backdrop-filter]:bg-sky-500/[0.06] dark:supports-[backdrop-filter]:bg-sky-950/30',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2 border-b border-sky-400/25 px-2 py-1.5 dark:border-sky-500/25">
        <span className="text-xs font-semibold text-slate-700 dark:text-sky-100/95">
          Allinea use case (AI Agent)
        </span>
        {onClose ? (
          <button
            type="button"
            className="shrink-0 rounded p-1 text-slate-600 hover:bg-sky-900/20 dark:text-sky-200/90 dark:hover:bg-sky-900/40"
            aria-label="Chiudi"
            onClick={onClose}
          >
            <X size={14} aria-hidden />
          </button>
        ) : null}
      </div>
      {body}
    </div>
  );
}
