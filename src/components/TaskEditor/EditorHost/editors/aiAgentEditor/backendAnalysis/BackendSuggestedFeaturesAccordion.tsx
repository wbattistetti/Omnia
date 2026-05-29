/**
 * Accordion «Nuove funzionalità suggerite» per un backend del catalogo.
 */

import React from 'react';
import type { BackendSuggestedFeatureRecord } from '@domain/backendAnalysis/backendAnalysisDocumentV2';
import { filterSuggestedFeaturesForDisplay } from '@domain/backendAnalysis/backendAnalysisDisplayRules';
import { BackendAnalysisAccordion } from './BackendAnalysisAccordion';
import { ProposedBackendParameterTable } from './ProposedBackendParameterTable';

function SuggestedFeatureCard({
  feature,
  defaultOpen,
}: {
  feature: BackendSuggestedFeatureRecord;
  defaultOpen?: boolean;
}): React.ReactElement {
  const paramRows = Object.values(feature.parameters);

  return (
    <BackendAnalysisAccordion level={2} title={feature.title} defaultOpen={defaultOpen}>
      <div>
        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300/90">
          Scopo
        </h4>
        <div className="whitespace-pre-wrap text-sm leading-snug text-slate-300">
          {feature.purposeMarkdown.trim() || (
            <span className="text-slate-500">—</span>
          )}
        </div>
      </div>
      {paramRows.length > 0 ? (
        <div className="mt-3">
          <p className="mb-2 text-[11px] text-slate-500">
            Parametri proposti da aggiungere al contratto:{' '}
            <span className="text-slate-400">→ input</span> = SEND,{' '}
            <span className="text-slate-400">← output</span> = RECEIVE.
          </p>
          <ProposedBackendParameterTable parameters={paramRows} />
        </div>
      ) : null}
    </BackendAnalysisAccordion>
  );
}

export type BackendSuggestedFeaturesAccordionProps = {
  features: readonly BackendSuggestedFeatureRecord[];
  /** Evidenzia la funzionalità appena creata. */
  highlightFeatureId?: string | null;
};

export function BackendSuggestedFeaturesAccordion({
  features,
  highlightFeatureId,
}: BackendSuggestedFeaturesAccordionProps): React.ReactElement {
  const list = filterSuggestedFeaturesForDisplay(features);
  const defaultOpen = list.length <= 2;

  return (
    <BackendAnalysisAccordion
      level={2}
      title="Nuove funzionalità suggerite"
      defaultOpen={defaultOpen || Boolean(highlightFeatureId)}
    >
      {list.length === 0 ? (
        <p className="text-[11px] leading-snug text-slate-500">
          Nessuna funzionalità suggerita. Dalla revisione dei punti, dopo «Sì», usa «Crea
          specifiche» per formalizzare estensioni API da implementare.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((f, i) => (
            <div
              key={f.id}
              className={
                f.id === highlightFeatureId
                  ? 'rounded-md ring-1 ring-amber-500/50'
                  : undefined
              }
            >
              <SuggestedFeatureCard feature={f} defaultOpen={f.id === highlightFeatureId || i === 0} />
            </div>
          ))}
        </div>
      )}
    </BackendAnalysisAccordion>
  );
}
