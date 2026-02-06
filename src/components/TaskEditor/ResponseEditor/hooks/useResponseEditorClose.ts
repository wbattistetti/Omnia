// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { saveTaskToRepository, saveTaskOnEditorClose } from '../modules/ResponseEditor/persistence/ResponseEditorPersistence';
import { getdataList } from '../ddtSelectors';
import DialogueTaskService from '../../../../services/DialogueTaskService';
import { closeTab } from '../../../../dock/ops';
import { useTaskTreeStore } from '../core/state';
import type { Task, TaskTree } from '../../../../types/taskTypes';

export interface UseResponseEditorCloseParams {
  // Contract change state
  contractChangeRef: React.MutableRefObject<{
    hasUnsavedChanges: boolean;
    modifiedContract: any;
    originalContract: any;
    nodeTemplateId: string | undefined;
    nodeLabel: string | undefined;
  }>;
  setPendingContractChange: React.Dispatch<React.SetStateAction<{
    templateId: string;
    templateLabel: string;
    modifiedContract: any;
  } | null>>;
  setShowContractDialog: React.Dispatch<React.SetStateAction<boolean>>;

  // Node selection
  selectedNode: any;
  selectedNodePath: {
    mainIndex: number;
    subIndex?: number;
  } | null;
  selectedRoot: boolean;

  // Task and tree
  task: Task | null | undefined;
  taskTreeRef: React.MutableRefObject<TaskTree | null | undefined>;
  currentProjectId: string | null;

  // Dock tree
  tabId?: string;
  setDockTree?: (updater: (prev: any) => any) => void;
  onClose?: () => void;

  // DDT replacement (legacy)
  replaceSelectedDDT?: (taskTree: TaskTree) => void;
}

/**
 * Hook that provides the handleEditorClose callback.
 * This hook encapsulates all the logic for closing the ResponseEditor.
 */
