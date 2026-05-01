/**
 * Whether a Dockview tab’s panel has meaningful content (drives grey vs accent tab styling).
 */

import type { AIAgentEditorDockContextValue } from './AIAgentEditorDockContext';
import { AI_AGENT_TASK_DESCRIPTION_PLACEHOLDER } from './constants';
import { effectiveFromRevisionMask } from './effectiveFromRevisionMask';
import {
  AGENT_STRUCTURED_SECTION_IDS,
  type AgentStructuredSectionId,
} from './agentStructuredSectionIds';
import { AI_AGENT_DOCK_PANEL_IDS } from './aiAgentDockPanelIds';

function isStructuredSectionId(id: string): id is AgentStructuredSectionId {
  return (AGENT_STRUCTURED_SECTION_IDS as readonly string[]).includes(id);
}

export function isAiAgentDockPanelContentFilled(
  panelId: string,
  ctx: AIAgentEditorDockContextValue
): boolean {
  switch (panelId) {
    case 'ai_agent_editor_unified_desc':
    case 'ai_agent_editor_task_desc': {
      const d = ctx.designDescription.trim();
      if (!d) return false;
      if (d === AI_AGENT_TASK_DESCRIPTION_PLACEHOLDER.trim()) return false;
      return true;
    }
    case 'prompt_finale':
      return (
        ctx.composedRuntimeMarkdown.trim().length > 0 ||
        ctx.agentRuntimeCompactJson.trim().length > 0
      );
    case 'ai_agent_editor_dati':
      return ctx.proposedFields.length > 0;
    case 'ai_agent_editor_use_cases':
      return ctx.useCases.length > 0;
    case AI_AGENT_DOCK_PANEL_IDS.iaRuntime:
      return ctx.iaRuntimeLoadedFrom === 'saved_override';
    case AI_AGENT_DOCK_PANEL_IDS.backends:
      return true;
    default: {
      if (isStructuredSectionId(panelId)) {
        const slice = ctx.structuredSectionsState[panelId];
        if (!slice) return false;
        const t = effectiveFromRevisionMask(
          slice.promptBaseText,
          slice.deletedMask,
          slice.inserts
        ).trim();
        return t.length > 0;
      }
      return true;
    }
  }
}
