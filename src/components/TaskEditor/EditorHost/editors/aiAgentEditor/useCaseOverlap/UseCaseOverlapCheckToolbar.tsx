/**
 * Toolbar: verifica sovrapposizioni globali catalogo use case.
 */

import React from 'react';
import { GitCompare, Loader2 } from 'lucide-react';
import { useAIProvider } from '@context/AIProviderContext';
import { useOptionalAIAgentEditorDock } from '../AIAgentEditorDockContext';
import { useUseCaseWizardListToolbarOptional } from '../useCaseGeneratorWizard/UseCaseWizardListToolbarContext';
import { UseCaseOverlapReportDialog } from './UseCaseOverlapReportDialog';

/** Stub — fusione cluster suggerita. */
function handleMergeClusterClick(_clusterId: string): void {
  /* stub */
}

/** Stub — selezione use case dal report. */
function handleSelectUseCaseFromReport(_useCaseId: string): void {
  /* stub */
}

export function UseCaseOverlapCheckToolbar(): React.ReactElement | null {
  const ctx = useUseCaseWizardListToolbarOptional();
  const dock = useOptionalAIAgentEditorDock();
  const { provider, model } = useAIProvider();

  if (!ctx) return null;

  const {
    overlapReportOpen,
    setOverlapReportOpen,
    overlapCheckBusy,
    triggerCheckOverlaps,
    overlapReport,
    overlapCheckError,
  } = ctx;

  const canRun = Boolean(provider && model && dock);
  const busy = overlapCheckBusy;

  return (
    <>
      <button
        type="button"
        disabled={!canRun || busy}
        title="Verifica sovrapposizioni semantiche su tutto il catalogo"
        onClick={() => {
          setOverlapReportOpen(true);
          void triggerCheckOverlaps();
        }}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-violet-500/30 bg-violet-950/35 px-2 text-[11px] font-semibold text-violet-100/95 hover:bg-violet-900/45 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? (
          <Loader2 size={13} className="animate-spin" aria-hidden />
        ) : (
          <GitCompare size={13} aria-hidden />
        )}
        <span>Check overlap</span>
      </button>

      <UseCaseOverlapReportDialog
        open={overlapReportOpen}
        report={overlapReport}
        busy={busy}
        error={overlapCheckError}
        onClose={() => setOverlapReportOpen(false)}
        onMergeCluster={handleMergeClusterClick}
        onSelectUseCase={handleSelectUseCaseFromReport}
      />
    </>
  );
}
