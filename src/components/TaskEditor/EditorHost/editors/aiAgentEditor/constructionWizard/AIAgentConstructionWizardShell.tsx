/**
 * AI Agent Construction Wizard — Shell del Task Editor AI Agent.
 *
 * Wizard 7 step: Task → KB → Backend → Prompts → Error Handling → Dati → Voce
 */

import React from 'react';
import {
  type AgentWizardStepIndex,
  AGENT_WIZARD_FIRST_STEP_INDEX,
} from '@domain/aiAgentConstruction/agentConstructionPhase';
import { AGENT_WIZARD_STEPS_META, getAgentWizardStepMeta } from './agentWizardStepsMeta';
import { AIAgentConstructionStepper } from './AIAgentConstructionStepper';
import {
  EditorDatiPanel,
  EditorErrorHandlingPanel,
  EditorKnowledgeBasePanel,
  EditorUnifiedDescriptionPanel,
  EditorUseCasesPanel,
} from '../AIAgentEditorDockPanels';
import { EditorBackendsPanel } from '../EditorBackendsPanel';
import { EditorIaRuntimePanel } from '../EditorIaRuntimePanel';
import { EditorTaskCostsPanel } from '../EditorTaskCostsPanel';
import {
  ElevenLabsImportRecapBanner,
  type ElevenLabsImportRecapBannerProps,
} from './ElevenLabsImportRecapBanner';

export interface AIAgentConstructionWizardShellProps {
  readonly currentStep: AgentWizardStepIndex;
  readonly completion: readonly boolean[];
  readonly onSelectStep: (index: AgentWizardStepIndex) => void;
  readonly glowStepIndex?: AgentWizardStepIndex | null;
  readonly stepHeaderAction?: React.ReactNode;
  readonly costsActive?: boolean;
  readonly onSelectCosts?: () => void;
  readonly interfaceActive?: boolean;
  readonly onToggleInterface?: () => void;
  readonly taskId?: string;
  readonly taskLabel?: string;
  readonly deploySlot?: React.ReactNode;
  readonly reviewPublishSlot?: React.ReactNode;
  readonly bypassGating?: boolean;
  readonly elevenLabsImportRecap?: ElevenLabsImportRecapBannerProps['recap'] | null;
  readonly onDismissElevenLabsRecap?: () => void;
}

const STEP_RENDERERS: ReadonlyArray<() => React.ReactElement> = [
  () => <EditorUnifiedDescriptionPanel />,
  () => <EditorKnowledgeBasePanel />,
  () => <EditorBackendsPanel {...({} as unknown as React.ComponentProps<typeof EditorBackendsPanel>)} />,
  () => <EditorUseCasesPanel />,
  () => <EditorErrorHandlingPanel />,
  () => <EditorDatiPanel />,
  () => <EditorIaRuntimePanel {...({} as unknown as React.ComponentProps<typeof EditorIaRuntimePanel>)} />,
];

export function AIAgentConstructionWizardShell({
  currentStep,
  completion,
  onSelectStep,
  glowStepIndex = null,
  stepHeaderAction = null,
  costsActive = false,
  onSelectCosts,
  interfaceActive = false,
  onToggleInterface,
  taskId,
  taskLabel,
  deploySlot = null,
  reviewPublishSlot = null,
  bypassGating = false,
  elevenLabsImportRecap = null,
  onDismissElevenLabsRecap,
}: AIAgentConstructionWizardShellProps): React.ReactElement {
  const safeStep: AgentWizardStepIndex =
    STEP_RENDERERS[currentStep] !== undefined ? currentStep : AGENT_WIZARD_FIRST_STEP_INDEX;
  const meta = getAgentWizardStepMeta(safeStep);
  const renderStepBody = STEP_RENDERERS[safeStep];
  const stepTitle =
    interfaceActive && safeStep === 2 ? 'Interface agente (INPUT/OUTPUT)' : meta.title;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      <AIAgentConstructionStepper
        currentStep={safeStep}
        completion={completion}
        onSelectStep={onSelectStep}
        glowStepIndex={glowStepIndex}
        costsActive={costsActive}
        onSelectCosts={onSelectCosts}
        interfaceActive={interfaceActive}
        onToggleInterface={onToggleInterface}
        deploySlot={deploySlot}
        reviewPublishSlot={reviewPublishSlot}
        bypassGating={bypassGating}
      />
      {elevenLabsImportRecap && taskId && onDismissElevenLabsRecap ? (
        <ElevenLabsImportRecapBanner
          taskId={taskId}
          recap={elevenLabsImportRecap}
          onDismiss={onDismissElevenLabsRecap}
        />
      ) : null}
      {costsActive ? (
        <main className="flex-1 min-h-0 overflow-hidden">
          {typeof taskId === 'string' && taskId ? (
            <EditorTaskCostsPanel taskId={taskId} taskLabel={taskLabel || ''} />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-sm text-slate-400">
              Task non identificato: impossibile filtrare i costi.
            </div>
          )}
        </main>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="border-b border-slate-800 bg-slate-900/40 px-5 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-3">
              <span className="shrink-0 text-sm font-semibold uppercase tracking-wide text-violet-300">
                Passo {meta.displayNumber}/{AGENT_WIZARD_STEPS_META.length}
              </span>
              <h2 className="min-w-0 text-base font-semibold text-slate-100">{stepTitle}</h2>
              {stepHeaderAction ? (
                <div className="flex shrink-0 items-center">{stepHeaderAction}</div>
              ) : null}
            </div>
            {meta.tutorial.trim().length > 0 ? (
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
                {meta.tutorial}
              </p>
            ) : null}
          </header>
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{renderStepBody()}</main>
        </div>
      )}
    </div>
  );
}
