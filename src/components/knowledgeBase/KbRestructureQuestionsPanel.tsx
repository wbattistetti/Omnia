/**
 * Domande IA su ambiguità strutturali: ogni domanda è un accordion con risposta interna.
 */

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { KbRestructureClarificationQuestion } from '@domain/knowledgeBase/kbDocumentRestructureWorkflow';
import {
  KB_RESTRUCTURE_QUESTIONS_EMPTY,
  KB_RESTRUCTURE_QUESTIONS_TITLE,
} from '@domain/knowledgeBase/kbDocumentRestructureGuide';
import { KbAutoGrowTextarea } from './KbAutoGrowTextarea';

const QUESTION_ANSWER_MAX_ROWS = 10;

export type KbRestructureQuestionsPanelProps = {
  questions: readonly KbRestructureClarificationQuestion[];
  disabled?: boolean;
  onAnswerChange: (questionId: string, answer: string) => void;
  onAnswerBlur: (questionId: string, answer: string) => void;
};

export type KbRestructureQuestionsPanelHandle = {
  /** Scroll alla domanda, apre l'accordion e mette focus sulla textarea. */
  focusQuestion: (questionId: string) => boolean;
};

function unansweredQuestionIds(
  questions: readonly KbRestructureClarificationQuestion[]
): Set<string> {
  return new Set(
    questions.filter((q) => !q.answer?.trim()).map((q) => q.id)
  );
}

type KbRestructureQuestionAccordionProps = {
  question: KbRestructureClarificationQuestion;
  open: boolean;
  disabled: boolean;
  onToggle: () => void;
  onAnswerChange: (answer: string) => void;
  onAnswerBlur: (answer: string) => void;
  itemRef: (node: HTMLLIElement | null) => void;
  textareaRef: (node: HTMLTextAreaElement | null) => void;
};

function KbRestructureQuestionAccordion({
  question,
  open,
  disabled,
  onToggle,
  onAnswerChange,
  onAnswerBlur,
  itemRef,
  textareaRef,
}: KbRestructureQuestionAccordionProps): React.ReactElement {
  const unanswered = !question.answer?.trim();

  return (
    <li
      ref={itemRef}
      data-kb-restructure-question-id={question.id}
      className={
        'rounded border ' +
        (unanswered
          ? 'border-amber-600/50 bg-slate-950/40'
          : 'border-amber-900/30 bg-slate-950/40')
      }
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-start gap-1.5 px-2 py-1.5 text-left hover:bg-slate-900/40"
      >
        {open ? (
          <ChevronDown size={14} className="mt-0.5 shrink-0 text-amber-400/80" aria-hidden />
        ) : (
          <ChevronRight size={14} className="mt-0.5 shrink-0 text-amber-400/80" aria-hidden />
        )}
        <span className="min-w-0 flex-1 text-xs leading-snug text-amber-100/95">
          {question.text}
        </span>
        {unanswered ? (
          <span className="shrink-0 rounded bg-amber-950/80 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-300/90">
            Obbligatoria
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="space-y-1.5 border-t border-amber-900/30 px-2 pb-2 pt-1.5">
          {question.relatedRowKeys?.length ? (
            <p className="text-[10px] text-slate-500">
              Righe: {question.relatedRowKeys.join(', ')}
            </p>
          ) : null}
          <KbAutoGrowTextarea
            ref={textareaRef}
            maxRows={QUESTION_ANSWER_MAX_ROWS}
            className={
              'w-full rounded border bg-slate-950/80 px-1.5 py-1 text-[11px] leading-snug text-slate-200 placeholder:text-slate-600 focus:outline-none ' +
              (unanswered
                ? 'border-amber-700/70 focus:border-amber-500/70'
                : 'border-slate-700/80 focus:border-amber-600/60')
            }
            placeholder={unanswered ? 'Risposta obbligatoria…' : 'Risposta…'}
            value={question.answer ?? ''}
            disabled={disabled}
            onChange={(e) => onAnswerChange(e.target.value)}
            onBlur={(e) => onAnswerBlur(e.target.value)}
            aria-label={`Risposta: ${question.text}`}
            aria-required={unanswered}
          />
        </div>
      ) : null}
    </li>
  );
}

export const KbRestructureQuestionsPanel = React.forwardRef<
  KbRestructureQuestionsPanelHandle,
  KbRestructureQuestionsPanelProps
>(function KbRestructureQuestionsPanel(
  { questions, disabled = false, onAnswerChange, onAnswerBlur },
  ref
) {
  const itemRefs = React.useRef(new Map<string, HTMLLIElement>());
  const textareaRefs = React.useRef(new Map<string, HTMLTextAreaElement>());
  const [openIds, setOpenIds] = React.useState<Set<string>>(() =>
    unansweredQuestionIds(questions)
  );

  React.useEffect(() => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      for (const q of questions) {
        if (!q.answer?.trim()) next.add(q.id);
      }
      return next;
    });
  }, [questions]);

  const toggleQuestion = React.useCallback((questionId: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      focusQuestion(questionId: string) {
        const item = itemRefs.current.get(questionId);
        if (!item) return false;

        setOpenIds((prev) => new Set([...prev, questionId]));
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const tryFocus = (attempt = 0) => {
          const textarea = textareaRefs.current.get(questionId);
          if (textarea) {
            textarea.focus({ preventScroll: true });
            return;
          }
          if (attempt < 10) {
            window.setTimeout(() => tryFocus(attempt + 1), 40);
          }
        };
        window.setTimeout(() => tryFocus(), 0);
        return true;
      },
    }),
    []
  );

  if (questions.length === 0) return null;

  return (
    <section className="shrink-0 rounded border border-amber-900/50 bg-amber-950/20 px-2 py-2">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200/90">
        {KB_RESTRUCTURE_QUESTIONS_TITLE}
      </h3>
      <ul className="space-y-1.5">
        {questions.map((q) => (
          <KbRestructureQuestionAccordion
            key={q.id}
            question={q}
            open={openIds.has(q.id)}
            disabled={disabled}
            onToggle={() => toggleQuestion(q.id)}
            onAnswerChange={(answer) => onAnswerChange(q.id, answer)}
            onAnswerBlur={(answer) => onAnswerBlur(q.id, answer)}
            itemRef={(node) => {
              if (node) itemRefs.current.set(q.id, node);
              else itemRefs.current.delete(q.id);
            }}
            textareaRef={(node) => {
              if (node) textareaRefs.current.set(q.id, node);
              else textareaRefs.current.delete(q.id);
            }}
          />
        ))}
      </ul>
    </section>
  );
});

KbRestructureQuestionsPanel.displayName = 'KbRestructureQuestionsPanel';

export function KbRestructureQuestionsEmptyHint(): React.ReactElement | null {
  return (
    <p className="shrink-0 text-[10px] text-slate-600">{KB_RESTRUCTURE_QUESTIONS_EMPTY}</p>
  );
}
