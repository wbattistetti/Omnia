/**
 * Backend tab — Omnia {@link EditorBackendsPanel} + righe derivate da snapshot.
 */

import React from 'react';
import { EditorBackendsPanel } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/EditorBackendsPanel';
import type { AgentReviewBackendSnapshot } from '@domain/agentReviewChannel/reviewSnapshots';
import { ReviewPortalDerivedBackends } from '@reviewPortal/ReviewPortalDerivedBackends';

export interface ReviewPortalBackendPanelProps {
  backendSnapshot: AgentReviewBackendSnapshot | null | undefined;
}

export function ReviewPortalBackendPanel({
  backendSnapshot,
}: ReviewPortalBackendPanelProps): React.ReactElement {
  const hasManual =
    (backendSnapshot?.manualEntries?.length ?? 0) > 0 ||
    backendSnapshot?.catalogRows.some((r) => r.sources.manual) === true;
  const hasDerived = backendSnapshot?.catalogRows.some(
    (r) => r.sources.graph || r.sources.tools
  );

  if (!hasManual && !hasDerived) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
        Nessun backend collegato a questo task nella review. Configura backend in Omnia e
        ripubblica.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-l-4 border-violet-500/50 bg-violet-950/20">
      {hasManual ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <EditorBackendsPanel {...({} as React.ComponentProps<typeof EditorBackendsPanel>)} />
        </div>
      ) : null}
      <ReviewPortalDerivedBackends snapshot={backendSnapshot} />
    </div>
  );
}
