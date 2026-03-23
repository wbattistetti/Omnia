/**
 * Single Dockview shell for the AI Agent editor.
 * Initial layout: pre-gen only the designer "Descrizione" tab; post-gen left tab group (descrizione + sezioni + prompt finale)
 * and right tab group (Dati + Use case). Panels remain fully rearrangeable.
 */

import React from 'react';
import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview';
import 'dockview/dist/styles/dockview.css';
import { AIAgentNonClosableDockTab } from './AIAgentNonClosableDockTab';
import { AGENT_STRUCTURED_SECTION_IDS, AGENT_STRUCTURED_SECTION_LABELS } from './agentStructuredSectionIds';
import { AgentSectionDockPanel, PromptFinaleDockPanel } from './AIAgentStructuredSectionsDockPanels';
import { AIAgentEditorDockProvider, type AIAgentEditorDockContextValue } from './AIAgentEditorDockContext';
import {
  EditorDatiPanel,
  EditorTaskDescriptionPanel,
  EditorUnifiedDescriptionPanel,
  EditorUseCasesPanel,
} from './AIAgentEditorDockPanels';

const PROMPT_FINALE_PANEL_ID = 'prompt_finale';

/** Tab title for the task description field. */
const DESIGNER_DESC_TAB_TITLE = 'Descrizione';

const PANEL_IDS = {
  unified: 'ai_agent_editor_unified_desc',
  taskDesc: 'ai_agent_editor_task_desc',
  dati: 'ai_agent_editor_dati',
  useCases: 'ai_agent_editor_use_cases',
} as const;

const UNIFIED_DOCK_COMPONENTS = {
  editorUnifiedDescription: EditorUnifiedDescriptionPanel,
  editorTaskDescription: EditorTaskDescriptionPanel,
  editorDati: EditorDatiPanel,
  editorUseCases: EditorUseCasesPanel,
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
  for (const sectionId of AGENT_STRUCTURED_SECTION_IDS) {
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
    title: 'Prompt finale',
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
  const onReady = React.useCallback(
    (event: DockviewReadyEvent) => {
      initUnifiedDock(event.api, { hasAgentGeneration, showRightPanel });
    },
    [hasAgentGeneration, showRightPanel]
  );

  return (
    <AIAgentEditorDockProvider value={value}>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
