/**
 * Pannello destro Slot Mapping: tabella surface → slot_id con validazione manuale.
 */

import React from 'react';
import { ScanSearch } from 'lucide-react';
import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';
import {
  CORE_SLOT_IDS,
  isUnclassifiedSlotId,
  normalizeSlotId,
  normalizeSurface,
} from '@domain/useCaseBundle/projectSlotLexicon';
import { VoteThumbPair } from '../VoteThumbPair';
import { useUseCaseWizardListToolbarOptional } from '../useCaseGeneratorWizard/UseCaseWizardListToolbarContext';
import { SlotCategoryCombobox } from './SlotCategoryCombobox';

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
    const otherSorted = [...CORE_SLOT_IDS]
      .filter((id) => !mapped.has(id))
      .sort((a, b) => a.localeCompare(b));
    return { mappedCategoryOptions: mappedSorted, otherCategoryOptions: otherSorted };
  }, [lexicon.entries]);

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-violet-500/25 bg-slate-50/95 px-4 py-2.5 dark:bg-slate-950/90">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-violet-300">
          Slot Mapping
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-700/80 text-slate-400">
              <th className="py-1.5 pr-2 font-medium">Esempio</th>
              <th className="py-1.5 pr-2 font-medium">Categoria</th>
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
                      <SlotCategoryCombobox
                        value={e.slot_id}
                        mappedOptions={mappedCategoryOptions}
                        otherOptions={otherCategoryOptions}
                        onCommit={(slotId) => onUpdateSlotId(e.surface, slotId)}
                        className={
                          e.approved && !unclassified
                            ? '[&>button]:text-emerald-300 [&>button]:border-emerald-600/50'
                            : unclassified
                              ? '[&>button]:text-red-400 [&>button]:border-red-600/40'
                              : '[&>button]:text-orange-300'
                        }
                      />
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
