/**
 * Nested Dockview for structured sections only — used by `AIAgentStructuredSectionsPanel` (e.g. legacy `AIAgentLeftColumn`).
 * The main task editor uses a single unified Dockview in `AIAgentEditorDockShell` instead.
 */

import React from 'react';
import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview';
import 'dockview/dist/styles/dockview.css';
import { AIAgentNonClosableDockTab } from './AIAgentNonClosableDockTab';
import {
  AGENT_STRUCTURED_SECTION_IDS,
  AGENT_STRUCTURED_SECTION_LABELS,
  type AgentStructuredSectionId,
} from './agentStructuredSectionIds';
import { AgentSectionDockPanel, PromptFinaleDockPanel } from './AIAgentStructuredSectionsDockPanels';

const PROMPT_FINALE_PANEL_ID = 'prompt_finale';

type DockPanelDef = {
  id: string;
  component: 'agentSection' | 'promptFinale';
  title: string;
  params: { sectionId?: AgentStructuredSectionId };
};

function buildPanelDefinitions(): DockPanelDef[] {
  const sections: DockPanelDef[] = AGENT_STRUCTURED_SECTION_IDS.map((sectionId) => ({
    id: sectionId,
    component: 'agentSection',
    title: AGENT_STRUCTURED_SECTION_LABELS[sectionId],
    params: { sectionId },
  }));
  return [
    ...sections,
    {
      id: PROMPT_FINALE_PANEL_ID,
      component: 'promptFinale',
      title: 'Prompt finale',
      params: {},
    },
  ];
}

function initDockFromScratch(api: DockviewApi): void {
  api.clear();
  const panels = buildPanelDefinitions();
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
};

export interface AIAgentStructuredSectionsDockviewProps {
  /** Changing this remounts the dock (e.g. switched task in editor). */
  layoutKey: string;
  /** Fills parent flex panel (outer editor dock) instead of a fixed min/max height. */
  embedded?: boolean;
}

export function AIAgentStructuredSectionsDockview({ layoutKey, embedded = false }: AIAgentStructuredSectionsDockviewProps) {
  const onReady = React.useCallback((event: DockviewReadyEvent) => {
    initDockFromScratch(event.api);
  }, []);

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
        key={layoutKey}
        className="flex-1 min-h-0 h-full"
        components={DOCK_COMPONENTS}
        defaultTabComponent={AIAgentNonClosableDockTab}
        onReady={onReady}
      />
    </div>
  );
}
