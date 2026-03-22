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
  /** JSON string: per-section revision snapshots (canonical base + mask + inserts). */
  agentStructuredSectionsJson: string;
  outputVariableMappings: Record<string, string>;
  agentProposedFields: AIAgentProposedVariable[];
  agentSampleDialogue: AIAgentDesignSampleTurn[];
  agentInitialStateTemplateJson: string;
  agentDesignHasGeneration: boolean | undefined;
  agentLogicalStepsJson: string;
  agentUseCasesJson: string;
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
    agentDesignHasGeneration:
      typeof r?.agentDesignHasGeneration === 'boolean' ? r.agentDesignHasGeneration : undefined,
    agentLogicalStepsJson: String(r?.agentLogicalStepsJson ?? ''),
    agentUseCasesJson: String(r?.agentUseCasesJson ?? ''),
    logicalSteps: parseAgentLogicalStepsJson(String(r?.agentLogicalStepsJson ?? '')),
    useCases: parseAgentUseCasesJson(String(r?.agentUseCasesJson ?? '')),
  };
}

/**
 * Whether the user has already run at least one successful generation (explicit flag or inferred).
 */
export function resolveHasAgentGeneration(snapshot: AIAgentTaskSnapshot): boolean {
  return (
    snapshot.agentDesignHasGeneration ??
    (snapshot.agentProposedFields.length > 0 || snapshot.agentPrompt.trim().length > 0)
  );
}
