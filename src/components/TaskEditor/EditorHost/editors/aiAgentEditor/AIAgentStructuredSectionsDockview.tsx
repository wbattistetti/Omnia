/**
 * Nested Dockview for structured sections only — used by `AIAgentStructuredSectionsPanel`
 * (e.g. legacy `AIAgentLeftColumn`). Il main task editor non usa più Dockview: è renderizzato
 * dal `AIAgentConstructionWizardShell` (vedi `aiAgentEditor/constructionWizard/`).
 */

import React from 'react';
import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview';
import 'dockview/dist/styles/dockview.css';
import { AIAgentNonClosableDockTab } from './AIAgentNonClosableDockTab';
import {
  AGENT_STRUCTURED_DOCK_TAB_IDS,
  AGENT_STRUCTURED_SECTION_LABELS,
  type AgentStructuredSectionId,
} from './agentStructuredSectionIds';
import {
  AgentSectionDockPanel,
  AIAgentDescriptionDockPanel,
  PromptFinaleDockPanel,
} from './AIAgentStructuredSectionsDockPanels';

const PROMPT_FINALE_PANEL_ID = 'prompt_finale';
const DESCRIPTION_PANEL_ID = 'description';

type DockComponentName = 'agentSection' | 'promptFinale' | 'description';

type DockPanelDef = {
  id: string;
  component: DockComponentName;
  title: string;
  params: { sectionId?: AgentStructuredSectionId };
};

interface BuildOptions {
  /** Add a leading "Descrizione" tab (free-form textarea on `designDescription`). */
  includeDescriptionLeadingTab: boolean;
  /** Skip structured section panels (Scopo, Sequenza, …) AND the Prompt Finale tab. */
  omitStructuredSections: boolean;
}

function buildPanelDefinitions(opts: BuildOptions): DockPanelDef[] {
  const panels: DockPanelDef[] = [];
  if (opts.includeDescriptionLeadingTab) {
    panels.push({
      id: DESCRIPTION_PANEL_ID,
      component: 'description',
      title: 'Descrizione',
      params: {},
    });
  }
  if (!opts.omitStructuredSections) {
    AGENT_STRUCTURED_DOCK_TAB_IDS.forEach((sectionId) => {
      panels.push({
        id: sectionId,
        component: 'agentSection',
        title: AGENT_STRUCTURED_SECTION_LABELS[sectionId],
        params: { sectionId },
      });
    });
    panels.push({
      id: PROMPT_FINALE_PANEL_ID,
      component: 'promptFinale',
      title: 'Prompt Finale',
      params: {},
    });
  }
  return panels;
}

function initDockFromScratch(api: DockviewApi, opts: BuildOptions): void {
  api.clear();
  const panels = buildPanelDefinitions(opts);
  if (panels.length === 0) return;

  const [first, ...rest] = panels;
  // First panel seeds the root; remaining sections open as tabs in the same group (user can drag to split).
  api.addPanel({
    id: first.id,
    component: first.component,
    title: first.title,
    params: first.params,
  });

  rest.forEach((p, index) => {
    api.addPanel({
      id: p.id,
      component: p.component,
      title: p.title,
      params: p.params,
      position: { direction: 'within', referencePanel: first.id, index: index + 1 },
    });
  });
}

const DOCK_COMPONENTS = {
  agentSection: AgentSectionDockPanel,
  promptFinale: PromptFinaleDockPanel,
  description: AIAgentDescriptionDockPanel,
};

export interface AIAgentStructuredSectionsDockviewProps {
  /** Changing this remounts the dock (e.g. switched task in editor, toggled flags). */
  layoutKey: string;
  /** Fills parent flex panel (outer editor dock) instead of a fixed min/max height. */
  embedded?: boolean;
  /** Insert "Descrizione" textarea as the first tab (single-pane wizard step 1). */
  includeDescriptionLeadingTab?: boolean;
  /** Skip structured/prompt-finale tabs (pre-Crea Agente: only "Descrizione" is visible). */
  omitStructuredSections?: boolean;
}

export function AIAgentStructuredSectionsDockview({
  layoutKey,
  embedded = false,
  includeDescriptionLeadingTab = false,
  omitStructuredSections = false,
}: AIAgentStructuredSectionsDockviewProps) {
  // Inline opts so the onReady callback can read them without re-creating the
  // function (Dockview only calls onReady once per mount).
  const optsRef = React.useRef<BuildOptions>({
    includeDescriptionLeadingTab,
    omitStructuredSections,
  });
  optsRef.current = { includeDescriptionLeadingTab, omitStructuredSections };

  const onReady = React.useCallback((event: DockviewReadyEvent) => {
    initDockFromScratch(event.api, optsRef.current);
  }, []);

  // Force a full remount whenever the panel set changes (Dockview API does not
  // diff panels: we rebuild from scratch when toggling pre/post Crea Agente).
  const effectiveLayoutKey = `${layoutKey}|desc=${includeDescriptionLeadingTab ? 1 : 0}|str=${omitStructuredSections ? 0 : 1}`;

  const shellClass = embedded
    ? 'dockview-theme-dark rounded-md border border-slate-700 overflow-hidden flex-1 min-h-0 h-full w-full flex flex-col'
    : 'dockview-theme-dark rounded-md border border-slate-700 overflow-hidden min-h-[420px] h-[min(72vh,640px)] w-full flex flex-col';

  return (
    <div
      className={shellClass}
      style={
        {
          ...(embedded ? {} : { minHeight: 420 }),
          // Default dark theme hides sashes; make splitters discoverable for docking.
          ['--dv-sash-color']: 'rgba(148, 163, 184, 0.22)',
          ['--dv-active-sash-color']: 'rgba(167, 139, 250, 0.75)',
        } as React.CSSProperties
      }
    >
      <DockviewReact
        key={effectiveLayoutKey}
        className="flex-1 min-h-0 h-full"
        components={DOCK_COMPONENTS}
        defaultTabComponent={AIAgentNonClosableDockTab}
        onReady={onReady}
      />
    </div>
  );
}
