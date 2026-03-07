// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Messages Generation Actions
 *
 * Pure functions for generating messages in parallel for all tasks.
 * Extracted from wizardActions.ts to improve modularity and maintainability.
 */

import type { WizardStore } from '../store/wizardStore';
import type { WizardTaskTreeNode } from '../types';
import { generateAllMessagesForNode } from '../api/wizardApi';

export interface MessagesCounter {
  completed: number;
  total: number;
}

export interface MessagesProgressCallback {
  (phase: 'messages', taskId: string): void;
}

/**
 * Generates messages for all tasks in parallel
 *
 * @param store - Wizard store instance
 * @param allTasks - All tasks to generate messages for
 * @param locale - Locale for generation
 * @param counter - Counter object to track progress
 * @param onPhaseComplete - Callback when phase completes or progress updates
 * @param allPhasesCompleteCheck - Function to check if all phases are complete
 */
export async function runMessagesGeneration(
  store: WizardStore,
  allTasks: WizardTaskTreeNode[],
  locale: string,
  counter: MessagesCounter,
  onPhaseComplete?: MessagesProgressCallback,
  allPhasesCompleteCheck?: () => boolean
): Promise<void> {
  // Initialize all tasks to pending
  allTasks.forEach(task => {
    store.updateTaskPipelineStatus(task.id, 'messages', 'pending');
  });

  // Initialize counter
  counter.completed = 0;
  counter.total = allTasks.length;
  store.updatePhaseCounter('messages', 0, allTasks.length);

  // ✅ FASE 1: Crea strutture deterministiche per tutti i nodi (senza testi)
  const { createNodeStructure, associateTextsToStructure } = await import('../services/TemplateCreationService');
  const nodeStructures = new Map<string, any>();
  allTasks.forEach(task => {
    const structure = createNodeStructure(task);
    nodeStructures.set(task.id, structure);
  });

  // Update progress function
  const updatePhaseProgress = () => {
    counter.completed++;
    const progress = Math.round((counter.completed / counter.total) * 100);

    store.updatePhaseCounter('messages', counter.completed, counter.total);

    if (counter.completed === counter.total) {
      // Phase completed
      onPhaseComplete?.('messages', 'phase-complete-messages');

      // Check if ALL phases are complete
      if (allPhasesCompleteCheck && allPhasesCompleteCheck()) {
        onPhaseComplete?.('messages', 'all-complete');
      }
    } else {
      // Phase in progress
      onPhaseComplete?.('messages', `${progress}%`);
    }
  };

  // ✅ FASE 2: Genera messaggi (1 chiamata AI per nodo)
  const messagesPromises = allTasks.map(task => {
    const structure = nodeStructures.get(task.id);
    if (!structure) {
      console.error(`[messages] No structure found for task ${task.id}`);
      return Promise.resolve();
    }

    return generateAllMessagesForNode(task, structure, locale)
      .then(async (messages) => {
        // ✅ CRITICAL: Messages must be saved to template.steps in memory when generated
        // Get template from DialogueTaskService (already created in FASE 2)
        const { DialogueTaskService } = await import('@services/DialogueTaskService');
        const template = DialogueTaskService.getTemplate(task.id);

        if (!template) {
          console.warn(`[messages] ⚠️ Template not found in memory for node "${task.label}" (${task.id})`);
        }

        // ✅ Associa testi ai GUID esistenti nella struttura (saves translations)
        // Recupera addTranslation dal window context se disponibile
        const addTranslation = typeof window !== 'undefined' && (window as any).__projectTranslationsContext
          ? (window as any).__projectTranslationsContext.addTranslation
          : undefined;
        associateTextsToStructure(structure, messages, task.id, addTranslation);

        // ✅ CRITICAL: Messages are saved to template.steps in memory (GUID already in structure)
        // Template.steps already contains the GUID structure from createTemplatesFromStructures
        // associateTextsToStructure saves the translations (GUID → text)
        // So messages are effectively saved in template.steps via GUID references
        console.log(`[messages] ✅ Messages generated for "${task.label}" (${task.id})`);
        console.log(`[messages] ℹ️ Messages saved to template.steps in memory (via GUID structure)`);

        store.updateTaskPipelineStatus(task.id, 'messages', 'completed');
        updatePhaseProgress();
      })
      .catch((error) => {
        // ✅ IMPROVED: Better error logging with full details
        const errorMessage = error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : JSON.stringify(error, null, 2);

        console.error(`[messages] Error generating messages for "${task.label}" (${task.id}):`, {
          errorMessage,
          errorStack: error instanceof Error ? error.stack : undefined,
          errorType: error?.constructor?.name || typeof error,
          taskId: task.id,
          taskLabel: task.label
        });

        console.error(`[messages] Error details: ${errorMessage}`);

        store.updateTaskPipelineStatus(task.id, 'messages', 'failed');
        // Don't increment counter on error
      });
  });

  // Wait for all messages to complete
  await Promise.all(messagesPromises);
}
