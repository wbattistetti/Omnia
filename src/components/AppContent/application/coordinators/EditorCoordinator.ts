// Application layer: Editor Coordinator
// Orchestrates all editor event handlers

import type { DockNode } from '@dock/types';
import { TaskEditorEventHandler, type TaskEditorEventHandlerParams } from '../handlers/TaskEditorEventHandler';
import { ConditionEditorEventHandler, type ConditionEditorEventHandlerParams } from '../handlers/ConditionEditorEventHandler';
import { NonInteractiveEditorEventHandler } from '../handlers/NonInteractiveEditorEventHandler';
import { openBottomDockedTab } from '../../infrastructure/docking/DockingHelpers';
import { upsertAddNextTo, activateTab } from '@dock/ops';
import type { TaskEditorOpenEvent } from '../../domain/editorEvents';
import type { ConditionEditorOpenEvent } from '../../domain/editorEvents';
import type { NonInteractiveEditorOpenEvent } from '../../domain/editorEvents';

export interface EditorCoordinatorParams {
  currentProjectId?: string;
  projectData: any;
  pdUpdate: any;
}

export class EditorCoordinator {
  private taskEditorHandler: TaskEditorEventHandler;
  private conditionEditorHandler: ConditionEditorEventHandler;
  private nonInteractiveHandler: NonInteractiveEditorEventHandler;

  constructor(params: EditorCoordinatorParams) {
    this.taskEditorHandler = new TaskEditorEventHandler({
      currentProjectId: params.currentProjectId,
      pdUpdate: params.pdUpdate,
    });
    this.conditionEditorHandler = new ConditionEditorEventHandler({
      projectData: params.projectData,
      pdUpdate: params.pdUpdate,
    });
    this.nonInteractiveHandler = new NonInteractiveEditorEventHandler();
  }

  /**
   * Opens TaskEditor as bottom-docked panel
   */
  async openTaskEditor(
    tree: DockNode,
    event: TaskEditorOpenEvent
  ): Promise<DockNode> {
    const { tabId, dockTab, onExisting } = await this.taskEditorHandler.handle(event);
    return openBottomDockedTab(tree, {
      tabId,
      newTab: dockTab,
      onExisting,
    });
  }

  /**
   * Opens ConditionEditor as bottom-docked panel
   */
  async openConditionEditor(
    tree: DockNode,
    event: ConditionEditorOpenEvent
  ): Promise<DockNode> {
    const { tabId, dockTab } = await this.conditionEditorHandler.handle(event);
    return openBottomDockedTab(tree, {
      tabId,
      newTab: dockTab,
    });
  }

  /**
   * Opens NonInteractiveEditor as sibling tab (different behavior)
   */
  openNonInteractiveEditor(
    tree: DockNode,
    event: NonInteractiveEditorOpenEvent
  ): DockNode {
    const { tabId, dockTab } = this.nonInteractiveHandler.handle(event);
    // NonInteractive uses upsertAddNextTo instead of splitWithTab
    return upsertAddNextTo(tree, 'tab_main', dockTab);
  }
}
