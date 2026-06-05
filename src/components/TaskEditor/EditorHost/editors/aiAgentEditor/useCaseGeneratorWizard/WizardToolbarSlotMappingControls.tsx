/**
 * Controlli toolbar wizard: Agent Behavior e Dialog control.
 */

import React from 'react';
import { AlertTriangle, Check, Layers } from 'lucide-react';
import type { AgentBehaviorMode } from '@domain/useCaseGeneratorWizard/buildConversationalPrompt';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';
import type { AgentBackendOutputSlotBindings } from '@domain/backendOutputSlotBinding/types';
import { emptyAgentBackendOutputSlotBindings } from '@domain/backendOutputSlotBinding/parseSerialize';
import { computeCatalogCompileValidation } from '../useCaseBundle/catalogCompileValidation';
import { useUseCaseWizardListToolbarOptional } from './UseCaseWizardListToolbarContext';
import { useOptionalAIAgentEditorDock } from '../AIAgentEditorDockContext';

const BEHAVIOR_LABELS: Record<AgentBehaviorMode, string> = {
  A: 'A — UKS + risposta libera',
  B: 'B — UKS + ripeti',
  C: 'C — UKS + operatore (2 tentativi)',
};

export function WizardAgentBehaviorSelect({
  agentBehavior,
  onAgentBehaviorChange,
}: {
  agentBehavior: AgentBehaviorMode;
  onAgentBehaviorChange: (mode: AgentBehaviorMode) => void;
}): React.ReactElement {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 items-center rounded-md border border-slate-600/60 px-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-900/50"
        title="Modalità Agent Behavior"
      >
        Agent Behavior: {agentBehavior}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[220px] rounded border border-slate-600 bg-slate-900 py-1 shadow-lg">
          {(['A', 'B', 'C'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800 ${
                agentBehavior === mode ? 'text-amber-300' : 'text-slate-300'
              }`}
              onClick={() => {
                onAgentBehaviorChange(mode);
                setOpen(false);
              }}
            >
              {BEHAVIOR_LABELS[mode]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function WizardCompileMappingBanner(): React.ReactElement | null {
  const ctx = useUseCaseWizardListToolbarOptional();
  if (!ctx?.compileMappingBanner?.trim()) return null;
  const ok = ctx.compileMappingBanner.startsWith('MAPPED');
  return (
    <div
      role="status"
      className={[
        'mb-2 w-full rounded-md border px-3 py-2 text-center text-sm font-bold tracking-wide',
        ok
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
          : 'border-amber-500/50 bg-amber-500/15 text-amber-100',
      ].join(' ')}
    >
      {ctx.compileMappingBanner}
    </div>
  );
}

export function WizardDialogControlToggle({
  lexicon,
  useCases,
  backendOutputSlotBindings,
  backendLinked = false,
}: {
  lexicon: ProjectSlotLexicon;
  useCases: readonly AIAgentUseCase[];
  backendOutputSlotBindings?: AgentBackendOutputSlotBindings;
  backendLinked?: boolean;
}): React.ReactElement | null {
  const ctx = useUseCaseWizardListToolbarOptional();
  const dock = useOptionalAIAgentEditorDock();
  const validation = React.useMemo(
    () =>
      computeCatalogCompileValidation(
        lexicon,
        useCases,
        backendOutputSlotBindings ?? emptyAgentBackendOutputSlotBindings(),
        backendLinked,
        {
          sendLeaves: dock?.backendSendParamLeaves ?? [],
          backendGroups: dock?.backendSendLeavesByTask,
        }
      ),
    [
      lexicon,
      useCases,
      backendOutputSlotBindings,
      backendLinked,
      dock?.backendSendParamLeaves,
      dock?.backendSendLeavesByTask,
    ]
  );
  if (!ctx) return null;

  const active = ctx.showSlotMappingPanel;

  return (
    <button
      type="button"
      aria-pressed={active}
      title={
        validation.status === 'valid'
          ? 'Dialog control: slot mapping'
          : `Dialog control — ${[...validation.slotReasons, ...validation.backendReasons].join('; ') || 'da completare'}`
      }
      onClick={() => {
        if (!active) {
          dock?.reconcileLexiconOrphansWithCatalog?.(useCases);
        }
        ctx.toggleSlotMappingPanel();
      }}
      className={[
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/80',
        active
          ? 'border-violet-400/50 bg-violet-500/15 text-violet-200'
          : 'border-slate-600/50 text-slate-300 hover:bg-slate-900/50',
      ].join(' ')}
    >
      <Layers size={14} aria-hidden />
      <span>Dialog control</span>
      {validation.status === 'valid' && validation.backendReasons.length === 0 ? (
        <Check size={14} className="text-emerald-400" aria-hidden />
      ) : (
        <AlertTriangle size={14} className="text-amber-400" aria-hidden />
      )}
    </button>
  );
}

/** @deprecated Usare {@link WizardDialogControlToggle}. */
export const WizardSlotMappingToggle = WizardDialogControlToggle;
