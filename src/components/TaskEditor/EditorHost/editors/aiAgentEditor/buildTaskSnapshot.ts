/**
 * Maps persisted Task fields into a normalized snapshot for the AI Agent editor.
 */

import type { AIAgentProposedVariable, AIAgentDesignSampleTurn } from '@types/aiAgentDesign';
import type { AIAgentLogicalStep, AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  parseAgentLogicalStepsJson,
  parseAgentUseCasesJson,
} from '@types/aiAgentUseCases';
import {
  type AgentConstructionPhase,
  type AgentWizardStepIndex,
  resolveAgentConstructionPhase,
  resolveAgentWizardCurrentStep,
} from '@domain/aiAgentConstruction/agentConstructionPhase';
import {
  type ConversationStyleSelections,
  migrateLegacyStyleExample,
} from '@domain/aiAgentConversationStyle/conversationStyleSelections';
import { EMPTY_OUTPUT_MAPPINGS } from './constants';

export interface AIAgentTaskSnapshot {
  agentDesignDescription: string;
  agentPrompt: string;
  agentPromptTargetPlatform: string;
  /** JSON string: per-section revision snapshots (canonical base + mask + inserts). */
  agentStructuredSectionsJson: string;
  outputVariableMappings: Record<string, string>;
  agentProposedFields: AIAgentProposedVariable[];
  agentSampleDialogue: AIAgentDesignSampleTurn[];
  agentInitialStateTemplateJson: string;
  agentRuntimeCompactJson: string;
  agentUseCaseGlobalStyleId: string;
  agentDesignHasGeneration: boolean | undefined;
  agentLogicalStepsJson: string;
  agentUseCasesJson: string;
  agentUseCaseWizardStateJson: string;
  agentIaRuntimeOverrideJson: string;
  agentImmediateStart: boolean;
  logicalSteps: AIAgentLogicalStep[];
  useCases: AIAgentUseCase[];
  /**
   * Phase machine top-level del Task Editor AI Agent. Risolta a partire dal campo persistito
   * `agentConstructionPhase` con fallback intelligente al vecchio flag `agentDesignHasGeneration`
   * (vedi `resolveAgentConstructionPhase`): backward-compat per task pre-feature.
   */
  agentConstructionPhase: AgentConstructionPhase;
  /**
   * Indice (0-based) dello step corrente del wizard di costruzione (0..4).
   * Quando la phase è `edit`, è solo un valore di partenza per la barra di navigazione rapida.
   */
  agentWizardCurrentStep: AgentWizardStepIndex;
  /**
   * Acknowledgement della schermata Tutor di benvenuto. True dopo il primo click su
   * «Cominciamo». Se la phase è `edit` o se il task è gi\u00e0 generato (legacy), forziamo true
   * (non ha senso mostrare la Tutor a chi ha gi\u00e0 superato la fase di costruzione).
   */
  agentWizardTutorAcknowledged: boolean;
  /**
   * **DEPRECATED** (v1 single-style): mantenuto solo come sorgente per la migrazione lazy
   * verso `agentConversationStyleSelections`. Le nuove call non lo scrivono più.
   */
  agentConversationStyleExample: string;
  /**
   * Checkbox **GLOBALE** «Lascia che Omnia scelga uno stile» — vive accanto alle pill
   * nel `ConversationStyleEditor`. Quando true, gli esempi sono opzionali per ogni
   * stile checkato (l'AI inventa frasi nello stile descritto).
   */
  agentConversationStyleAuto: boolean;
  /**
   * v2 multi-stile: una entry per ogni stile attivato dal designer (con override
   * descrizione e esempio). Caricata con migrazione lazy: se assente ma il vecchio
   * `agentConversationStyleExample` non è vuoto, seedata con `cortese` checkato.
   */
  agentConversationStyleSelections: ConversationStyleSelections;
  /**
   * Stile target di Upload (single per ora). `null` se non scelto → Upload disabilitato.
   */
  agentConversationDeployStyleId: string | null;
  /**
   * Toggle "Logga Use Case" (vedi `Task.agentLogUseCase` in `taskTypes.ts`). Default
   * `false` per non alterare il comportamento dei task già pubblicati.
   */
  agentLogUseCase: boolean;
}

/**
 * Reads flat `Task` agent* fields from a raw repository row.
 */
