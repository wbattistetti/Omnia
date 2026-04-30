/**
 * Maps persisted Task fields into a normalized snapshot for the AI Agent editor.
 */

import type { AIAgentProposedVariable, AIAgentDesignSampleTurn } from '@types/aiAgentDesign';
import type { AIAgentLogicalStep, AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  parseAgentLogicalStepsJson,
  parseAgentUseCasesJson,
} from '@types/aiAgentUseCases';
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
  agentDesignHasGeneration: boolean | undefined;
  agentLogicalStepsJson: string;
  agentUseCasesJson: string;
  agentIaRuntimeOverrideJson: string;
  agentImmediateStart: boolean;
  logicalSteps: AIAgentLogicalStep[];
  useCases: AIAgentUseCase[];
}

/**
 * Reads flat `Task` agent* fields from a raw repository row.
 */
export function buildTaskSnapshotFromRaw(raw: unknown): AIAgentTaskSnapshot {
  const r = raw as Record<string, unknown> | null | undefined;
  const mappings = r?.outputVariableMappings;
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
    agentDesignHasGeneration:
      typeof r?.agentDesignHasGeneration === 'boolean' ? r.agentDesignHasGeneration : undefined,
    agentLogicalStepsJson: String(r?.agentLogicalStepsJson ?? ''),
    agentUseCasesJson: String(r?.agentUseCasesJson ?? ''),
    agentIaRuntimeOverrideJson: String(r?.agentIaRuntimeOverrideJson ?? ''),
    agentImmediateStart: r?.agentImmediateStart === true,
    logicalSteps: parseAgentLogicalStepsJson(String(r?.agentLogicalStepsJson ?? '')),
    useCases: parseAgentUseCasesJson(String(r?.agentUseCasesJson ?? '')),
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
