// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { saveTaskToRepository, saveTaskOnEditorClose } from '@responseEditor/core/persistence/ResponseEditorPersistence';
import { getMainNodes } from '@responseEditor/core/domain';
import { getSubNodesStrict } from '@responseEditor/core/domain/nodeStrict';
import { replaceNodeAtPath } from '@responseEditor/core/taskTree';
import { closeTab } from '@dock/ops';
import { useTaskTreeStore, useTaskTreeFromStore } from '@responseEditor/core/state';
import { useWizardContext } from '@responseEditor/context/WizardContext';
import type { Task, TaskTree } from '@types/taskTypes';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';

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

  // Node selection
  selectedNode: any;
  selectedNodePath: {
    path: number[];
  } | null;
  selectedRoot: boolean;

  // Task and tree
  task: Task | null | undefined;
  // ✅ FASE 3: taskTreeRef rimosso - store è single source of truth
  currentProjectId: string | null;
  /** Flow canvas that owns this task row (utterance variable sync). */
  authoringFlowCanvasId?: string | null;

  // Dock tree
  tabId?: string;
  setDockTree?: (updater: (prev: any) => any) => void;
  onClose?: () => void;

  // DDT replacement (legacy)
  replaceSelectedDDT?: (taskTree: TaskTree) => void;

  // ✅ NEW: Wizard mode (per permettere chiusura in modalità wizard senza taskTree)
  taskWizardMode?: TaskWizardMode;
  // ✅ REMOVED: shouldBeGeneral - now from WizardContext
  saveDecisionMade?: boolean;
  onOpenSaveDialog?: () => void;
}

/**
 * Hook that provides the handleEditorClose callback.
 * This hook encapsulates all the logic for closing the ResponseEditor.
 */
