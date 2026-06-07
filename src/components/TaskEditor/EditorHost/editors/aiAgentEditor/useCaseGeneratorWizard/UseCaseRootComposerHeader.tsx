/**
 * Fascia in cima alla lista use case: input utente + CTA IA, oppure banner di progresso bundle.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { formatUseCaseBundleProgressBanner } from '@domain/aiAgentUseCase/useCaseBundleChunkConfig';
import {
  LABEL_ANALYZE_AND_CREATE_USE_CASES,
  LABEL_GENERATE_KB_DIALOG_USE_CASES,
  LABEL_GENERATING_KB_DIALOG_USE_CASES,
} from '../constants';
import { UseCaseBundleGenerateButton } from './UseCaseBundleGenerateButton';

export type UseCaseRootComposerHeaderProps = {
  rootDraftRef: React.RefObject<HTMLTextAreaElement | null>;
  rootDraftLabel: string;
  onRootDraftChange: (value: string) => void;
  onRootDraftBlur: () => void;
  onRootDraftPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onRootDraftKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  rootComposerLocked: boolean;
  placeholder: string;
  showAnalyzeChip: boolean;
  rootChipBusy: boolean;
  rootChipLabel: string;
  onAnalyzeClick: () => void;
  rootBatchWarning: string | null;
  bundleGenerateBusy: boolean;
  bundleGenerationCount: number | null;
  bundleGenerationOrdering: boolean;
  bundleGenerationCategorizing?: boolean;
  onGenerateUseCaseBundle?: () => void | Promise<void>;
  onGenerateKbDialogUseCases?: () => void | Promise<void>;
  kbDeterministicMode?: boolean;
  kbDialogGenerateBusy?: boolean;
  generating?: boolean;
  hasExistingUseCases: boolean;
};

export function UseCaseRootComposerHeader({
  rootDraftRef,
  rootDraftLabel,
  onRootDraftChange,
  onRootDraftBlur,
  onRootDraftPaste,
  onRootDraftKeyDown,
  rootComposerLocked,
  placeholder,
  showAnalyzeChip,
  rootChipBusy,
  rootChipLabel,
  onAnalyzeClick,
  rootBatchWarning,
  bundleGenerateBusy,
  bundleGenerationCount,
  bundleGenerationOrdering,
  bundleGenerationCategorizing = false,
  onGenerateUseCaseBundle,
  onGenerateKbDialogUseCases,
  kbDeterministicMode = false,
  kbDialogGenerateBusy = false,
  generating = false,
  hasExistingUseCases,
}: UseCaseRootComposerHeaderProps): React.ReactElement {
  const bundleBusy = generating || bundleGenerateBusy;
  const progressMessage = formatUseCaseBundleProgressBanner(
    bundleGenerationCount,
    bundleGenerationOrdering,
    bundleGenerationCategorizing
  );

  if (bundleBusy) {
    return (
      <div
        className="shrink-0 border-b border-violet-500/30 bg-gradient-to-b from-violet-950/40 to-slate-950/30 px-3 py-4 sm:px-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex items-start gap-3">
          <Loader2
            className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-violet-300"
            aria-hidden
          />
          <p className="text-sm font-medium leading-relaxed text-violet-100/95 sm:text-base">
            {progressMessage}
          </p>
        </div>
      </div>
    );
  }

  const canGenerateBundle = typeof onGenerateUseCaseBundle === 'function';
  const canGenerateKb = kbDeterministicMode && typeof onGenerateKbDialogUseCases === 'function';

  return (
    <div className="shrink-0 border-b border-slate-700/50 px-2 pt-2 pb-2 sm:px-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <textarea
          ref={rootDraftRef}
          rows={1}
          value={rootDraftLabel}
          onChange={(e) => onRootDraftChange(e.target.value)}
          onBlur={onRootDraftBlur}
          onPaste={onRootDraftPaste}
          onKeyDown={onRootDraftKeyDown}
          disabled={rootComposerLocked}
          placeholder={placeholder}
          className="min-h-[52px] min-w-0 flex-1 resize-none overflow-hidden rounded-md border-2 border-sky-400/60 bg-slate-900/95 px-2.5 py-2 text-xs text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-300/95 focus:border-sky-300/80 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60 sm:text-sm"
        />
        {canGenerateKb ? (
          <button
            type="button"
            disabled={rootComposerLocked || generating || kbDialogGenerateBusy}
            aria-busy={kbDialogGenerateBusy}
            onClick={() => void onGenerateKbDialogUseCases?.()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-950/50 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-0.5"
          >
            {kbDialogGenerateBusy ? (
              <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden />
            ) : null}
            {kbDialogGenerateBusy ? LABEL_GENERATING_KB_DIALOG_USE_CASES : LABEL_GENERATE_KB_DIALOG_USE_CASES}
          </button>
        ) : null}
        {canGenerateBundle && !kbDeterministicMode ? (
          <UseCaseBundleGenerateButton
            generateBusy={false}
            onGenerate={onGenerateUseCaseBundle}
            hasExistingUseCases={hasExistingUseCases}
            layout="inline"
            accentTone="sky"
            className="sm:mt-0.5"
          />
        ) : null}
      </div>
      {showAnalyzeChip ? (
        <div className="flex justify-end pt-0.5">
          <button
            type="button"
            disabled={rootComposerLocked}
            onClick={onAnalyzeClick}
            aria-busy={rootChipBusy}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              rootChipBusy
                ? 'bg-emerald-500/30 text-emerald-50 ring-emerald-400/55'
                : 'bg-emerald-600/35 text-emerald-50 ring-emerald-400/50 hover:bg-emerald-500/45'
            }`}
          >
            {rootChipBusy ? (
              <Loader2 size={12} className="shrink-0 animate-spin" aria-hidden />
            ) : null}
            <span className="text-left leading-snug">
              {rootChipBusy ? rootChipLabel : LABEL_ANALYZE_AND_CREATE_USE_CASES}
            </span>
          </button>
        </div>
      ) : null}
      {rootBatchWarning ? (
        <p className="text-[11px] text-amber-300/95">{rootBatchWarning}</p>
      ) : null}
    </div>
  );
}
