// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';
import { getMainNodes, getSubNodes } from '@responseEditor/core/domain';
import { useTaskTreeFromStore, useTaskTreeVersion } from '@responseEditor/core/state';
import type { Task, TaskTree } from '@types/taskTypes';

export interface UseNodeLoadingParams {
  // Node selection indices
  selectedMainIndex: number;
  selectedSubIndex: number | null | undefined;
  selectedRoot: boolean;
  introduction: any;

  // Task and tree
  // ✅ FASE 3: Parametri opzionali rimossi - store è single source of truth
  task?: Task | null | undefined;

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
 *
 * ✅ FASE 3: Completamente migrato a Zustand store (single source of truth)
 * - Usa taskTreeFromStore come unica fonte
 * - Usa taskTreeVersion dallo store
 * - Rimossi completamente taskTreeRef e taskTree prop
 */
export function useNodeLoading(params: UseNodeLoadingParams) {
  const {
    selectedMainIndex,
    selectedSubIndex,
    selectedRoot,
    introduction,
    task,
    setSelectedNode,
    setSelectedNodePath,
    getStepsForNode,
    getStepsAsArray,
  } = params;

  // ✅ FASE 2.3: Use Zustand store as SINGLE source of truth
  const taskTreeFromStore = useTaskTreeFromStore();
  const taskTreeVersion = useTaskTreeVersion();

  useEffect(() => {
    // ✅ FASE 3: Usa solo store - no fallback chain
    const currentTaskTree = taskTreeFromStore;
    const currentMainList = getMainNodes(currentTaskTree);

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
        : getSubNodes(currentMainList[selectedMainIndex])?.[selectedSubIndex];

      if (node) {
        // CRITICAL: Usa node.templateId come chiave (non node.id)
        // task.steps[node.templateId] = steps clonati
        // node.id potrebbe essere diverso (nel caso di template aggregato)
        // After validation strict, node.id is always present
        // templateId is optional (preferred for lookup, but id works as fallback)
        const nodeTemplateId = node.templateId ?? node.id;

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


    // ✅ FASE 2.3: Carica il nodo quando cambiano gli indici O quando taskTreeVersion cambia
    // ✅ CRITICAL: Use taskTreeVersion as primary trigger (stable, increments only when needed)
    // Don't include taskTreeFromStore in deps - it changes reference on every store update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMainIndex, selectedSubIndex, selectedRoot, introduction, taskTreeVersion, setSelectedNode, setSelectedNodePath, getStepsForNode, getStepsAsArray]);
}
