/**

 * Analisi backend: backend catalogo → come usare → parametri; proposed; system prompt agente.

 */



import React from 'react';

import { Info, Pencil } from 'lucide-react';

import type {

  BackendAnalysisBackendRecord,

  BackendParameterAnalysisRecord,

} from '@domain/backendAnalysis/backendAnalysisDocumentV2';

import { backendChipClassForCatalogEntry } from '@domain/backendAnalysis/backendChipPalette';

import {

  backendHasParameterAnalysis,

  backendHowToUseHasContent,

  filterProposedForDisplay,

  systemPromptHasContent,

} from '@domain/backendAnalysis/backendAnalysisDisplayRules';

import { defaultIncompleteAgentSystemPrompt } from '@domain/backendAnalysis/backendAnalysisUxNormalize';
import {
  syncProposedBackendRecord,
  type ProposedBackendRecord,
} from '@domain/backendAnalysis/proposedBackendSpec';
import { ProposedBackendParameterTable } from './backendAnalysis/ProposedBackendParameterTable';

import {
  howToUseSectionId,
  paramDetailSectionId,
  proposedBackendAccordionTitle,
  proposedBackendSectionId,
} from '@domain/backendAnalysis/backendAnalysisSectionIds';

import { useAgentBackendAnalysis } from './AgentBackendAnalysisContext';

import { BackendAnalysisAccordion } from './backendAnalysis/BackendAnalysisAccordion';

import { BackendAnalysisSectionWithReview } from './backendAnalysis/BackendAnalysisSectionWithReview';

import { BackendParameterKindIcon } from './backendAnalysis/BackendParameterKindIcon';



function ParameterDescriptionCell({ text }: { text: string }): React.ReactElement {

  const trimmed = text.trim();

  if (!trimmed) return <span className="text-slate-600">—</span>;

  return (

    <div className="max-w-md whitespace-pre-wrap text-sm leading-snug text-slate-300">

      {trimmed}

    </div>

  );

}



