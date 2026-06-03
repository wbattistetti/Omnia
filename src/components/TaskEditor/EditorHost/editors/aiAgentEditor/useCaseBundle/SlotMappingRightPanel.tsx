/**

 * Pannello destro Slot Mapping: tabella surface → destinazione (semantico / backend ad albero).

 */



import React from 'react';

import { Loader2, RefreshCw, RotateCcw, ScanSearch } from 'lucide-react';

import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';

import {
  isUnclassifiedSlotId,
  listRegisteredSlotIds,
  normalizeSlotId,
  normalizeSurface,
} from '@domain/useCaseBundle/projectSlotLexicon';
import { SlotDictionarySection } from './SlotDictionarySection';

import { VoteThumbPair } from '../VoteThumbPair';

import { useUseCaseWizardListToolbarOptional } from '../useCaseGeneratorWizard/UseCaseWizardListToolbarContext';

import { SlotDestinationCombobox } from './SlotDestinationCombobox';

import { SlotCategoryCombobox } from './SlotCategoryCombobox';

import { useOptionalAIAgentEditorDock } from '../AIAgentEditorDockContext';

import { lookupSendHintBySurface } from '@domain/backendOutputSlotBinding/mergeSendHints';
import { SLOT_MAPPING_PAYOFF } from './mappingBlockedReasonCopy';



export interface SlotMappingRightPanelProps {

  lexicon: ProjectSlotLexicon;

  onApproveEntry: (surface: string) => void;

  onRevokeEntryApproval: (surface: string) => void;

  onUpdateSlotId: (surface: string, slotId: string) => void;

}



function rowTone(entry: ProjectSlotLexicon['entries'][number]): string {

  if (entry.conflictWith) return 'text-red-300';

  if (entry.approved) return 'text-emerald-300';

  return 'text-orange-300';

}



/** Lente filtro use case: hover discreta, attiva più grande e in evidenza (ScanSearch). */

function SlotMappingLensButton({

  active,

  onClick,

}: {

  active: boolean;

  onClick: () => void;

}): React.ReactElement {

  return (

    <button

      type="button"

      title={

        active

          ? 'Annulla filtro use case'

          : 'Filtra use case che contengono questo esempio'

      }

      aria-label={active ? 'Annulla filtro' : 'Filtra use case per esempio'}

      aria-pressed={active}

      onClick={onClick}

      className={[

        'inline-flex shrink-0 items-center justify-center rounded-md transition-all duration-150',

        'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70',

        active

          ? 'h-7 w-7 border border-violet-400/55 bg-violet-500/25 text-violet-100 shadow-md shadow-violet-950/50 opacity-100 scale-105'

          : [

              'h-6 w-6 border border-transparent text-slate-500',

              'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',

              'hover:border-slate-600/50 hover:bg-slate-800/80 hover:text-slate-200',

            ].join(' '),

      ].join(' ')}

    >

      <ScanSearch

        size={active ? 17 : 15}

        strokeWidth={active ? 2.25 : 2}

        aria-hidden

        className={active ? 'drop-shadow-[0_0_6px_rgba(167,139,250,0.45)]' : undefined}

      />

    </button>

  );

}



