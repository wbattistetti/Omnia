/**
 * Lucide icons and Tailwind text classes for AI Agent Dockview tabs (icon + caption share color).
 */

import React from 'react';
import type { LucideProps } from 'lucide-react';
import {
  Database,
  FileText,
  GitBranch,
  ListOrdered,
  MessageSquareMore,
  ScrollText,
  Shield,
  SlidersHorizontal,
  Wrench,
} from 'lucide-react';
import { AGENT_STRUCTURED_SECTION_TAB_TITLE } from './agentStructuredSectionIds';

const EMPTY = 'text-slate-500';

/** Filled: accent matches tab role; empty: grey icon + grey caption. */
const FILLED = {
  desc: 'text-sky-300',
  behaviorFlow: 'text-sky-300',
  positive: 'text-emerald-400',
  negative: 'text-red-400',
  correction: 'text-orange-400',
  conversational: 'text-cyan-300',
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
    case 'behavior_spec':
      return {
        icon: Ic(SlidersHorizontal, c(FILLED.behaviorFlow)),
        titleClassName: c(FILLED.behaviorFlow),
      };
    case 'operational_sequence':
      return {
        icon: Ic(ListOrdered, c(FILLED.behaviorFlow)),
        titleClassName: c(FILLED.behaviorFlow),
      };
    case 'positive_constraints':
      return {
        icon: Ic(Shield, c(FILLED.positive)),
        titleClassName: c(FILLED.positive),
      };
    case 'negative_constraints':
      return {
        icon: Ic(Shield, c(FILLED.negative)),
        titleClassName: c(FILLED.negative),
      };
    case 'correction_rules':
      return {
        icon: Ic(Wrench, c(FILLED.correction)),
        titleClassName: c(FILLED.correction),
      };
    case 'conversational_state': {
      const hint = AGENT_STRUCTURED_SECTION_TAB_TITLE.conversational_state;
      return {
        icon: Ic(MessageSquareMore, c(FILLED.conversational)),
        titleClassName: c(FILLED.conversational),
        nativeTitle: hint,
      };
    }
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