function ParameterTable({
  backend,
  editingParamKey,
  onToggleEditParam,
  onOpenInfo,
  onSaveDetail,
}: {
  backend: BackendAnalysisBackendRecord;
  editingParamKey: string | null;
  onToggleEditParam: (paramKey: string) => void;
  onOpenInfo: (row: BackendParameterAnalysisRecord) => void;
  onSaveDetail: (paramKey: string, analysisDetailMarkdown: string) => void;
}): React.ReactElement {

  const rows = Object.values(backend.parameters).sort((a, b) =>

    a.paramKey.localeCompare(b.paramKey)

  );



  if (rows.length === 0) {

    return (

      <p className="text-xs text-slate-500">Nessun parametro nel catalogo per questo backend.</p>

    );

  }



  return (

    <div className="overflow-x-auto rounded border border-slate-700/80">

      <table className="w-full min-w-[600px] border-collapse text-left text-xs">

        <thead>

          <tr className="border-b border-slate-700/80 bg-slate-900/80 text-slate-400">

            <th className="w-8 px-1 py-1.5" aria-label="Stato" />

            <th className="px-2 py-1.5 font-semibold">Parametro</th>

            <th className="px-2 py-1.5 font-semibold">Direzione</th>

            <th className="px-2 py-1.5 font-semibold">Ruolo</th>

            <th className="px-2 py-1.5 font-semibold">Descrizione</th>

            <th className="w-16 px-1 py-1.5" aria-label="Azioni" />

          </tr>

        </thead>

        <tbody>

          {rows.map((row) => {
            const isEditing = editingParamKey === row.paramKey;
            const sectionId = paramDetailSectionId(backend.catalogEntryId, row.paramKey);
            const preview =
              row.analysisDetailMarkdown.trim() ||
              row.descriptionShort ||
              row.analysisSummary ||
              '';

            return (
              <React.Fragment key={row.paramKey}>
                <tr
                  className={
                    'border-b border-slate-800/80 text-slate-200 ' +
                    (isEditing ? 'bg-emerald-950/20' : '')
                  }
                >
                  <td className="px-1 py-1.5 text-center">
                    <BackendParameterKindIcon kind={row.kind} />
                  </td>
                  <td className="px-2 py-1.5">
                    <code className="rounded bg-slate-800/90 px-1 py-0.5 font-mono text-[11px] text-violet-100">
                      {row.paramKey}
                    </code>
                  </td>
                  <td className="px-2 py-1.5 text-slate-400">
                    {row.direction === 'input' ? '→ input' : '← output'}
                  </td>
                  <td className="px-2 py-1.5 text-slate-300">{row.role || '—'}</td>
                  <td className="px-2 py-1.5">
                    {isEditing ? (
                      <span className="text-[11px] text-emerald-300/80">Modifica in corso…</span>
                    ) : (
                      <ParameterDescriptionCell text={preview} />
                    )}
                  </td>
                  <td className="px-1 py-1.5">
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        title="Anteprima analisi (sola lettura)"
                        className="rounded p-1 text-violet-300/90 hover:bg-violet-950/80"
                        onClick={() => onOpenInfo(row)}
                      >
                        <Info className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        title={isEditing ? 'Chiudi editor' : 'Modifica analisi parametro'}
                        className={
                          'rounded p-1 hover:bg-slate-800 ' +
                          (isEditing
                            ? 'bg-emerald-900/50 text-emerald-200'
                            : 'text-slate-400 hover:text-violet-200')
                        }
                        onClick={() => onToggleEditParam(row.paramKey)}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
                {isEditing ? (
                  <tr className="border-b border-emerald-900/40 bg-slate-950/80">
                    <td colSpan={6} className="px-2 py-2">
                      <BackendAnalysisSectionWithReview
                        sectionId={sectionId}
                        value={row.analysisDetailMarkdown}
                        onValueChange={(v) => onSaveDetail(row.paramKey, v)}
                        minHeightPx={220}
                        ariaLabel={`Analisi dettaglio ${row.paramKey}`}
                      />
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}

        </tbody>

      </table>

    </div>

  );

}



function CatalogBackendAccordion({

  backend,

  defaultOpen,

}: {

  backend: BackendAnalysisBackendRecord;

  defaultOpen?: boolean;

}): React.ReactElement {

  const { persistDocument, document, editingParam, setEditingParam, openParameterPanel } =
    useAgentBackendAnalysis();

  const editingParamKey =
    editingParam?.catalogEntryId === backend.catalogEntryId ? editingParam.paramKey : null;

  const saveParamDetail = React.useCallback(
    (paramKey: string, analysisDetailMarkdown: string) => {
      const param = backend.parameters[paramKey];
      if (!param) return;
      persistDocument({
        ...document,
        backends: {
          ...document.backends,
          [backend.catalogEntryId]: {
            ...backend,
            parameters: {
              ...backend.parameters,
              [paramKey]: { ...param, analysisDetailMarkdown },
            },
          },
        },
      });
    },
    [backend, document, persistDocument]
  );

  const chipCls = backendChipClassForCatalogEntry();

  const sectionId = howToUseSectionId(backend.catalogEntryId);

  const showHowTo = backendHowToUseHasContent(backend);

  const showParams = backendHasParameterAnalysis(backend);



  const patchBackend = (patch: Partial<BackendAnalysisBackendRecord>) => {

    persistDocument({

      ...document,

      backends: {

        ...document.backends,

        [backend.catalogEntryId]: { ...backend, ...patch },

      },

    });

  };



  return (

    <BackendAnalysisAccordion

      level={1}

      defaultOpen={defaultOpen}

      title={<span className={chipCls}>{backend.displayLabel}</span>}

    >

      {showHowTo ? (

        <div>

          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-300/90">

            Come usare il backend

          </h4>

          <BackendAnalysisSectionWithReview

            sectionId={sectionId}

            value={backend.howToUseMarkdown}

            onValueChange={(v) => patchBackend({ howToUseMarkdown: v })}

            ariaLabel={`Come usare ${backend.displayLabel}`}

          />

        </div>

      ) : null}



      {showParams ? (

        <BackendAnalysisAccordion level={2} title="Analisi parametro per parametro" defaultOpen>

          <ParameterTable
            backend={backend}
            editingParamKey={editingParamKey}
            onToggleEditParam={(paramKey) =>
              setEditingParam(
                editingParamKey === paramKey
                  ? null
                  : { catalogEntryId: backend.catalogEntryId, paramKey }
              )
            }
            onSaveDetail={saveParamDetail}
            onOpenInfo={(row) =>
              openParameterPanel({
                catalogEntryId: backend.catalogEntryId,
                paramKey: row.paramKey,
                displayLabel: backend.displayLabel,
              })
            }
          />

        </BackendAnalysisAccordion>

      ) : null}

    </BackendAnalysisAccordion>

  );

}



function ProposedBackendAccordion({
  proposed,
  defaultOpen,
  onChange,
}: {
  proposed: ProposedBackendRecord;
  defaultOpen?: boolean;
  onChange: (next: ProposedBackendRecord) => void;
}): React.ReactElement {
  const paramRows = Object.values(proposed.parameters);
  const patch = (patch: Partial<ProposedBackendRecord>) =>
    onChange(syncProposedBackendRecord({ ...proposed, ...patch }));

  return (
    <BackendAnalysisAccordion
      level={1}
      defaultOpen={defaultOpen}
      title={proposedBackendAccordionTitle(proposed.suggestedName)}
    >
      <div>
        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-300/90">
          A cosa serve questo backend
        </h4>
        <BackendAnalysisSectionWithReview
          sectionId={proposedBackendSectionId(proposed.id)}
          value={proposed.purposeMarkdown}
          onValueChange={(purposeMarkdown) => patch({ purposeMarkdown })}
          ariaLabel={`Scopo backend ${proposed.suggestedName}`}
          minHeightPx={100}
        />
      </div>

      {paramRows.length > 0 ? (
        <BackendAnalysisAccordion
          level={2}
          title="Interfaccia proposta (SEND / RECEIVE)"
          defaultOpen
        >
          <p className="mb-2 text-[11px] text-slate-500">
            Parametri da mappare in catalogo:{' '}
            <span className="text-slate-400">→ input</span> = SEND,{' '}
            <span className="text-slate-400">← output</span> = RECEIVE.
          </p>
          <ProposedBackendParameterTable parameters={paramRows} />
        </BackendAnalysisAccordion>
      ) : null}
    </BackendAnalysisAccordion>
  );
}



export function BackendAnalysisWorkspace(): React.ReactElement {

  const { document, manualEntries, persistDocument, analysisLaunched } =

    useAgentBackendAnalysis();



  if (!analysisLaunched) {

    return <div className="min-h-0 flex-1" aria-hidden />;

  }



  const orderedBackends = manualEntries

    .map((e) => document.backends[e.id])

    .filter((b): b is BackendAnalysisBackendRecord => Boolean(b));



  const proposedList = filterProposedForDisplay(document.global.proposedBackends);

  const showSystemPrompt = systemPromptHasContent(document);



  const patchProposed = (index: number, next: ProposedBackendRecord) => {

    const list = [...document.global.proposedBackends];

    const globalIndex = list.findIndex((p) => p.id === proposedList[index]?.id);

    if (globalIndex < 0) return;

    list[globalIndex] = next;

    persistDocument({

      ...document,

      global: { ...document.global, proposedBackends: list },

    });

  };



  const patchSystemPrompt = (agentSystemPromptMarkdown: string) => {

    persistDocument({

      ...document,

      global: { ...document.global, agentSystemPromptMarkdown },

    });

  };



  return (

    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">

      {orderedBackends.length === 0 ? (

        <p className="text-sm text-slate-500">

          Aggiungi backend nel catalogo per iniziare l&apos;analisi.

        </p>

      ) : (

        orderedBackends.map((b, i) => (

          <CatalogBackendAccordion key={b.catalogEntryId} backend={b} defaultOpen={i === 0} />

        ))

      )}



      {proposedList.length > 0 ? (

        <section className="space-y-2 border-t border-slate-800/80 pt-3">

          {proposedList.map((p, i) => (

            <ProposedBackendAccordion

              key={p.id}

              proposed={p}

              defaultOpen={i === 0}

              onChange={(next) => patchProposed(i, next)}

            />

          ))}

        </section>

      ) : null}



      {showSystemPrompt ? (

        <section className="border-t border-slate-800/80 pt-3">

          <BackendAnalysisAccordion title="System prompt per l'agente" defaultOpen>

            {proposedList.length > 0 ? (

              <p className="mb-2 rounded border border-amber-800/50 bg-amber-950/30 px-2 py-1.5 text-xs text-amber-100/90">

                Analisi incompleta: ci sono backend da aggiungere al catalogo. Il prompt sotto può

                indicare che il system prompt runtime non è ancora completabile.

              </p>

            ) : null}

            <BackendAnalysisSectionWithReview

              sectionId="agentSystemPrompt"

              value={document.global.agentSystemPromptMarkdown}

              onValueChange={patchSystemPrompt}

              ariaLabel="System prompt per l'agente virtuale"

              minHeightPx={120}

            />

          </BackendAnalysisAccordion>

        </section>

      ) : proposedList.length > 0 ? (

        <p className="border-t border-slate-800/80 pt-3 text-xs italic text-slate-500">

          Suggerimento system prompt:{' '}

          {defaultIncompleteAgentSystemPrompt(proposedList)}

        </p>

      ) : null}

    </div>

  );

}


