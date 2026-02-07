// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { getIsTesting } from '@responseEditor/testingState';
import { applyNodeUpdate, updateDockTreeWithTaskTree, saveTaskAsync } from '@responseEditor/features/node-editing/core/applyNodeUpdate';
import { useTaskTreeStore } from '@responseEditor/core/state';
import type { Task, TaskTree } from '@types/taskTypes';

export interface UseUpdateSelectedNodeParams {
  selectedNodePath: {
    mainIndex: number;
    subIndex?: number;
  } | null;
  selectedRoot: boolean;
  // ✅ FASE 3: Parametri opzionali rimossi - store è single source of truth
  task?: Task | null | undefined;
  currentProjectId: string | null;
  tabId?: string;
  setDockTree?: (updater: (prev: any) => any) => void;
  setSelectedNode: React.Dispatch<React.SetStateAction<any>>;
  setTaskTreeVersion?: React.Dispatch<React.SetStateAction<number>>; // Opzionale - per backward compatibility
}

/**
 * Hook that provides the updateSelectedNode callback.
 *
 * ✅ FASE 3: Completamente migrato a Zustand store (single source of truth)
 * - Usa taskTreeFromStore come unica fonte
 * - Aggiorna solo lo store (non taskTreeRef)
 * - Rimossi completamente taskTreeRef e taskTree prop
 */
