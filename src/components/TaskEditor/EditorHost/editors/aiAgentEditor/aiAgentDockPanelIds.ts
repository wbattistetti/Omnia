/**
 * Stable Dockview panel ids for the AI Agent editor (left design stack, right dati/use case).
 */

export const AI_AGENT_DOCK_PANEL_IDS = {
  unified: 'ai_agent_editor_unified_desc',
  taskDesc: 'ai_agent_editor_task_desc',
  dati: 'ai_agent_editor_dati',
  useCases: 'ai_agent_editor_use_cases',
  iaRuntime: 'ai_agent_editor_ia_runtime',
} as const;

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