export function SlotMappingRightPanel({

  lexicon,

  onApproveEntry,

  onRevokeEntryApproval,

  onUpdateSlotId,

}: SlotMappingRightPanelProps): React.ReactElement {

  const ctx = useUseCaseWizardListToolbarOptional();

  const dock = useOptionalAIAgentEditorDock();

  const catalog = dock?.parameterDestinationCatalog ?? [];

  const useDestinationCombo = catalog.length > 0 && Boolean(dock?.applyParameterDestination);



  const entries = React.useMemo(
    () => [...lexicon.entries].sort((a, b) => a.surface.localeCompare(b.surface)),
    [lexicon.entries]
  );

  const { mappedCategoryOptions, otherCategoryOptions } = React.useMemo(() => {
    const mapped = new Set<string>();
    for (const e of lexicon.entries) {
      const id = normalizeSlotId(e.slot_id);
      if (!isUnclassifiedSlotId(id)) mapped.add(id);
    }
    const mappedSorted = [...mapped].sort((a, b) => a.localeCompare(b));
    const otherSorted = listRegisteredSlotIds(lexicon)
      .filter((id) => !mapped.has(id))
      .sort((a, b) => a.localeCompare(b));
    return { mappedCategoryOptions: mappedSorted, otherCategoryOptions: otherSorted };
  }, [lexicon]);

  const lensActiveSurface = ctx?.lensActiveSurface ?? null;



  const toggleLensForSurface = React.useCallback(

    (surface: string) => {

      if (!ctx) return;

      const normalized = normalizeSurface(surface);

      if (ctx.lensActiveSurface === normalized) {

        ctx.setLensActiveSurface(null);

        ctx.setSearchSeed('');

        return;

      }

      ctx.setLensActiveSurface(normalized);

      ctx.setSearchSeed(normalized);

    },

    [ctx]

  );



  const destinationCellClass = (approved: boolean, unclassified: boolean): string => {
    if (approved && !unclassified) {
      return '[&>button]:text-emerald-300 [&>button]:border-emerald-600/50';
    }
    if (unclassified) {
      return '[&>button]:text-red-400 [&>button]:border-red-600/40';
    }
    return '[&>button]:text-orange-300';
  };

  const mappingBanner = dock?.compileMappingBanner?.trim() ?? '';
  const mappingNeedsWork = mappingBanner.startsWith('MAPPING');
  const compileBusy = dock?.compilePhrasesBusy === true;
  const canCompile =
    Boolean(dock?.compileUseCasePhrasesForCatalog) && !compileBusy;
  const canRebuild =
    Boolean(dock?.rebuildSlotMappingFromScratch) && !compileBusy;

  const handleAggiorna = React.useCallback(async () => {
    if (!dock?.compileUseCasePhrasesForCatalog || compileBusy) return;
    await dock.compileUseCasePhrasesForCatalog();
  }, [compileBusy, dock]);

  const handleRebuild = React.useCallback(async () => {
    if (!dock?.rebuildSlotMappingFromScratch || compileBusy) return;
    const confirmed = window.confirm(
      'Rebuild Slot Mapping da zero?\n\nVerranno azzerati dizionario slot, binding backend e approvazioni mapping prima della nuova compilazione.'
    );
    if (!confirmed) return;
    await dock.rebuildSlotMappingFromScratch();
  }, [compileBusy, dock]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 dark:bg-slate-950">
      <div className="shrink-0 border-b border-violet-500/25 bg-slate-50 px-4 py-2.5 dark:border-violet-500/30 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-violet-300">
            Slot Mapping
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleAggiorna()}
              disabled={!canCompile}
              title="Aggiorna mapping e frasi dal catalogo (incrementale)"
              className={[
                'inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-semibold transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/80',
                canCompile
                  ? 'border-violet-400/45 text-violet-100 hover:bg-violet-500/15'
                  : 'cursor-not-allowed border-slate-700/60 text-slate-500',
              ].join(' ')}
            >
              {compileBusy ? (
                <Loader2 size={12} className="animate-spin" aria-hidden />
              ) : (
                <RefreshCw size={12} aria-hidden />
              )}
              <span>Aggiorna</span>
            </button>
            <button
              type="button"
              onClick={() => void handleRebuild()}
              disabled={!canRebuild}
              title="Rebuild da zero: reset mapping e ricompila"
              className={[
                'inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-semibold transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/80',
                canRebuild
                  ? 'border-amber-500/40 text-amber-200 hover:bg-amber-500/10'
                  : 'cursor-not-allowed border-slate-700/60 text-slate-500',
              ].join(' ')}
            >
              <RotateCcw size={12} aria-hidden />
              <span>Rebuild</span>
            </button>
          </div>
        </div>
        {compileBusy ? (
          <p className="mt-1.5 flex items-center gap-2 text-[11px] leading-snug text-violet-200">
            <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden />
            Compilazione mapping in corso (IA + lessico)…
          </p>
        ) : (
          <p
            className={
              mappingNeedsWork
                ? 'mt-1.5 text-[11px] leading-snug text-amber-100/95'
                : 'mt-1 text-[10px] leading-snug text-slate-500'
            }
          >
            {mappingNeedsWork
              ? `${SLOT_MAPPING_PAYOFF} La compilazione ha già proposto mapping automatici: verifica le righe evidenziate.`
              : SLOT_MAPPING_PAYOFF}
          </p>
        )}
      </div>
      <SlotDictionarySection lexicon={lexicon} />



      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-3 py-3 dark:bg-slate-950">

        <table className="w-full text-left text-xs">

          <thead>

            <tr className="border-b border-slate-700/80 text-slate-400">

              <th className="py-1.5 pr-2 font-medium">Esempio</th>

              <th className="py-1.5 pr-2 font-medium">

                {useDestinationCombo ? 'Destinazione' : 'Categoria'}

              </th>

              <th className="py-1.5 text-right font-medium" aria-label="Azioni" />

            </tr>

          </thead>

          <tbody>

            {entries.length === 0 ? (

              <tr>

                <td colSpan={3} className="py-4 text-slate-500">

                  Nessuno slot. Compila i messaggi degli use case per popolare il mapping.

                </td>

              </tr>

            ) : (

              entries.map((e) => {

                const isLensActive = lensActiveSurface === e.surface;

                const unclassified = isUnclassifiedSlotId(e.slot_id);

                const sendHint = dock
                  ? lookupSendHintBySurface(dock.backendOutputSlotBindings, e.surface)
                  : undefined;
                const receiveBinding = dock
                  ? (() => {
                      const key = e.surface.trim().toLowerCase();
                      const row = dock.backendOutputSlotBindings.rows.find(
                        (r) => r.tokenInPhrase.trim().toLowerCase() === key && r.apiPath.trim()
                      );
                      if (row) {
                        return {
                          receivePath: row.apiPath,
                          backendTaskId: row.backendTaskId,
                        };
                      }
                      const contract = (dock.backendOutputSlotBindings.slotContracts ?? []).find(
                        (c) => c.slotId === e.slot_id.trim().toLowerCase() && c.receive.trim()
                      );
                      if (contract) {
                        return {
                          receivePath: contract.receive,
                          backendTaskId: contract.backendTaskId,
                        };
                      }
                      return undefined;
                    })()
                  : undefined;

                return (

                  <tr

                    key={e.surface}

                    className={[

                      'border-b border-slate-800/80',

                      rowTone(e),

                      isLensActive ? 'bg-violet-500/[0.08]' : '',

                    ].join(' ')}

                  >

                    <td className="group max-w-[160px] py-1.5 pr-2">

                      <div className="flex items-center gap-1.5">

                        <span className="min-w-0 truncate font-mono text-amber-100">{e.surface}</span>

                        {ctx ? (

                          <SlotMappingLensButton

                            active={isLensActive}

                            onClick={() => toggleLensForSurface(e.surface)}

                          />

                        ) : null}

                      </div>

                    </td>

                    <td className="py-1.5 pr-2">

                      {useDestinationCombo ? (

                        <SlotDestinationCombobox
                          slotId={e.slot_id}
                          sendHint={sendHint}
                          receivePath={receiveBinding?.receivePath}
                          backendTaskId={receiveBinding?.backendTaskId}
                          catalog={catalog}

                          disabled={!dock?.applyParameterDestination}

                          onCommit={(dest) => dock!.applyParameterDestination(e.surface, dest)}
                          className={destinationCellClass(e.approved, unclassified)}

                        />

                      ) : (

                        <SlotCategoryCombobox
                          value={e.slot_id}
                          mappedOptions={mappedCategoryOptions}
                          otherOptions={otherCategoryOptions}
                          onCommit={(slotId) => onUpdateSlotId(e.surface, slotId)}

                          className={destinationCellClass(e.approved, unclassified)}

                        />

                      )}

                      {e.conflictWith ? (

                        <span className="mt-0.5 block text-[10px] text-red-400">

                          conflitto → {e.conflictWith}

                        </span>

                      ) : null}

                    </td>

                    <td className="py-1.5 text-right">

                      <VoteThumbPair

                        vote={e.approved ? 'up' : undefined}

                        outerBtnClass="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-slate-800/80"

                        iconSize={13}

                        onVote={(choice) => {

                          if (choice === 'up') {

                            onApproveEntry(e.surface);

                            return;

                          }

                          onRevokeEntryApproval(e.surface);

                        }}

                      />

                    </td>

                  </tr>

                );

              })

            )}

          </tbody>

        </table>

      </div>

    </div>

  );

}