export function useResponseEditorClose(params: UseResponseEditorCloseParams) {
  const {
    contractChangeRef,
    setPendingContractChange,
    selectedNode,
    selectedNodePath,
    selectedRoot,
    task,
    currentProjectId,
    authoringFlowCanvasId,
    tabId,
    setDockTree,
    onClose,
    replaceSelectedDDT,
    taskWizardMode,
    // ✅ REMOVED: shouldBeGeneral - now from WizardContext
    saveDecisionMade = false,
    onOpenSaveDialog,
  } = params;

  // ✅ ARCHITECTURE: Read shouldBeGeneral from WizardContext (single source of truth)
  const wizardContext = useWizardContext();
  const shouldBeGeneral = wizardContext?.shouldBeGeneral ?? false;

  // ✅ FASE 2.3: Use Zustand store as SINGLE source of truth
  const { setTaskTree } = useTaskTreeStore();
  const taskTreeFromStore = useTaskTreeFromStore();

  const handleEditorClose = useCallback(async (): Promise<boolean> => {
    // ✅ NEW: Tutor alla chiusura - verifica se deve essere scelto dove salvare
    if (shouldBeGeneral && !saveDecisionMade && onOpenSaveDialog) {
      onOpenSaveDialog();
      return false;  // ✅ Blocca chiusura
    }

    // ✅ CRITICAL: Reset wizard state when closing editor
    const { useWizardStore } = await import('../../../../../TaskBuilderAIWizard/store/wizardStore');
    useWizardStore.getState().reset();

    // Contract edits: keep automatically (same as former "Mantieni modifiche"); no confirmation dialog
    let didAutoKeepContract = false;
    const contractChange = contractChangeRef.current;
    if (contractChange?.hasUnsavedChanges && contractChange.modifiedContract && contractChange.nodeTemplateId) {
      didAutoKeepContract = true;
      setPendingContractChange(null);
      contractChangeRef.current = {
        hasUnsavedChanges: false,
        modifiedContract: null,
        originalContract: null,
        nodeTemplateId: undefined,
        nodeLabel: undefined,
      };
    }

    // ✅ FASE 2.3: Salva selectedNode corrente nello store prima di chiudere (se non già salvato)
    if (selectedNode && taskTreeFromStore) {
      const currentTaskTree = taskTreeFromStore;
      const isRoot = selectedRoot || false;

      if (isRoot) {
        let introStepData: any = null;
        if (selectedNode?.steps) {
          if (Array.isArray(selectedNode.steps)) {
            introStepData = selectedNode.steps.find((s: any) => s.type === 'introduction');
          } else if (typeof selectedNode.steps === 'object' && selectedNode.steps.introduction) {
            introStepData = selectedNode.steps.introduction;
          }
        }
        const hasTasks = introStepData?.escalations?.some((esc: any) =>
          esc?.tasks && Array.isArray(esc.tasks) && esc.tasks.length > 0
        );
        if (hasTasks) {
          const updatedTaskTree = { ...currentTaskTree };
          updatedTaskTree.introduction = {
            type: 'introduction',
            escalations: introStepData?.escalations ?? []
          };
          setTaskTree(updatedTaskTree);
        } else {
          const updatedTaskTree = { ...currentTaskTree };
          delete updatedTaskTree.introduction;
          setTaskTree(updatedTaskTree);
        }
      } else if (selectedNodePath?.path?.length) {
        const updatedTaskTree = replaceNodeAtPath(currentTaskTree, selectedNodePath.path, selectedNode);
        setTaskTree(updatedTaskTree);
      }
    }

    // ✅ FASE 3: Usa store (già contiene tutte le modifiche)
    // ✅ IMPORTANTE: In modalità wizard (adaptation/full), taskTreeFromStore può essere null
    // perché il wizard non è ancora stato completato. In questo caso, permettere la chiusura.
    if (!taskTreeFromStore) {
      // ✅ Se siamo in modalità wizard, permettere la chiusura senza salvare
      if (taskWizardMode === 'full' || taskWizardMode === 'adaptation') {
        return true; // ✅ Permetti chiusura in modalità wizard
      }
      // After auto-keeping contract edits, close tab like the old dialog "Mantieni" path
      if (didAutoKeepContract) {
        if (tabId && setDockTree) {
          setDockTree((prev) => closeTab(prev, tabId));
        } else if (onClose) {
          onClose();
        }
        return true;
      }
      return false;
    }
    const finalTaskTree = taskTreeFromStore;
    const finalMainList = getMainNodes(finalTaskTree);
    const firstNode = finalMainList?.[0];
    const firstNodeNlpProfileExamples = firstNode?.nlpProfile?.examples;

    try {
      // Se abbiamo un instanceId o task.id (caso DDTHostAdapter), salva nell'istanza
      if (task?.id ?? (task as any)?.instanceId) {
        const key = ((task as any)?.instanceId ?? task?.id) as string;
        const hasTaskTree = finalTaskTree && Object.keys(finalTaskTree).length > 0 && finalTaskTree.nodes && finalTaskTree.nodes.length > 0;

        // ✅ NUOVO MODELLO: Aggiorna solo la cache in memoria (NON salvataggio DB)
        // Il salvataggio nel DB avviene solo su comando esplicito ("Salva progetto")
        if (hasTaskTree) {
          // ✅ Usa funzione di persistenza per salvare
          await saveTaskToRepository(key, finalTaskTree, task, currentProjectId, authoringFlowCanvasId);
        }

        // ✅ NUOVO MODELLO: Alla chiusura NON si salva automaticamente nel DB
        // Il salvataggio avviene solo su comando esplicito ("Salva progetto")
        // Qui aggiorniamo solo la cache in memoria per mantenere la working copy aggiornata
        if (hasTaskTree) {
          const finaldata = firstNode;
          // After validation strict, use subNodes (not subTasks)
          const subNodes = getSubNodesStrict(finaldata);
          const finalSubData = subNodes?.[0];
          // ✅ CRITICAL: Aggiungi task.steps a finalTaskTree (unica fonte di verità per gli steps)
          // Gli steps vengono salvati in task.steps[nodeTemplateId] quando si modifica un nodo
          // ✅ finalTaskTreeWithSteps è la WORKING COPY (modificata dall'utente)
          const finalTaskTreeWithSteps: TaskTree = {
            ...finalTaskTree,
            steps: task?.steps ?? finalTaskTree.steps ?? {}
          };

          // ✅ FASE 2.3: Update store with final TaskTree
          setTaskTree(finalTaskTreeWithSteps);

          // ✅ AWAIT OBBLIGATORIO: non chiudere finché non è salvato
          await saveTaskOnEditorClose(key, finalTaskTreeWithSteps, task, currentProjectId, authoringFlowCanvasId);

          // ✅ Emetti evento per notificare NodeRow dell'aggiornamento (indipendente dal tipo di task)
          window.dispatchEvent(
            new CustomEvent('instanceRepository:updated', {
              detail: { instanceId: key }
            })
          );
        } else if (finalTaskTree) {
          // ✅ No TaskTree structure, but save other fields (e.g., Message text)
          await saveTaskToRepository(key, finalTaskTree, task, currentProjectId, authoringFlowCanvasId);

          // ✅ Emetti evento anche per task senza TaskTree (es. SayMessage con solo text)
          window.dispatchEvent(
            new CustomEvent('instanceRepository:updated', {
              detail: { instanceId: key }
            })
          );
        }
      }

      // NON chiamare replaceSelectedDDT se abbiamo task prop (siamo in TaskEditorOverlay)
      // Questo previene l'apertura di ResizableResponseEditor in AppContent mentre si chiude TaskEditorOverlay
      if (!task && replaceSelectedDDT) {
        // Modalità diretta (senza task): aggiorna selectedDDT per compatibilità legacy
        replaceSelectedDDT(finalTaskTree);
      }
    } catch (e) {
      // Error during save - allow close anyway
    }

    // ✅ NON chiamare onClose() qui - la chiusura del tab è gestita da tab.onClose nel DockManager
    // tab.onClose chiamerà closeTab solo se questo handleEditorClose ritorna true
    // onClose() è solo per compatibilità legacy e non deve chiudere il tab

    // ✅ Ritorna true per indicare che la chiusura può procedere
    return true;
  }, [
    contractChangeRef,
    setPendingContractChange,
    selectedNode,
    selectedNodePath,
    selectedRoot,
    task,
    taskTreeFromStore,
    currentProjectId,
    authoringFlowCanvasId,
    setTaskTree,
    replaceSelectedDDT,
    taskWizardMode,
    shouldBeGeneral, // ✅ From WizardContext
    saveDecisionMade,
    onOpenSaveDialog,
  ]);

  return handleEditorClose;
}
