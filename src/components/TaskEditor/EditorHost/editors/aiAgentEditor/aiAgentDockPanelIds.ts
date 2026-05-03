/**
 * Stable Dockview panel ids for the AI Agent editor (left design stack, right dati/use case).
 */

export const AI_AGENT_DOCK_PANEL_IDS = {
  unified: 'ai_agent_editor_unified_desc',
  taskDesc: 'ai_agent_editor_task_desc',
  dati: 'ai_agent_editor_dati',
  useCases: 'ai_agent_editor_use_cases',
  iaRuntime: 'ai_agent_editor_ia_runtime',
  backends: 'ai_agent_editor_backends',
} as const;

/**
 * Document event: Fix compile / iaRuntime attiva il tab Dockview «Agent setup» prima di
 * `omnia:ia-runtime-focus` (focus diverso da tool/backend).
 */
export const OMNIA_ACTIVATE_AI_AGENT_AGENT_SETUP_TAB = 'omnia:activate-ai-agent-agent-setup-tab';

/** Document event: Fix compile tool/backend → tab Dockview «Backends» (ConvAI tool + SEND). */
export const OMNIA_ACTIVATE_AI_AGENT_BACKENDS_TAB = 'omnia:activate-ai-agent-backends-tab';

export interface DockPanelRef {
  readonly id: string;
}

/** True if this tab group contains Descrizione (post-gen) or unified pre-gen panel. */
export function dockGroupHasDesignAnchor(panels: readonly DockPanelRef[]): boolean {
  return panels.some(
    (p) => p.id === AI_AGENT_DOCK_PANEL_IDS.taskDesc || p.id === AI_AGENT_DOCK_PANEL_IDS.unified
  );
}

/** True if this tab group hosts the Use case panel (where Generate Usecase is shown). */
export function dockGroupHasUseCasesPanel(panels: readonly DockPanelRef[]): boolean {
  return panels.some((p) => p.id === AI_AGENT_DOCK_PANEL_IDS.useCases);
}
