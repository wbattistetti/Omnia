/**
 * Prompts canvas — overlay operativo (JSON, Dialog control, Azioni).
 */

import React from 'react';
import { X } from 'lucide-react';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';
import { tutorIdProps, UI_IDS } from '../activeTutor/uiIds';
import { ConversationalJsonPanel } from './ConversationalJsonPanel';
import { UseCaseActionsPalettePanel } from '../UseCaseActionsPalettePanel';
import { DialogControlPanel } from '../useCaseBundle/DialogControlPanel';

export type PromptsOperationalOverlayMode = 'json' | 'dialogControl' | 'actions';

/** @deprecated Usare `dialogControl` */
export type LegacySlotMappingOverlayMode = 'slotMapping';

export interface PromptsOperationalOverlayProps {
  readonly mode: PromptsOperationalOverlayMode | LegacySlotMappingOverlayMode;
  readonly onClose: () => void;
  readonly selectedUseCase: AIAgentUseCase | null;
  readonly useCases: readonly AIAgentUseCase[];
  readonly onSelectUseCase?: (useCaseId: string) => void;
  readonly lexicon?: ProjectSlotLexicon | null;
  readonly onApproveLexiconEntry?: (surface: string) => void;
  readonly onRevokeLexiconEntry?: (surface: string) => void;
  readonly onUpdateLexiconSlotId?: (surface: string, slotId: string) => void;
}

const MODE_LABELS: Readonly<Record<PromptsOperationalOverlayMode, string>> = {
  json: 'Anteprima JSON conversazionale',
  dialogControl: 'Dialog control',
  actions: 'Pannello azioni',
};

const MODE_UI_ID: Readonly<Record<PromptsOperationalOverlayMode, string>> = {
  json: UI_IDS.promptsJsonPreview,
  dialogControl: UI_IDS.promptsSlotMapping,
  actions: UI_IDS.promptsActionsPanel,
};

export function PromptsOperationalOverlay({
  mode,
  onClose,
  selectedUseCase,
  useCases,
  onSelectUseCase,
  lexicon,
  onApproveLexiconEntry,
  onRevokeLexiconEntry,
  onUpdateLexiconSlotId,
}: PromptsOperationalOverlayProps): React.ReactElement {
  const resolvedMode: PromptsOperationalOverlayMode =
    mode === 'slotMapping' ? 'dialogControl' : mode;

  const panelWidthClass =
    resolvedMode === 'dialogControl' ? 'w-[min(780px,96vw)]' : 'w-[min(420px,92%)]';

  return (
    <div
      className={`absolute inset-y-0 right-0 z-20 flex flex-col border-l border-slate-300/80 bg-slate-50 shadow-[-8px_0_24px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-950 ${panelWidthClass}`}
      {...tutorIdProps(MODE_UI_ID[resolvedMode])}
      role="dialog"
      aria-label={MODE_LABELS[resolvedMode]}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/90 px-3 py-2 dark:border-slate-700/70">
        <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          {MODE_LABELS[resolvedMode]}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Chiudi pannello"
        >
          <X size={16} aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
        {resolvedMode === 'json' ? (
          <div className="h-full min-h-0 overflow-hidden px-2 py-2">
            <ConversationalJsonPanel
              selectedUseCase={selectedUseCase}
              useCases={useCases}
              onSelectUseCase={onSelectUseCase}
              lexicon={lexicon ?? undefined}
            />
          </div>
        ) : resolvedMode === 'dialogControl' &&
          lexicon &&
          onApproveLexiconEntry &&
          onRevokeLexiconEntry &&
          onUpdateLexiconSlotId ? (
          <DialogControlPanel
            lexicon={lexicon}
            onApproveLexiconEntry={onApproveLexiconEntry}
            onRevokeLexiconEntry={onRevokeLexiconEntry}
            onUpdateLexiconSlotId={onUpdateLexiconSlotId}
          />
        ) : resolvedMode === 'actions' ? (
          <UseCaseActionsPalettePanel />
        ) : null}
      </div>
    </div>
  );
}
