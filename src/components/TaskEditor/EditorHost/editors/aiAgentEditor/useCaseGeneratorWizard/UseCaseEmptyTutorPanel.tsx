/**
 * Empty use-case list: tutor layout with mascot, optional paste area, and generate CTA.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { formatUseCaseBundleProgressBanner } from '@domain/aiAgentUseCase/useCaseBundleChunkConfig';
import { useAiBusyLabel } from '@hooks/useAiBusyLabel';
import { MissingAiModelToast } from '@components/common/MissingAiModelToast';
import {
  LABEL_EMPTY_USE_CASE_CLICK_HERE,
  LABEL_EMPTY_USE_CASE_TUTOR_HEADLINE,
  LABEL_GENERATE_USE_CASES,
  PLACEHOLDER_EMPTY_USE_CASE_DRAFT,
} from '../constants';
import { OMNIA_ROBOT_MASCOT_3D } from './useCaseMascotAssets';

const INTRO_LINK_CLS =
  'font-semibold text-violet-200 underline decoration-violet-400/55 underline-offset-[3px] transition-colors hover:text-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:cursor-not-allowed disabled:opacity-50';

export type UseCaseEmptyTutorPanelProps = {
  rootDraftRef: React.RefObject<HTMLTextAreaElement | null>;
  rootDraftLabel: string;
  onRootDraftChange: (value: string) => void;
  onRootDraftBlur: () => void;
  onRootDraftPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onRootDraftKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  rootComposerLocked: boolean;
  showAnalyzeChip: boolean;
  rootChipBusy: boolean;
  rootChipLabel: string;
  onAnalyzeClick: () => void;
  rootBatchWarning: string | null;
  onGenerateFromScratch?: () => void | Promise<void>;
  generating?: boolean;
  bundleGenerateBusy?: boolean;
  bundleGenerationCount?: number | null;
  bundleGenerationOrdering?: boolean;
  bundleGenerationCategorizing?: boolean;
};

export function UseCaseEmptyTutorPanel({
  rootDraftRef,
  rootDraftLabel,
  onRootDraftChange,
  onRootDraftBlur,
  onRootDraftPaste,
  onRootDraftKeyDown,
  rootComposerLocked,
  showAnalyzeChip,
  rootChipBusy,
  rootChipLabel,
  onAnalyzeClick,
  rootBatchWarning,
  onGenerateFromScratch,
  generating = false,
  bundleGenerateBusy = false,
  bundleGenerationCount = null,
  bundleGenerationOrdering = false,
  bundleGenerationCategorizing = false,
}: UseCaseEmptyTutorPanelProps): React.ReactElement {
  const { hasModel } = useAiBusyLabel();
  const [showNoModelToast, setShowNoModelToast] = React.useState(false);
  const [pasteAreaVisible, setPasteAreaVisible] = React.useState(false);
  const [optimisticBundleBusy, setOptimisticBundleBusy] = React.useState(false);
  const bundleBusy = generating || bundleGenerateBusy || optimisticBundleBusy;

  React.useEffect(() => {
    if (!generating && !bundleGenerateBusy) {
      setOptimisticBundleBusy(false);
    }
  }, [generating, bundleGenerateBusy]);
  const canGenerateFromScratch = typeof onGenerateFromScratch === 'function';
  const progressMessage = formatUseCaseBundleProgressBanner(
    bundleGenerationCount,
    bundleGenerationOrdering,
    bundleGenerationCategorizing
  );

  React.useEffect(() => {
    if (hasModel && showNoModelToast) {
      setShowNoModelToast(false);
    }
  }, [hasModel, showNoModelToast]);

  const handleGenerateFromScratchClick = (): void => {
    if (!canGenerateFromScratch || bundleBusy) return;
    if (!hasModel) {
      setShowNoModelToast(true);
      return;
    }
    setOptimisticBundleBusy(true);
    void onGenerateFromScratch?.();
  };

  const handlePasteLinkClick = (): void => {
    if (bundleBusy) return;
    setPasteAreaVisible(true);
    requestAnimationFrame(() => rootDraftRef.current?.focus());
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" aria-label="Introduzione use case">
      <div className="flex w-full flex-1 flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-5 sm:py-6 lg:px-6">
        <header className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center sm:gap-5">
          <img
            src={OMNIA_ROBOT_MASCOT_3D}
            alt=""
            className="h-28 w-auto shrink-0 object-contain sm:h-32"
            width={128}
            height={128}
            decoding="async"
          />
          <h2 className="max-w-md text-base font-semibold leading-snug tracking-tight text-slate-50 sm:max-w-lg sm:text-lg lg:text-xl">
            {LABEL_EMPTY_USE_CASE_TUTOR_HEADLINE}
          </h2>
        </header>

        {bundleBusy ? (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-4 px-2 py-12 text-center"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="h-10 w-10 animate-spin text-violet-300" aria-hidden />
            <p className="max-w-lg text-base font-medium leading-relaxed text-violet-100/95 sm:text-lg">
              {progressMessage}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 sm:gap-6">
            <p className="mx-auto max-w-lg text-center text-sm leading-relaxed text-pretty text-slate-300 sm:max-w-xl sm:text-base">
              Se hai già una lista di use cases{' '}
              <button
                type="button"
                disabled={bundleBusy}
                onClick={handlePasteLinkClick}
                aria-expanded={pasteAreaVisible}
                aria-controls="use-case-paste-area"
                className={INTRO_LINK_CLS}
              >
                {LABEL_EMPTY_USE_CASE_CLICK_HERE}
              </button>{' '}
              e la riorganizziamo insieme, altrimenti{' '}
              <button
                type="button"
                disabled={bundleBusy || !canGenerateFromScratch}
                onClick={handleGenerateFromScratchClick}
                aria-label={LABEL_GENERATE_USE_CASES}
                className={INTRO_LINK_CLS}
              >
                {LABEL_EMPTY_USE_CASE_CLICK_HERE}
              </button>{' '}
              e genero io un insieme di use cases sulla base delle informazioni che mi hai dato, e
              poi li rivediamo insieme!
            </p>

            {pasteAreaVisible ? (
              <section id="use-case-paste-area" className="w-full space-y-3 py-1">
                <textarea
                  ref={rootDraftRef}
                  rows={5}
                  value={rootDraftLabel}
                  onChange={(e) => onRootDraftChange(e.target.value)}
                  onBlur={onRootDraftBlur}
                  onPaste={onRootDraftPaste}
                  onKeyDown={onRootDraftKeyDown}
                  disabled={rootComposerLocked}
                  placeholder={PLACEHOLDER_EMPTY_USE_CASE_DRAFT}
                  className="min-h-[140px] w-full resize-y rounded-lg border border-slate-600/90 bg-slate-900/90 px-3.5 py-3 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-violet-500/70 focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60 sm:min-h-[160px] sm:text-base"
                />
                {showAnalyzeChip ? (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={rootComposerLocked}
                      onClick={onAnalyzeClick}
                      aria-busy={rootChipBusy}
                      className={`inline-flex max-w-full items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm ${
                        rootChipBusy
                          ? 'bg-emerald-500/30 text-emerald-50 ring-emerald-400/55'
                          : 'bg-emerald-600/40 text-emerald-50 ring-emerald-400/50 hover:bg-emerald-500/50'
                      }`}
                    >
                      {rootChipBusy ? (
                        <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden />
                      ) : null}
                      <span className="text-left leading-snug">{rootChipLabel}</span>
                    </button>
                  </div>
                ) : null}
                {rootBatchWarning ? (
                  <p className="text-center text-xs text-amber-300/95">{rootBatchWarning}</p>
                ) : null}
              </section>
            ) : null}
          </div>
        )}
      </div>
      {showNoModelToast ? (
        <MissingAiModelToast onDismiss={() => setShowNoModelToast(false)} />
      ) : null}
    </div>
  );
}
