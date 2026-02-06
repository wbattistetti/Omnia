// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';
import { getdataList, getSubDataList } from '../ddtSelectors';
import { useTaskTreeFromStore } from '../core/state';
import type { Task, TaskTree } from '../../../../types/taskTypes';

export interface UseNodeLoadingParams {
  // Node selection indices
  selectedMainIndex: number;
  selectedSubIndex: number | null | undefined;
  selectedRoot: boolean;
  introduction: any;

  // Task and tree
  task: Task | null | undefined;
  taskTree: TaskTree | null | undefined;
  taskTreeRef: React.MutableRefObject<TaskTree | null | undefined>;

  // Setters
  setSelectedNode: React.Dispatch<React.SetStateAction<any>>;
  setSelectedNodePath: React.Dispatch<React.SetStateAction<{
    mainIndex: number;
    subIndex?: number;
  } | null>>;

  // Helper functions
  getStepsForNode: (steps: any, nodeTemplateId: string) => Record<string, any>;
  getStepsAsArray: (steps: any) => any[];
}

/**
 * Hook that manages node loading when selection changes.
 * This hook loads the selected node from taskTreeRef and sets it in state.
 */
export function useNodeLoading(params: UseNodeLoadingParams) {
  const {
    selectedMainIndex,
    selectedSubIndex,
    selectedRoot,
    introduction,
    task,
    taskTree,
    taskTreeRef,
    setSelectedNode,
    setSelectedNodePath,
    getStepsForNode,
    getStepsAsArray,
  } = params;

  // ✅ FASE 2.2: Use Zustand store as primary source
  const taskTreeFromStore = useTaskTreeFromStore();

  useEffect(() => {
    // LOG CHIRURGICO 3: Caricamento nodo
    // ✅ FASE 2.2: Use store as primary source, fallback to ref
    const currentTaskTree = taskTreeFromStore ?? taskTreeRef.current;
    const currentMainList = getdataList(currentTaskTree); // Leggi dallo store/ref, non dal prop

    if (currentMainList.length === 0) {
      return;
    }

    try {
      if (localStorage.getItem('debug.nodeSync') === '1') {
        console.log('[NODE_SYNC][LOAD] 🔄 Loading node from taskTree', {
          selectedMainIndex,
          selectedSubIndex,
          selectedRoot,
          mainListLength: currentMainList.length
        });
      }
    } catch { }

    if (selectedRoot) {
      // ✅ FASE 2.2: Use store as primary source
      const introStep = currentTaskTree?.introduction
        ? { type: 'introduction', escalations: currentTaskTree.introduction.escalations }
        : { type: 'introduction', escalations: [] };
      const newNode = { ...currentTaskTree, steps: [introStep] };

      try {
        if (localStorage.getItem('debug.nodeSync') === '1') {
          const tasksCount = introStep.escalations?.reduce((acc: number, esc: any) =>
            acc + (esc?.tasks?.length || 0), 0) || 0;
          console.log('[NODE_SYNC][LOAD] ✅ Root node loaded', {
            escalationsCount: introStep.escalations?.length || 0,
            tasksCount
          });
        }
      } catch { }

      setSelectedNode(newNode);
      setSelectedNodePath(null);
    } else {
      // Usa currentMainList invece di mainList per leggere sempre l'ultima versione
      const node = selectedSubIndex == null
        ? currentMainList[selectedMainIndex]
        : getSubDataList(currentMainList[selectedMainIndex])?.[selectedSubIndex];

      if (node) {
        // CRITICAL: Usa node.templateId come chiave (non node.id)
        // task.steps[node.templateId] = steps clonati
        // node.id potrebbe essere diverso (nel caso di template aggregato)
        const nodeTemplateId = node.templateId || node.id; // Fallback a node.id se templateId non presente

        // DEBUG: Log node.nlpProfile.examples quando viene caricato
        const nodeNlpProfileExamples = (node as any)?.nlpProfile?.examples;
        if (nodeNlpProfileExamples || (node as any)?.nlpProfile) {
          console.log('[NODE_SELECT] Node loaded with nlpProfile', {
            nodeId: node.id,
            nodeTemplateId,
            hasNlpProfile: !!(node as any)?.nlpProfile,
            nlpProfileKeys: (node as any)?.nlpProfile ? Object.keys((node as any).nlpProfile) : [],
            hasNlpProfileExamples: !!nodeNlpProfileExamples,
            nlpProfileExamplesCount: Array.isArray(nodeNlpProfileExamples) ? nodeNlpProfileExamples.length : 0,
            nlpProfileExamples: nodeNlpProfileExamples?.slice(0, 3),
            hasTestNotes: !!(node as any)?.testNotes,
            testNotesCount: (node as any)?.testNotes ? Object.keys((node as any).testNotes).length : 0
          });
        }

        // NUOVO: Usa lookup diretto per ottenere steps per questo nodo (dictionary)
        // CRITICAL: Usa taskTree.steps come fonte primaria (più affidabile, costruito da buildTaskTree)
        // ✅ FASE 2.2: Use store as primary source
        // Fallback a task.steps solo se taskTree.steps non è disponibile
        const stepsSource = currentTaskTree?.steps || task?.steps;
        const nodeStepsDict = getStepsForNode(stepsSource, nodeTemplateId);
        const taskTemplateIdsCount = stepsSource && typeof stepsSource === 'object' && !Array.isArray(stepsSource)
          ? Object.keys(stepsSource).length
          : 0;
        const nodeStepTypes = Object.keys(nodeStepsDict);

        console.log('[🔍 ResponseEditor][NODE_SELECT] 🔍 Loading steps for node', {
          nodeId: node.id,
          nodeTemplateId,
          nodeLabel: node?.label,
          hasTaskSteps: nodeStepTypes.length > 0,
          taskTemplateIdsCount,
          nodeStepTypes,
          nodeStepsCount: nodeStepTypes.length,
          stepsSource: currentTaskTree?.steps ? 'taskTree.steps' : 'task.steps',
          stepsIsDictionary: stepsSource && typeof stepsSource === 'object' && !Array.isArray(stepsSource)
        });
        const nodeStepsDetails = nodeStepTypes.length > 0 ? (() => {
          let escalationsCount = 0;
          let tasksCount = 0;

          for (const stepType in nodeStepsDict) {
            const step = nodeStepsDict[stepType];
            if (step?.escalations && Array.isArray(step.escalations)) {
              escalationsCount += step.escalations.length;
              tasksCount += step.escalations.reduce((acc: number, esc: any) =>
                acc + (esc?.tasks?.length || 0), 0);
            }
          }

          return {
            stepsType: 'dictionary',
            isArray: false,
            isObject: true,
            stepTypes: nodeStepTypes,
            stepTypesCount: nodeStepTypes.length,
            escalationsCount,
            tasksCount,
            nodeHasStepsBefore: !!node.steps,
            nodeStepsType: typeof node.steps
          };
        })() : null;

        // Usa nodeStepsDict già dichiarato sopra
        if (nodeStepTypes.length > 0) {
          node.steps = nodeStepsDict;

          let totalEscalations = 0;
          let totalTasks = 0;
          for (const stepType in nodeStepsDict) {
            const step = nodeStepsDict[stepType];
            if (step?.escalations && Array.isArray(step.escalations)) {
              totalEscalations += step.escalations.length;
              totalTasks += step.escalations.reduce((acc: number, esc: any) =>
                acc + (esc?.tasks?.length || 0), 0);
            }
          }

          console.log('[ResponseEditor][NODE_SELECT] ✅ Steps copied to node', {
            nodeId: node.id,
            nodeTemplateId,
            nodeLabel: node?.label,
            stepsCopied: true,
            nodeStepsType: typeof node.steps,
            nodeStepsIsDictionary: node.steps && typeof node.steps === 'object' && !Array.isArray(node.steps),
            nodeStepTypes,
            stepTypesCount: nodeStepTypes.length,
            escalationsCount: totalEscalations,
            tasksCount: totalTasks
          });
        } else {
          console.log('[🔍 ResponseEditor][NODE_SELECT] ❌ CRITICAL - No steps found for node', {
            nodeId: node.id,
            nodeTemplateId,
            nodeLabel: node?.label,
            stepsSource: currentTaskTree?.steps ? 'taskTree.steps' : 'task.steps',
            hasTaskSteps: !!(nodeTemplateId && stepsSource?.[nodeTemplateId]),
            taskStepsKeys: stepsSource && typeof stepsSource === 'object' && !Array.isArray(stepsSource)
              ? Object.keys(stepsSource)
              : [],
            taskTemplateIdsCount: stepsSource && typeof stepsSource === 'object' && !Array.isArray(stepsSource)
              ? Object.keys(stepsSource).length
              : 0,
            nodeHasTemplateId: !!node.templateId,
            nodeTemplateIdMatches: node.templateId ? stepsSource?.[node.templateId] : false,
            keyMatchAnalysis: nodeTemplateId && stepsSource && typeof stepsSource === 'object' && !Array.isArray(stepsSource) ? {
              lookingFor: nodeTemplateId,
              availableKeys: Object.keys(stepsSource),
              keyComparison: Object.keys(stepsSource).map(k => ({
                key: k,
                matches: k === nodeTemplateId,
                keyPreview: k.substring(0, 40),
                templateIdPreview: nodeTemplateId.substring(0, 40)
              }))
            } : null
          });
        }

        // LOG CHIRURGICO 3 (continuazione): Dettagli del nodo caricato
        const steps = getStepsAsArray(node?.steps);
        const startStepTasksCount = steps.find((s: any) => s?.type === 'start')?.escalations?.reduce((acc: number, esc: any) => acc + (esc?.tasks?.length || 0), 0) || 0;


        try {
          if (localStorage.getItem('debug.nodeSync') === '1') {
            const steps = getStepsAsArray(node?.steps);
            const escalationsCount = steps.reduce((acc: number, step: any) =>
              acc + (step?.escalations?.length || 0), 0);
            const tasksCount = steps.reduce((acc: number, step: any) =>
              acc + (step?.escalations?.reduce((a: number, esc: any) =>
                a + (esc?.tasks?.length || 0), 0) || 0), 0);

            // Log dettagliato per ogni step
            const stepDetails = steps.map((step: any, idx: number) => {
              const stepKey = step?.type || `step-${idx}`;
              const escs = step?.escalations || [];
              const stepTasksCount = escs.reduce((acc: number, esc: any) =>
                acc + (esc?.tasks?.length || 0), 0);
              return {
                stepKey,
                escalationsCount: escs.length,
                tasksCount: stepTasksCount,
                tasks: escs.flatMap((esc: any) => esc?.tasks || []).map((t: any) => ({
                  id: t?.id,
                  label: t?.label
                }))
              };
            });

            console.log('[NODE_SYNC][LOAD] ✅ Node loaded from taskTree', {
              mainIndex: selectedMainIndex,
              subIndex: selectedSubIndex,
              nodeLabel: node?.label,
              stepsCount: steps.length,
              escalationsCount,
              tasksCount,
              stepDetails
            });
          }
        } catch (e) {
          // Error logging details (gated by debug flag)
        }


        setSelectedNode(node);
        const newPath = {
          mainIndex: selectedMainIndex,
          subIndex: selectedSubIndex
        };
        setSelectedNodePath(newPath);
      }
    }


    // Carica il nodo quando cambiano gli indici O quando taskTree prop cambia (dal dockTree)
    // ✅ FASE 2.2: Store is already synced with taskTreeRef via useTaskTreeSync
  }, [selectedMainIndex, selectedSubIndex, selectedRoot, introduction, taskTree?.label, taskTree?.nodes?.length, task?.steps, taskTreeFromStore, taskTreeRef, setSelectedNode, setSelectedNodePath, getStepsForNode, getStepsAsArray]);
}
