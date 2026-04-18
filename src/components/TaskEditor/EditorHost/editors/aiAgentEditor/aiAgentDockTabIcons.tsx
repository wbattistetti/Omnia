/**
 * Lucide icons and Tailwind text classes for AI Agent Dockview tabs (icon + caption share color).
 * Descrizione (user prompt) is styled distinctly from IR section tabs.
 */

import React from 'react';
import type { LucideProps } from 'lucide-react';
import {
  BookOpen,
  Database,
  GitBranch,
  Globe2,
  ListOrdered,
  Pencil,
  ScrollText,
  Shield,
  Sparkles,
  Target,
  UserCircle,
} from 'lucide-react';
import { AGENT_STRUCTURED_SECTION_TAB_TITLE } from './agentStructuredSectionIds';

const EMPTY = 'text-slate-500';

/** Tooltip on the Descrizione tab (user-authored prompt, not IR). */
export const AI_AGENT_DESCRIZIONE_TAB_TOOLTIP =
  "Questo è il prompt iniziale scritto dall'utente. L'AI lo userà per generare lo Scopo e le altre sezioni strutturate.";

/** Filled: accent matches tab role; empty: grey icon + grey caption. */
const FILLED = {
  desc: 'text-amber-200',
  goal: 'text-sky-300',
  sequence: 'text-emerald-400',
  context: 'text-cyan-300',
  guardrails: 'text-amber-300',
  personality: 'text-violet-300',
  tone: 'text-fuchsia-300',
  promptFinale: 'text-green-400',
  examples: 'text-rose-300',
  dati: 'text-amber-300',
  useCases: 'text-violet-300',
} as const;

/** Distinct “human input” chrome for Descrizione (not IR); right edge separates from IR tabs. */
const USER_PROMPT_TAB_CONTAINER = [
  'rounded-lg border-2 border-amber-400/45',
  'bg-gradient-to-b from-slate-600/95 to-slate-900/90',
  'px-2 py-0.5 shadow-sm ring-1 ring-amber-500/15',
  'border-r-2 border-r-slate-500/45 pr-2 mr-2',
].join(' ');

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
  /** Extra classes on the tab root (e.g. Descrizione user-prompt chrome vs IR tabs). */
  tabContainerClassName?: string;
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
        icon: (
          <span className="inline-flex items-center gap-0.5 shrink-0" aria-hidden>
            {Ic(UserCircle, c(FILLED.desc))}
            {Ic(Pencil, c(FILLED.desc))}
          </span>
        ),
        titleClassName: `${c(FILLED.desc)} font-medium`,
        nativeTitle: AI_AGENT_DESCRIZIONE_TAB_TOOLTIP,
        tabContainerClassName: USER_PROMPT_TAB_CONTAINER,
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
    case 'examples':
      return {
        icon: Ic(BookOpen, c(FILLED.examples)),
        titleClassName: c(FILLED.examples),
        nativeTitle: AGENT_STRUCTURED_SECTION_TAB_TITLE.examples,
      };
    case 'prompt_finale':
      return {
        icon: Ic(ScrollText, c(FILLED.promptFinale)),
        titleClassName: c(FILLED.promptFinale),
        nativeTitle: 'Anteprima del prompt compilato (sola lettura).',
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
