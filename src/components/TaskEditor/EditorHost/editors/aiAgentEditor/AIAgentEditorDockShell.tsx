/**
 * Single Dockview shell for the AI Agent editor.
 * Initial layout: pre-gen only the designer "Descrizione" tab; post-gen left tab group (descrizione + sezioni + prompt finale)
 * and right tab group (Dati + Use case). Panels remain fully rearrangeable.
 */

import React from 'react';
import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview';
import 'dockview/dist/styles/dockview.css';
import { AIAgentNonClosableDockTab } from './AIAgentNonClosableDockTab';
import { AGENT_STRUCTURED_DOCK_TAB_IDS, AGENT_STRUCTURED_SECTION_LABELS } from './agentStructuredSectionIds';
import { AgentSectionDockPanel, PromptFinaleDockPanel } from './AIAgentStructuredSectionsDockPanels';
import { AIAgentEditorDockProvider, type AIAgentEditorDockContextValue } from './AIAgentEditorDockContext';
import {
  EditorDatiPanel,
  EditorTaskDescriptionPanel,
  EditorUnifiedDescriptionPanel,
  EditorUseCasesPanel,
} from './AIAgentEditorDockPanels';
import { EditorIaRuntimePanel } from './EditorIaRuntimePanel';
import { EditorBackendsPanel } from './EditorBackendsPanel';
import {
  AI_AGENT_DOCK_PANEL_IDS as PANEL_IDS,
  OMNIA_ACTIVATE_AI_AGENT_AGENT_SETUP_TAB,
  OMNIA_ACTIVATE_AI_AGENT_BACKENDS_TAB,
} from './aiAgentDockPanelIds';

const PROMPT_FINALE_PANEL_ID = 'prompt_finale';

/** Tab title for the task description field. */
const DESIGNER_DESC_TAB_TITLE = 'Descrizione';

const UNIFIED_DOCK_COMPONENTS = {
  editorUnifiedDescription: EditorUnifiedDescriptionPanel,
  editorTaskDescription: EditorTaskDescriptionPanel,
  editorDati: EditorDatiPanel,
  editorUseCases: EditorUseCasesPanel,
  editorIaRuntime: EditorIaRuntimePanel,
  editorBackends: EditorBackendsPanel,
  agentSection: AgentSectionDockPanel,
  promptFinale: PromptFinaleDockPanel,
};

/**
 * Seeds the left column as one tab group: designer description + all structured sections + prompt finale.
 * @returns Panel id to use as reference for splitting the right column (`dati`).
 */
function addLeftDesignTabGroup(api: DockviewApi): string {
  api.addPanel({
    id: PANEL_IDS.taskDesc,
    component: 'editorTaskDescription',
    title: DESIGNER_DESC_TAB_TITLE,
    params: {},
  });

  let nextIndex = 1;
  for (const sectionId of AGENT_STRUCTURED_DOCK_TAB_IDS) {
    api.addPanel({
      id: sectionId,
      component: 'agentSection',
      title: AGENT_STRUCTURED_SECTION_LABELS[sectionId],
      params: { sectionId },
      position: { direction: 'within', referencePanel: PANEL_IDS.taskDesc, index: nextIndex },
    });
    nextIndex += 1;
  }

  api.addPanel({
    id: PROMPT_FINALE_PANEL_ID,
    component: 'promptFinale',
    title: 'Prompt Finale',
    params: {},
    position: { direction: 'within', referencePanel: PANEL_IDS.taskDesc, index: nextIndex },
  });

  return PANEL_IDS.taskDesc;
}

