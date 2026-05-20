/**
 * CTA bundle «Genera / Crea altri use case» con guard sul modello IA globale.
 */

import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useAiBusyLabel } from '@hooks/useAiBusyLabel';
import { MissingAiModelToast } from '@components/common/MissingAiModelToast';
import { LastAiCostBadge } from '@components/common/LastAiCostBadge';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import { LABEL_GENERATE_MORE_USE_CASES, LABEL_GENERATE_USE_CASES } from '../constants';

export type UseCaseBundleGenerateButtonProps = {
  generateBusy: boolean;
  onGenerate?: () => void | Promise<void>;
  /** Lista già popolata → «Crea altri use case». */
  hasExistingUseCases?: boolean;
  /** Compatto: accanto alla textbox in riga. */
  layout?: 'inline' | 'block';
  className?: string;
};

export function UseCaseBundleGenerateButton({
  generateBusy,
  onGenerate,
  hasExistingUseCases = false,
  layout = 'inline',
  className = '',
}: UseCaseBundleGenerateButtonProps): React.ReactElement {
  const { hasModel } = useAiBusyLabel();
  const [showNoModelToast, setShowNoModelToast] = React.useState(false);

  React.useEffect(() => {
    if (hasModel && showNoModelToast) {
      setShowNoModelToast(false);
    }
  }, [hasModel, showNoModelToast]);

  const label = hasExistingUseCases ? LABEL_GENERATE_MORE_USE_CASES : LABEL_GENERATE_USE_CASES;
  const canGenerate = typeof onGenerate === 'function';

  const handleClick = (): void => {
    if (!hasModel) {
      setShowNoModelToast(true);
      return;
    }
    void onGenerate?.();
  };

  const inlineClass =
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-violet-500/45 bg-violet-600/25 px-3 py-2 text-xs font-semibold text-violet-50 transition-colors hover:bg-violet-600/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';
  const blockClass =
    'inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/45 bg-slate-900/90 px-3 py-2.5 text-xs font-semibold text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-violet-400/55 hover:bg-slate-800/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:opacity-45';

  return (
    <>
      <button
        type="button"
        aria-busy={generateBusy}
        disabled={generateBusy || !canGenerate}
        onClick={handleClick}
        title={label}
        className={`${layout === 'inline' ? inlineClass : blockClass} ${className}`.trim()}
      >
        {generateBusy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span className="whitespace-nowrap">{generateBusy ? 'Generazione…' : label}</span>
        {!generateBusy ? (
          <LastAiCostBadge
            purpose={
              hasExistingUseCases
                ? AI_CALL_PURPOSE.USE_CASE_GENERATE_MORE
                : AI_CALL_PURPOSE.USE_CASE_BUNDLE_INITIAL
            }
          />
        ) : null}
      </button>
      {showNoModelToast ? (
        <MissingAiModelToast onDismiss={() => setShowNoModelToast(false)} />
      ) : null}
    </>
  );
}
