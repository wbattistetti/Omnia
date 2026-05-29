/**
 * Anteprima bozza specifica API inclusa nell'osservazione di review backend.
 */

import React from 'react';
import type { KbAnalysisSuggestedFeatureDraft } from '@domain/backendAnalysis/suggestedFeatureSpec';
import { ProposedBackendParameterTable } from './ProposedBackendParameterTable';

export type SuggestedFeatureDraftPreviewProps = {
  draft: KbAnalysisSuggestedFeatureDraft;
};

export function SuggestedFeatureDraftPreview({
  draft,
}: SuggestedFeatureDraftPreviewProps): React.ReactElement {
  const paramRows = Object.values(draft.parameters);

  return (
    <details
      className="mb-3 rounded-md border border-amber-800/45 bg-amber-950/20"
      open
    >
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-amber-100/95">
        Bozza specifica proposta — {draft.title}
      </summary>
      <div className="space-y-2 border-t border-amber-900/40 px-3 py-2">
        <p className="whitespace-pre-wrap text-sm leading-snug text-slate-300">
          {draft.purposeMarkdown.trim() || (
            <span className="text-slate-500">Scopo non indicato.</span>
          )}
        </p>
        {paramRows.length > 0 ? (
          <ProposedBackendParameterTable parameters={paramRows} />
        ) : (
          <p className="text-xs text-slate-500">Nessun parametro nella bozza.</p>
        )}
      </div>
    </details>
  );
}