function initUnifiedDock(
  api: DockviewApi,
  opts: { hasAgentGeneration: boolean; showRightPanel: boolean }
): void {
  api.clear();
  const { hasAgentGeneration, showRightPanel } = opts;

  if (!hasAgentGeneration) {
    api.addPanel({
      id: PANEL_IDS.unified,
      component: 'editorUnifiedDescription',
      title: DESIGNER_DESC_TAB_TITLE,
      params: {},
    });
    return;
  }

  const leftAnchorId = addLeftDesignTabGroup(api);

  if (!showRightPanel) {
    return;
  }

  api.addPanel({
    id: PANEL_IDS.dati,
    component: 'editorDati',
    title: 'Dati da raccogliere',
    params: {},
    position: { direction: 'right', referencePanel: leftAnchorId },
  });

  api.addPanel({
    id: PANEL_IDS.useCases,
    component: 'editorUseCases',
    title: 'Use case',
    params: {},
    position: { direction: 'within', referencePanel: PANEL_IDS.dati, index: 1 },
  });

  api.addPanel({
    id: PANEL_IDS.iaRuntime,
    component: 'editorIaRuntime',
    title: 'Agent setup',
    params: {},
    position: { direction: 'within', referencePanel: PANEL_IDS.dati, index: 2 },
  });

  api.addPanel({
    id: PANEL_IDS.backends,
    component: 'editorBackends',
    title: 'Backends',
    params: {},
    position: { direction: 'within', referencePanel: PANEL_IDS.dati, index: 3 },
  });
}

export interface AIAgentEditorDockShellProps {
  /** Remounts Dockview when editor phase / right column visibility changes. */
  layoutKey: string;
  hasAgentGeneration: boolean;
  showRightPanel: boolean;
  value: AIAgentEditorDockContextValue;
  generateError: string | null;
}

export function AIAgentEditorDockShell({
  layoutKey,
  hasAgentGeneration,
  showRightPanel,
  value,
  generateError,
}: AIAgentEditorDockShellProps) {
  const dockApiRef = React.useRef<DockviewApi | null>(null);

  const onReady = React.useCallback(
    (event: DockviewReadyEvent) => {
      initUnifiedDock(event.api, { hasAgentGeneration, showRightPanel });
      dockApiRef.current = event.api;
    },
    [hasAgentGeneration, showRightPanel]
  );

  React.useEffect(() => {
    const activateTab =
      (panelId: string) => () => {
        let attempts = 0;
        const tryActivate = () => {
          const api = dockApiRef.current;
          const panel = api?.getPanel(panelId);
          if (panel) {
            panel.api.setActive();
            return;
          }
          attempts += 1;
          if (attempts < 90) {
            window.setTimeout(tryActivate, 45);
          }
        };
        tryActivate();
      };
    const activateAgentSetupTab = activateTab(PANEL_IDS.iaRuntime);
    const activateBackendsTab = activateTab(PANEL_IDS.backends);
    document.addEventListener(OMNIA_ACTIVATE_AI_AGENT_AGENT_SETUP_TAB, activateAgentSetupTab, true);
    document.addEventListener(OMNIA_ACTIVATE_AI_AGENT_BACKENDS_TAB, activateBackendsTab, true);
    return () => {
      document.removeEventListener(OMNIA_ACTIVATE_AI_AGENT_AGENT_SETUP_TAB, activateAgentSetupTab, true);
      document.removeEventListener(OMNIA_ACTIVATE_AI_AGENT_BACKENDS_TAB, activateBackendsTab, true);
    };
  }, []);

  return (
    <AIAgentEditorDockProvider value={value}>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden ai-agent-editor-dock-shell">
        <div
          className="dockview-theme-dark flex-1 min-h-0 flex flex-col rounded-none border-0 overflow-hidden"
          style={
            {
              ['--dv-sash-color']: 'rgba(148, 163, 184, 0.22)',
              ['--dv-active-sash-color']: 'rgba(167, 139, 250, 0.75)',
            } as React.CSSProperties
          }
        >
          <DockviewReact
            key={layoutKey}
            className="flex-1 min-h-0 h-full"
            components={UNIFIED_DOCK_COMPONENTS}
            defaultTabComponent={AIAgentNonClosableDockTab}
            onReady={onReady}
          />
        </div>
        {generateError ? (
          <div className="shrink-0 rounded-md bg-red-950/50 border border-red-800 text-red-200 text-sm px-3 py-2 mx-3 mb-3">
            {generateError}
          </div>
        ) : null}
      </div>
    </AIAgentEditorDockProvider>
  );
}