export function buildTaskSnapshotFromRaw(raw: unknown): AIAgentTaskSnapshot {
  const r = raw as Record<string, unknown> | null | undefined;
  const mappings = r?.outputVariableMappings;
  const persistedHasGen =
    typeof r?.agentDesignHasGeneration === 'boolean' ? r.agentDesignHasGeneration : false;
  return {
    agentDesignDescription: String(r?.agentDesignDescription ?? ''),
    agentPrompt: String(r?.agentPrompt ?? ''),
    agentPromptTargetPlatform: String(r?.agentPromptTargetPlatform ?? ''),
    agentStructuredSectionsJson: String(r?.agentStructuredSectionsJson ?? ''),
    outputVariableMappings:
      mappings && typeof mappings === 'object' && !Array.isArray(mappings)
        ? { ...(mappings as Record<string, string>) }
        : { ...EMPTY_OUTPUT_MAPPINGS },
    agentProposedFields: Array.isArray(r?.agentProposedFields)
      ? (r!.agentProposedFields as AIAgentProposedVariable[])
      : [],
    agentSampleDialogue: Array.isArray(r?.agentSampleDialogue)
      ? (r!.agentSampleDialogue as AIAgentDesignSampleTurn[])
      : [],
    agentInitialStateTemplateJson: String(r?.agentInitialStateTemplateJson ?? '{}'),
    agentRuntimeCompactJson: String(r?.agentRuntimeCompactJson ?? ''),
    agentUseCaseGlobalStyleId: String(r?.agentUseCaseGlobalStyleId ?? ''),
    agentDesignHasGeneration:
      typeof r?.agentDesignHasGeneration === 'boolean' ? r.agentDesignHasGeneration : undefined,
    agentLogicalStepsJson: String(r?.agentLogicalStepsJson ?? ''),
    agentUseCasesJson: String(r?.agentUseCasesJson ?? ''),
    agentUseCaseWizardStateJson: String(r?.agentUseCaseWizardStateJson ?? ''),
    agentIaRuntimeOverrideJson: String(r?.agentIaRuntimeOverrideJson ?? ''),
    agentImmediateStart: r?.agentImmediateStart === true,
    logicalSteps: parseAgentLogicalStepsJson(String(r?.agentLogicalStepsJson ?? '')),
    useCases: parseAgentUseCasesJson(String(r?.agentUseCasesJson ?? '')),
    agentConstructionPhase: resolveAgentConstructionPhase(
      r?.agentConstructionPhase,
      persistedHasGen
    ),
    agentWizardCurrentStep: resolveAgentWizardCurrentStep(r?.agentWizardCurrentStep),
    /**
     * Backward-compat: per task gi\u00e0 generati (`agentDesignHasGeneration === true`)
     * forziamo `tutorAcknowledged = true` cos\u00ec se per qualche motivo torniamo in fase
     * wizard non vediamo la Tutor di benvenuto inopportuna. Per task vergini rispettiamo
     * il valore persistito (default false).
     */
    agentWizardTutorAcknowledged:
      r?.agentWizardTutorAcknowledged === true || persistedHasGen === true,
    agentConversationStyleExample:
      typeof r?.agentConversationStyleExample === 'string'
        ? r.agentConversationStyleExample
        : '',
    agentConversationStyleAuto: r?.agentConversationStyleAuto === true,
    agentConversationStyleSelections: migrateLegacyStyleExample(
      r?.agentConversationStyleSelections as ConversationStyleSelections | undefined,
      typeof r?.agentConversationStyleExample === 'string'
        ? r.agentConversationStyleExample
        : null
    ),
    agentConversationDeployStyleId:
      typeof r?.agentConversationDeployStyleId === 'string'
        ? r.agentConversationDeployStyleId
        : null,
    agentLogUseCase: r?.agentLogUseCase === true,
  };
}

/**
 * Whether design-time generation has been run at least once.
 * Prefer persisted {@link AIAgentTaskSnapshot.agentDesignHasGeneration}; legacy rows without the flag
 * infer only from proposed fields (API output), not from composed prompt length (avoids false positives).
 */
export function resolveHasAgentGeneration(snapshot: AIAgentTaskSnapshot): boolean {
  if (typeof snapshot.agentDesignHasGeneration === 'boolean') {
    return snapshot.agentDesignHasGeneration;
  }
  return snapshot.agentProposedFields.length > 0;
}
