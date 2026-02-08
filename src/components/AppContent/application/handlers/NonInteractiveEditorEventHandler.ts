// Application layer: NonInteractiveEditor event handler
// Handles nonInteractiveEditor:open events and prepares DockTab

import type { DockTab } from '@dock/types';
import type { NonInteractiveEditorOpenEvent } from '../../domain/editorEvents';
import { validateNonInteractiveEditorEvent } from '../../domain/editorEvents';
import { taskRepository } from '@services/TaskRepository';

export class NonInteractiveEditorEventHandler {
  /**
   * Handles nonInteractiveEditor:open event
   */
  handle(event: NonInteractiveEditorOpenEvent): {
    tabId: string;
    dockTab: DockTab;
  } {
    // Validate event
    if (!validateNonInteractiveEditorEvent(event)) {
      throw new Error('Invalid NonInteractiveEditorOpenEvent');
    }

    // Read message text from Task
    const task = taskRepository.getTask(event.instanceId);
    if (!task) {
      throw new Error(`Task not found: ${event.instanceId}`);
    }

    const template = task.text || '';
    const tabId = `ni_${event.instanceId}`;

    const dockTab: DockTab = {
      id: tabId,
      title: event.title || 'Agent message',
      type: 'nonInteractive',
      instanceId: event.instanceId,
      value: { template, samples: {}, vars: [] },
      accentColor: event.accentColor,
    };

    return {
      tabId,
      dockTab,
    };
  }
}