export function useUpdateSelectedNode(params: UseUpdateSelectedNodeParams) {
  const {
    selectedNodePath,
    selectedRoot,
    task,
    currentProjectId,
    tabId,
    setDockTree,
    setSelectedNode,
    setTaskTreeVersion, // Opzionale - per backward compatibility
  } = params;

  // ✅ FASE 2.3: Use Zustand store as SINGLE source of truth
  const { setTaskTree, incrementVersion } = useTaskTreeStore();

  const updateSelectedNode = useCallback((updater: (node: any) => any, notifyProvider: boolean = true) => {
    // CRITICAL: Block structural mutations during batch testing
    if (getIsTesting()) {
      console.log('[updateSelectedNode] Blocked: batch testing active');
      return;
    }

    setSelectedNode((prev: any) => {
      if (!prev || !selectedNodePath) {
        return prev;
      }

      const updated = updater(prev) || prev;

      // ✅ FIX 1: Guard - Evita aggiornamenti se il nodo non è cambiato
      // Confronta solo ID e contenuto critico (non tutto l'oggetto per performance)
      if (prev === updated) {
        return prev; // Riferimento identico, nessun cambiamento
      }

      // Deep equality check solo per proprietà critiche (più leggero di deepEqual completo)
      const nodeIdChanged = prev.id !== updated.id || prev.templateId !== updated.templateId;
      const dataContractChanged = prev.dataContract !== updated.dataContract;
      const nlpProfileChanged = prev.nlpProfile !== updated.nlpProfile;
      const stepsChanged = prev.steps !== updated.steps;
      const testNotesChanged = prev.testNotes !== updated.testNotes;

      // Se nessuna proprietà critica è cambiata, non aggiornare
      if (!nodeIdChanged && !dataContractChanged && !nlpProfileChanged && !stepsChanged && !testNotesChanged) {
        // ✅ CRITICAL: Log per debug (rimuovere dopo fix)
        if (localStorage.getItem('debug.updateSelectedNode') === '1') {
          console.log('[updateSelectedNode] ⚠️ Guard triggered - node unchanged, skipping update', {
            nodeId: prev.id,
            prevRef: prev,
            updatedRef: updated
          });
        }
        return prev; // Non aggiornare nulla
      }

      // LOG: Always log dataContract comparison (even if unchanged)
      const updatedRegex = updated.dataContract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0];
      if (dataContractChanged && updatedRegex) {
        console.log('[REGEX] UPDATE - updateSelectedNode', {
          nodeId: updated.id,
          regexPattern: updatedRegex
        });
      }

      // ✅ FASE 2.3: Leggi taskTreeFromStore dentro il callback (non come dipendenza)
      // Questo evita che il callback venga ricreato quando taskTreeFromStore cambia
      const taskTreeFromStore = useTaskTreeStore.getState().taskTree;

      // ✅ FASE 2.3: Usa solo store - no fallback chain
      const currentTaskTree = taskTreeFromStore;
      const result = applyNodeUpdate({
        prevNode: prev,
        updatedNode: updated,
        selectedNodePath,
        selectedRoot,
        currentTaskTree,
        task,
        currentProjectId,
        tabId,
      });

      // If validation failed, return previous node
      if (result.validationFailed) {
        alert(`Invalid structure: ${result.validationError}`);
        return prev;
      }

      // ✅ FASE 2.3: Update only store (single source of truth)
      setTaskTree(result.updatedTaskTree);

      // LOG: Verify nlpProfile.examples is present in updated TaskTree after update
      const { mainIndex } = selectedNodePath;
      const taskTreeRefNlpProfileExamples = result.updatedTaskTree?.nodes?.[mainIndex]?.nlpProfile?.examples;
      if (taskTreeRefNlpProfileExamples) {
        console.log('[EXAMPLES] UPDATE - Verified in updated TaskTree', {
          nodeId: updated.id,
          mainIndex,
          hasNlpProfile: !!result.updatedTaskTree?.nodes?.[mainIndex]?.nlpProfile,
          hasNlpProfileExamples: !!taskTreeRefNlpProfileExamples,
          nlpProfileExamplesCount: taskTreeRefNlpProfileExamples.length,
          nlpProfileExamples: taskTreeRefNlpProfileExamples.slice(0, 3)
        });
      }

      // STEP 4: Update dockTree immediately (SOURCE OF TRUTH) - only if available
      if (result.shouldUpdateDockTree && tabId && setDockTree) {
        setDockTree(prev => updateDockTreeWithTaskTree(prev, tabId, result.updatedTaskTree));
      }

      // STEP 5: Implicit and immediate save (ALWAYS, even without tabId/setDockTree)
      // Every modification is saved immediately in taskRepository to ensure persistence
      if (result.shouldSave && result.saveKey && result.taskInstance !== undefined) {
        // Save asynchronously (don't block UI)
        void saveTaskAsync(
          result.saveKey,
          result.updatedTaskTree,
          result.taskInstance,
          currentProjectId
        );
      }

      // ✅ FASE 2.3: Update steps in store only
      // This is needed because applyNodeUpdate mutates task.steps
      if (task && result.updatedTaskTree) {
        const nodeTemplateId = updated.templateId || updated.id;
        if (nodeTemplateId && updated.steps) {
          // Get the steps dict from task.steps (already updated by applyNodeUpdate)
          const nodeStepsDict = task.steps?.[nodeTemplateId];
          if (nodeStepsDict) {
            // ✅ FASE 2.3: Update store with steps
            const updatedTaskTreeWithSteps = {
              ...result.updatedTaskTree,
              steps: {
                ...(result.updatedTaskTree.steps || {}),
                [nodeTemplateId]: nodeStepsDict
              }
            };
            setTaskTree(updatedTaskTreeWithSteps);
          }
        }
      }

      // ✅ FASE 2.3: Use store incrementVersion (single source of truth)
      incrementVersion();
      // Keep setTaskTreeVersion for backward compatibility (if provided)
      if (setTaskTreeVersion) {
        setTaskTreeVersion(v => v + 1);
      }

      try {
        if (localStorage.getItem('debug.nodeSync') === '1') {
          const steps = updated?.steps || [];
          const escalationsCount = steps.reduce((acc: number, step: any) =>
            acc + (step?.escalations?.length || 0), 0);
          const tasksCount = steps.reduce((acc: number, step: any) =>
            acc + (step?.escalations?.reduce((a: number, esc: any) =>
              a + (esc?.tasks?.length || 0), 0) || 0), 0);
          console.log('[NODE_SYNC][UPDATE] ✅ selectedNode updated + dockTree updated', {
            stepsCount: steps.length,
            escalationsCount,
            tasksCount
          });
        }
      } catch { }

      return result.updatedNode;
    });
  }, [
    selectedNodePath,
    selectedRoot,
    tabId,
    setDockTree,
    task,
    currentProjectId,
    setSelectedNode,
    setTaskTreeVersion,
    setTaskTree,
    incrementVersion
  ]);

  return updateSelectedNode;
}
