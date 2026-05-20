/**
 * Empty use-case list: tutor layout with mascot, paste area, and generate-from-scratch CTA.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { formatUseCaseBundleProgressBanner } from '@domain/aiAgentUseCase/useCaseBundleChunkConfig';
import { OMNIA_ROBOT_MASCOT_3D } from './useCaseMascotAssets';
import { UseCaseBundleGenerateButton } from './UseCaseBundleGenerateButton';

export type UseCaseEmptyTutorPanelProps = {
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
  onGenerateFromScratch?: () => void | Promise<void>;
  generating?: boolean;
  bundleGenerateBusy?: boolean;
  bundleGenerationCount?: number | null;
  bundleGenerationOrdering?: boolean;
};

export function UseCaseEmptyTutorPanel({
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
  onGenerateFromScratch,
  generating = false,
  bundleGenerateBusy = false,
  bundleGenerationCount = null,
  bundleGenerationOrdering = false,
}: UseCaseEmptyTutorPanelProps): React.ReactElement {
  const bundleBusy = generating || bundleGenerateBusy;
  const canGenerateFromScratch = typeof onGenerateFromScratch === 'function';
  const progressMessage = formatUseCaseBundleProgressBanner(
    bundleGenerationCount,
    bundleGenerationOrdering
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      aria-label="Introduzione use case"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-6 sm:text-left">
          <div className="relative shrink-0">
            <img
              src={OMNIA_ROBOT_MASCOT_3D}
              alt=""
              className="h-36 w-auto max-w-[10rem] object-contain sm:h-44 sm:max-w-[12rem]"
              width={176}
              height={176}
              decoding="async"
            />
          </div>
          <h2 className="min-w-0 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
            Generiamo gli use case per guidare l&apos;agente!
          </h2>
        </div>

        {bundleBusy ? (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-violet-500/30 bg-gradient-to-b from-violet-950/45 to-slate-950/50 px-6 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="h-10 w-10 animate-spin text-violet-300" aria-hidden />
            <p className="max-w-md text-lg font-medium leading-relaxed text-violet-100/95">
              {progressMessage}
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-xl border border-violet-500/25 bg-gradient-to-b from-violet-950/35 to-slate-950/50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5">
              <p className="mb-3 text-lg font-semibold leading-snug text-violet-100/95 sm:text-xl">
                Incolla qui la lista di tutti gli use case che hai già pensato e ti aiuterò a
                riorganizzarli…
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <textarea
                  ref={rootDraftRef}
                  rows={4}
                  value={rootDraftLabel}
                  onChange={(e) => onRootDraftChange(e.target.value)}
                  onBlur={onRootDraftBlur}
                  onPaste={onRootDraftPaste}
                  onKeyDown={onRootDraftKeyDown}
                  disabled={rootComposerLocked}
                  placeholder={placeholder}
                  className="min-h-[120px] min-w-0 flex-1 resize-y rounded-lg border border-slate-600/90 bg-slate-900/90 px-3 py-2.5 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-violet-500/70 focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60 sm:text-base"
                />
                {canGenerateFromScratch ? (
                  <UseCaseBundleGenerateButton
                    generateBusy={false}
                    onGenerate={onGenerateFromScratch}
                    hasExistingUseCases={false}
                    layout="inline"
                    className="sm:mt-1"
                  />
                ) : null}
              </div>
              {showAnalyzeChip ? (
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
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
                <p className="mt-2 text-xs text-amber-300/95">{rootBatchWarning}</p>
              ) : null}
            </section>

            {canGenerateFromScratch ? (
              <p className="text-center text-sm text-slate-400">
                Oppure usa il pulsante accanto al campo per far proporre all&apos;IA nuovi use case
                da zero, senza incollare nulla.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
