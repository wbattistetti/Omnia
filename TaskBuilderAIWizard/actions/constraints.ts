// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Constraints Generation Actions
 *
 * Pure functions for generating constraints in parallel for all tasks.
 * Extracted from wizardActions.ts to improve modularity and maintainability.
 */

import type { WizardStore } from '../store/wizardStore';
import type { WizardTaskTreeNode } from '../types';
import { generateConstraints } from '../api/wizardApi';

export interface ConstraintsCounter {
  completed: number;
  total: number;
}

export interface ConstraintsProgressCallback {
  (phase: 'constraints', taskId: string): void;
}

/**
 * Generates constraints for all tasks in parallel
 *
 * @param store - Wizard store instance
 * @param allTasks - All tasks to generate constraints for
 * @param locale - Locale for generation
 * @param counter - Counter object to track progress
 * @param onPhaseComplete - Callback when phase completes or progress updates
 */
export async function runConstraintsGeneration(
  store: WizardStore,
  allTasks: WizardTaskTreeNode[],
  locale: string,
  counter: ConstraintsCounter,
  onPhaseComplete?: ConstraintsProgressCallback
): Promise<void> {
  const constraintsPayload = `Sto generando i constraints per: ${allTasks.map(n => n.label).join(', ')}…`;

  // Initialize all tasks to pending
  allTasks.forEach(task => {
    store.updateTaskPipelineStatus(task.id, 'constraints', 'pending');
  });

  // Initialize counter
  counter.completed = 0;
  counter.total = allTasks.length;
  store.updatePhaseCounter('constraints', 0, allTasks.length);

  // Update progress function
  const updatePhaseProgress = () => {
    counter.completed++;
    const progress = Math.round((counter.completed / counter.total) * 100);

    store.updatePhaseCounter('constraints', counter.completed, counter.total);

    if (counter.completed === counter.total) {
      // Phase completed
      onPhaseComplete?.('constraints', 'phase-complete-constraints');
    } else {
      // Phase in progress
      onPhaseComplete?.('constraints', `${progress}%`);
    }
  };

  // Generate constraints for all tasks in parallel
  const constraintsPromises = allTasks.map(task =>
    generateConstraints([task], undefined, locale)
      .then(constraints => {
        // ✅ CRITICAL: Constraints are already saved to templates in memory by AIGenerateConstraints
        // We don't save to store during editing - store is only updated on final save
        console.log(`[constraints] ✅ Constraints generated for "${task.label}" (${task.id}):`, constraints.length, 'constraints');
        console.log(`[constraints] ℹ️ Constraints are saved to template in memory (not to store)`);

        // ✅ Only update UI status, not data
        store.updateTaskPipelineStatus(task.id, 'constraints', 'completed');
        updatePhaseProgress();
      })
      .catch((error) => {
        // ✅ IMPROVED: Better error logging with full details
        const errorMessage = error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : JSON.stringify(error, null, 2);

        console.error(`[constraints] Error generating constraints for "${task.label}" (${task.id}):`, {
          errorMessage,
          errorStack: error instanceof Error ? error.stack : undefined,
          errorType: error?.constructor?.name || typeof error,
          taskId: task.id,
          taskLabel: task.label
        });

        console.error(`[constraints] Error details: ${errorMessage}`);

        store.updateTaskPipelineStatus(task.id, 'constraints', 'failed');
        // Don't increment counter on error
      })
  );

  // Wait for all constraints to complete
  await Promise.all(constraintsPromises);
}