export function useResponseEditorClose(params: UseResponseEditorCloseParams) {
  const {
    contractChangeRef,
    setPendingContractChange,
    setShowContractDialog,
    selectedNode,
    selectedNodePath,
    selectedRoot,
    task,
    taskTreeRef,
    currentProjectId,
    tabId,
    setDockTree,
    onClose,
    replaceSelectedDDT,
  } = params;
  
  // ✅ FASE 2.2: Use Zustand store to update when closing
  const { setTaskTree } = useTaskTreeStore();

  const handleEditorClose = useCallback(async (): Promise<boolean> => {
    console.log('[ResponseEditor][CLOSE] 🚪 Editor close initiated', {
      taskId: task?.id || (task as any)?.instanceId,
      hasTask: !!task,
      hasSelectedNode: !!selectedNode,
      hasSelectedNodePath: !!selectedNodePath,
      taskStepsCount: task?.steps ? Object.keys(task.steps).length : 0,
      contractChangeRefType: typeof contractChangeRef.current,
      contractChangeRefExists: !!contractChangeRef.current
    });

    // ✅ Verifica se ci sono modifiche ai contracts non salvate
    const contractChange = contractChangeRef.current;
    console.log('[ResponseEditor][CLOSE] 🔍 Checking contract changes', {
      hasUnsavedChanges: contractChange?.hasUnsavedChanges,
      hasModifiedContract: !!contractChange?.modifiedContract,
      hasOriginalContract: !!contractChange?.originalContract,
      nodeTemplateId: contractChange?.nodeTemplateId,
      nodeLabel: contractChange?.nodeLabel,
      refKeys: contractChange ? Object.keys(contractChange) : [],
      contractChangeRefExists: !!contractChangeRef.current,
      contractChangeType: typeof contractChange
    });

    // ✅ CRITICAL: Controlla anche se contractChangeRef.current è stato aggiornato via useImperativeHandle
    // Se contractChange è null/undefined, prova a leggere direttamente dal RecognitionEditor ref
    if (!contractChange) {
      console.log('[ResponseEditor][CLOSE] ⚠️ contractChangeRef.current is null/undefined');
    } else if (!contractChange.hasUnsavedChanges) {
      console.log('[ResponseEditor][CLOSE] ⚠️ No unsaved changes', {
        hasUnsavedChanges: contractChange.hasUnsavedChanges,
        hasModifiedContract: !!contractChange.modifiedContract,
        hasNodeTemplateId: !!contractChange.nodeTemplateId
      });
    } else if (!contractChange.modifiedContract) {
      console.log('[ResponseEditor][CLOSE] ⚠️ hasUnsavedChanges is true but modifiedContract is null', {
        hasUnsavedChanges: contractChange.hasUnsavedChanges,
        modifiedContract: contractChange.modifiedContract,
        nodeTemplateId: contractChange.nodeTemplateId
      });
    } else if (!contractChange.nodeTemplateId) {
      console.log('[ResponseEditor][CLOSE] ⚠️ hasUnsavedChanges and modifiedContract are set but nodeTemplateId is missing', {
        hasUnsavedChanges: contractChange.hasUnsavedChanges,
        hasModifiedContract: !!contractChange.modifiedContract,
        nodeTemplateId: contractChange.nodeTemplateId
      });
    } else if (contractChange.hasUnsavedChanges && contractChange.modifiedContract && contractChange.nodeTemplateId) {
      console.log('[ResponseEditor][CLOSE] ⚠️ Unsaved contract changes detected', {
        nodeTemplateId: contractChange.nodeTemplateId,
        nodeLabel: contractChange.nodeLabel,
        hasModifiedContract: !!contractChange.modifiedContract,
        hasOriginalContract: !!contractChange.originalContract
      });

      // ✅ Mostra dialog e blocca chiusura
      const template = DialogueTaskService.getTemplate(contractChange.nodeTemplateId);
      console.log('[ResponseEditor][CLOSE] 🟡 Showing dialog...', {
        templateId: contractChange.nodeTemplateId,
        templateLabel: template?.label || contractChange.nodeLabel || 'Template',
        hasModifiedContract: !!contractChange.modifiedContract
      });

      setPendingContractChange({
        templateId: contractChange.nodeTemplateId,
        templateLabel: template?.label || contractChange.nodeLabel || 'Template',
        modifiedContract: contractChange.modifiedContract
      });
      setShowContractDialog(true);
      console.log('[ResponseEditor][CLOSE] ✅ Dialog state set to true, blocking close');
      // ✅ Ritorna false per bloccare la chiusura del tab
      return false;
    }

    // ✅ Salva selectedNode corrente nel ref prima di chiudere (se non già salvato)
    if (selectedNode && selectedNodePath) {
      const mains = getdataList(taskTreeRef.current);
      const { mainIndex, subIndex } = selectedNodePath;
      const isRoot = selectedRoot || false;

      if (mainIndex < mains.length) {
        const main = mains[mainIndex];

        if (isRoot) {
          const newIntroStep = selectedNode?.steps?.find((s: any) => s.type === 'introduction');
          const hasTasks = newIntroStep?.escalations?.some((esc: any) =>
            esc?.tasks && Array.isArray(esc.tasks) && esc.tasks.length > 0
          );
          if (hasTasks) {
            if (!taskTreeRef.current) taskTreeRef.current = { label: '', nodes: [], steps: {} };
            taskTreeRef.current.introduction = {
              type: 'introduction',
              escalations: newIntroStep.escalations || []
            };
          } else {
            if (taskTreeRef.current) delete taskTreeRef.current.introduction;
          }
        } else if (subIndex === undefined) {
          const regexPattern = selectedNode?.dataContract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0];
          const nlpProfileExamples = selectedNode?.nlpProfile?.examples;
          console.log('[REGEX] CLOSE - Saving to taskTreeRef', {
            nodeId: selectedNode?.id,
            regexPattern: regexPattern || '(none)',
            hasNlpProfile: !!selectedNode?.nlpProfile,
            hasNlpProfileExamples: !!nlpProfileExamples,
            nlpProfileExamplesCount: Array.isArray(nlpProfileExamples) ? nlpProfileExamples.length : 0,
            nlpProfileExamples: nlpProfileExamples?.slice(0, 3)
          });
          mains[mainIndex] = selectedNode;
          taskTreeRef.current.nodes = mains;

          // ✅ VERIFICA: Controlla se nlpProfile.examples è presente dopo il salvataggio
          const savedNode = taskTreeRef.current.nodes[mainIndex];
          console.log('[EXAMPLES] CLOSE - Verifying saved node', {
            nodeId: savedNode?.id,
            hasNlpProfile: !!savedNode?.nlpProfile,
            hasNlpProfileExamples: !!savedNode?.nlpProfile?.examples,
            nlpProfileExamplesCount: Array.isArray(savedNode?.nlpProfile?.examples) ? savedNode.nlpProfile.examples.length : 0
          });
        } else {
          const subList = main.subTasks || [];
          const subIdx = subList.findIndex((s: any, idx: number) => idx === subIndex);
          if (subIdx >= 0) {
            subList[subIdx] = selectedNode;
            main.subTasks = subList;
            mains[mainIndex] = main;
            if (!taskTreeRef.current) taskTreeRef.current = { label: '', nodes: [], steps: {} };
            taskTreeRef.current.nodes = mains;
          }
        }
      }
    }

    // ✅ Usa direttamente taskTreeRef.current (già contiene tutte le modifiche)
    const finalTaskTree = { ...taskTreeRef.current };
    const finalMainList = getdataList(finalTaskTree);
    const firstNode = finalMainList?.[0];
    const firstNodeRegex = firstNode?.dataContract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0];
    const firstNodeNlpProfileExamples = firstNode?.nlpProfile?.examples;
    console.log('[REGEX] CLOSE - Final TaskTree before save', {
      hasData: !!finalMainList && finalMainList.length > 0,
      firstNodeRegex: firstNodeRegex || '(none)',
      firstNodeId: firstNode?.id,
      hasFirstNodeNlpProfile: !!firstNode?.nlpProfile,
      hasFirstNodeNlpProfileExamples: !!firstNodeNlpProfileExamples,
      firstNodeNlpProfileExamplesCount: Array.isArray(firstNodeNlpProfileExamples) ? firstNodeNlpProfileExamples.length : 0,
      firstNodeNlpProfileExamples: firstNodeNlpProfileExamples?.slice(0, 3)
    });

    try {
      // Se abbiamo un instanceId o task.id (caso DDTHostAdapter), salva nell'istanza
      if (task?.id || (task as any)?.instanceId) {
        const key = ((task as any)?.instanceId || task?.id) as string;
        const hasTaskTree = finalTaskTree && Object.keys(finalTaskTree).length > 0 && finalTaskTree.nodes && finalTaskTree.nodes.length > 0;

        // ✅ NUOVO MODELLO: Aggiorna solo la cache in memoria (NON salvataggio DB)
        // Il salvataggio nel DB avviene solo su comando esplicito ("Salva progetto")
        if (hasTaskTree) {
          // ✅ Usa funzione di persistenza per salvare
          await saveTaskToRepository(key, finalTaskTree, task, currentProjectId);

          const firstNodeTestNotes = firstNode?.testNotes;
          console.log('[EXAMPLES] CLOSE - Updated TaskRepository cache with final TaskTree', {
            taskId: key,
            dataLength: finalMainList?.length || 0,
            firstNodeId: firstNode?.id,
            hasFirstNodeNlpProfile: !!firstNode?.nlpProfile,
            hasFirstNodeNlpProfileExamples: !!firstNodeNlpProfileExamples,
            firstNodeNlpProfileExamplesCount: Array.isArray(firstNodeNlpProfileExamples) ? firstNodeNlpProfileExamples.length : 0,
            firstNodeNlpProfileExamples: firstNodeNlpProfileExamples?.slice(0, 3),
            hasFirstNodeTestNotes: !!firstNodeTestNotes,
            firstNodeTestNotesCount: firstNodeTestNotes ? Object.keys(firstNodeTestNotes).length : 0,
            firstNodeTestNotesKeys: firstNodeTestNotes ? Object.keys(firstNodeTestNotes).slice(0, 3) : []
          });
        }

        console.log('[ResponseEditor][CLOSE] 🔍 Pre-save check', {
          taskId: task?.id || (task as any)?.instanceId,
          key,
          hasTaskTree,
          finalTaskTreeKeys: finalTaskTree ? Object.keys(finalTaskTree) : [],
          hasNodes: !!finalMainList && finalMainList.length > 0,
          nodesLength: finalMainList?.length || 0
        });

        console.log('[ResponseEditor][CLOSE] 💾 Starting save process', {
          taskId: task?.id || (task as any)?.instanceId,
          key,
          hasTask: !!task,
          taskStepsCount: Array.isArray(task?.steps) ? task.steps.length : 0,
          taskStepsIsArray: Array.isArray(task?.steps),
          taskStepsDetails: Array.isArray(task?.steps) ? task.steps.map((step: any) => {
            const escalationsCount = step.escalations?.length || 0;
            const tasksCount = step.escalations?.reduce((a: number, esc: any) => a + (esc?.tasks?.length || 0), 0) || 0;
            return {
              stepId: step.id,
              templateStepId: step.templateStepId,
              stepsType: 'array',
              isArray: true,
              isObject: false,
              escalationsCount,
              tasksCount
            };
          }) : []
        });

        // ✅ NUOVO MODELLO: Alla chiusura NON si salva automaticamente nel DB
        // Il salvataggio avviene solo su comando esplicito ("Salva progetto")
        // Qui aggiorniamo solo la cache in memoria per mantenere la working copy aggiornata
        if (hasTaskTree) {
          const finaldata = firstNode;
          const finalSubData = finaldata?.subTasks?.[0];
          const finalStartTasks = finalSubData?.steps?.start?.escalations?.reduce((acc: number, esc: any) => acc + (esc?.tasks?.length || 0), 0) || 0;

          console.log('[handleEditorClose] 🔄 Aggiornando cache in memoria (NON salvataggio DB)', {
            key,
            finalStartTasks,
            hasNodes: !!finalMainList,
            nodesLength: finalMainList?.length || 0
          });

          // ✅ CRITICAL: Aggiungi task.steps a finalTaskTree (unica fonte di verità per gli steps)
          // Gli steps vengono salvati in task.steps[nodeTemplateId] quando si modifica un nodo
          // ✅ finalTaskTreeWithSteps è la WORKING COPY (modificata dall'utente)
          // ✅ Usa task.steps come fonte di verità (contiene tutti gli steps aggiornati dai nodi)
          const finalTaskTreeWithSteps: TaskTree = {
            ...finalTaskTree,
            steps: task?.steps || taskTreeRef.current?.steps || finalTaskTree.steps || {}
          };
          
          // ✅ FASE 2.2: Update store with final TaskTree (ref already updated above)
          setTaskTree(finalTaskTreeWithSteps);

          console.log('[ResponseEditor][CLOSE] 📦 Final TaskTree with steps prepared', {
            taskId: task?.id || (task as any)?.instanceId,
            key,
            finalStepsKeys: finalTaskTreeWithSteps.steps ? Object.keys(finalTaskTreeWithSteps.steps) : [],
            finalStepsCount: finalTaskTreeWithSteps.steps ? Object.keys(finalTaskTreeWithSteps.steps).length : 0,
            taskStepsKeys: task?.steps ? Object.keys(task.steps) : [],
            taskStepsCount: task?.steps ? Object.keys(task.steps).length : 0,
            stepsMatch: JSON.stringify(finalTaskTreeWithSteps.steps) === JSON.stringify(task?.steps || {})
          });

          // ✅ AWAIT OBBLIGATORIO: non chiudere finché non è salvato
          await saveTaskOnEditorClose(key, finalTaskTreeWithSteps, task, currentProjectId);

          console.log('[ResponseEditor][CLOSE] ✅ Save completed successfully', {
            taskId: task?.id || (task as any)?.instanceId,
            key,
            nodesLength: finalTaskTree.nodes?.length || 0,
            finalStartTasks
          });
        } else if (finalTaskTree) {
          // ✅ No TaskTree structure, but save other fields (e.g., Message text)
          await saveTaskToRepository(key, finalTaskTree, task, currentProjectId);
          console.log('[handleEditorClose] ✅ Save completed (no data)', { key });
        }
      }

      // NON chiamare replaceSelectedDDT se abbiamo task prop (siamo in TaskEditorOverlay)
      // Questo previene l'apertura di ResizableResponseEditor in AppContent mentre si chiude TaskEditorOverlay
      if (!task && replaceSelectedDDT) {
        // Modalità diretta (senza task): aggiorna selectedDDT per compatibilità legacy
        replaceSelectedDDT(finalTaskTree);
      }
    } catch (e) {
      console.error('[ResponseEditor][CLOSE] ❌ Persist error', {
        taskId: task?.id || (task as any)?.instanceId,
        error: e,
        errorMessage: e instanceof Error ? e.message : String(e),
        errorStack: e instanceof Error ? e.stack : undefined
      });
    }

    // ✅ NON chiamare onClose() qui - la chiusura del tab è gestita da tab.onClose nel DockManager
    // tab.onClose chiamerà closeTab solo se questo handleEditorClose ritorna true
    // onClose() è solo per compatibilità legacy e non deve chiudere il tab
    console.log('[ResponseEditor][CLOSE] ✅ Close process completed, returning true to allow tab closure', {
      taskId: task?.id || (task as any)?.instanceId
    });

    // ✅ Ritorna true per indicare che la chiusura può procedere
    return true;
  }, [
    contractChangeRef,
    setPendingContractChange,
    setShowContractDialog,
    selectedNode,
    selectedNodePath,
    selectedRoot,
    task,
    taskTreeRef,
    currentProjectId,
    replaceSelectedDDT,
  ]);

  return handleEditorClose;
}
