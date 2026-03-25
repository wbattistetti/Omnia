/**
 * Lucide icons and Tailwind text classes for AI Agent Dockview tabs (icon + caption share color).
 */

import React from 'react';
import type { LucideProps } from 'lucide-react';
import {
  Database,
  FileText,
  GitBranch,
  Globe2,
  ListOrdered,
  ScrollText,
  Shield,
  Sparkles,
  Target,
  UserCircle,
} from 'lucide-react';
import { AGENT_STRUCTURED_SECTION_TAB_TITLE } from './agentStructuredSectionIds';

const EMPTY = 'text-slate-500';

/** Filled: accent matches tab role; empty: grey icon + grey caption. */
const FILLED = {
  desc: 'text-sky-300',
  goal: 'text-sky-300',
  sequence: 'text-emerald-400',
  context: 'text-cyan-300',
  guardrails: 'text-amber-300',
  personality: 'text-violet-300',
  tone: 'text-fuchsia-300',
  promptFinale: 'text-green-400',
  dati: 'text-amber-300',
  useCases: 'text-violet-300',
} as const;

function Ic(
  Icon: React.ComponentType<LucideProps>,
  className: string,
  extra?: Partial<LucideProps>
) {
  return <Icon size={14} strokeWidth={2} className={`shrink-0 ${className}`} aria-hidden {...extra} />;
}

export interface AiAgentDockTabPresentation {
  icon: React.ReactNode;
  /** Applied to tab title span (same tone as icon). */
  titleClassName: string;
  /** Optional native tooltip (e.g. Stato conversazionale). */
  nativeTitle?: string;
}

export function getAiAgentDockTabPresentation(
  panelId: string,
  filled: boolean
): AiAgentDockTabPresentation | null {
  const c = (accent: string) => (filled ? accent : EMPTY);

  switch (panelId) {
    case 'ai_agent_editor_unified_desc':
    case 'ai_agent_editor_task_desc':
      return {
        icon: Ic(FileText, c(FILLED.desc)),
        titleClassName: c(FILLED.desc),
      };
    case 'goal':
      return {
        icon: Ic(Target, c(FILLED.goal)),
        titleClassName: c(FILLED.goal),
        nativeTitle: AGENT_STRUCTURED_SECTION_TAB_TITLE.goal,
      };
    case 'operational_sequence':
      return {
        icon: Ic(ListOrdered, c(FILLED.sequence)),
        titleClassName: c(FILLED.sequence),
        nativeTitle: AGENT_STRUCTURED_SECTION_TAB_TITLE.operational_sequence,
      };
    case 'context':
      return {
        icon: Ic(Globe2, c(FILLED.context)),
        titleClassName: c(FILLED.context),
        nativeTitle: AGENT_STRUCTURED_SECTION_TAB_TITLE.context,
      };
    case 'constraints':
      return {
        icon: Ic(Shield, c(FILLED.guardrails)),
        titleClassName: c(FILLED.guardrails),
        nativeTitle: AGENT_STRUCTURED_SECTION_TAB_TITLE.constraints,
      };
    case 'personality':
      return {
        icon: Ic(UserCircle, c(FILLED.personality)),
        titleClassName: c(FILLED.personality),
        nativeTitle: AGENT_STRUCTURED_SECTION_TAB_TITLE.personality,
      };
    case 'tone':
      return {
        icon: Ic(Sparkles, c(FILLED.tone)),
        titleClassName: c(FILLED.tone),
        nativeTitle: AGENT_STRUCTURED_SECTION_TAB_TITLE.tone,
      };
    case 'prompt_finale':
      return {
        icon: Ic(ScrollText, c(FILLED.promptFinale)),
        titleClassName: c(FILLED.promptFinale),
      };
    case 'ai_agent_editor_dati':
      return {
        icon: Ic(Database, c(FILLED.dati)),
        titleClassName: c(FILLED.dati),
      };
    case 'ai_agent_editor_use_cases':
      return {
        icon: Ic(GitBranch, c(FILLED.useCases)),
        titleClassName: c(FILLED.useCases),
      };
    default:
      return null;
  }
}

/** @deprecated use getAiAgentDockTabPresentation */
export function getAiAgentDockTabIcon(panelId: string): React.ReactNode {
  const p = getAiAgentDockTabPresentation(panelId, true);
  return p?.icon ?? null;
}
