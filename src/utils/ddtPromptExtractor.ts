import { TaskType } from '../types/taskTypes';
import type { TaskTreeNode } from '../types/taskTypes';

/**
 * ============================================================================
 * DDT Prompt Extractor - Estrazione Prompt da Steps
 * ============================================================================
 *
 * Estrae prompt da adattare dagli steps del task.
 *
 * REGOLE:
 * - Solo step "start" (o "normal")
 * - Solo PRIMA escalation
 * - Solo task di tipo SayMessage
 * - Flag onlyRootNodes: true = solo nodi radice (primo livello), false = tutti i nodi
 * - Usa SEMPRE templateId (nessun fallback)
 */

export interface ExtractedPrompt {
  guid: string;
  text: string;
  nodeTemplateId: string;
  taskKey?: string; // Chiave per riassociazione dopo adattamento AI
}

/**
 * Estrae prompt da adattare dagli steps del task.
 *
 * @param steps - Steps del task (formato: { [nodeTemplateId]: { start: {...}, ... } })
 * @param nodes - Albero nodi (array di TaskTreeNode con templateId)
 * @param projectTranslations - Traduzioni del progetto
 * @param options - Opzioni di estrazione
 * @returns Array di prompt estratti con GUID, testo e nodeTemplateId
 */
export function extractStartPrompts(
  steps: Record<string, any>,
  nodes: TaskTreeNode[],
  projectTranslations: Record<string, string>,
  options: { onlyRootNodes?: boolean } = {}
): ExtractedPrompt[] {
  const promptsToAdapt: ExtractedPrompt[] = [];
  const onlyRootNodes = options.onlyRootNodes ?? true; // Default: solo nodi radice

  console.log('[🔍 extractStartPrompts] START', {
    nodesLength: nodes.length,
    stepsKeys: Object.keys(steps),
    onlyRootNodes,
    translationsCount: Object.keys(projectTranslations).length
  });

  // ✅ Determina quali nodi processare
  const nodesToProcess: TaskTreeNode[] = [];

  if (onlyRootNodes) {
    // Solo nodi radice (primo livello)
    nodesToProcess.push(...nodes);
    console.log('[🔍 extractStartPrompts] Processing only root nodes', {
      rootNodesCount: nodesToProcess.length
    });
  } else {
    // Tutti i nodi (ricorsivo)
    const collectAllNodes = (nodeList: TaskTreeNode[]) => {
      for (const node of nodeList) {
        nodesToProcess.push(node);
        if (node.subNodes && Array.isArray(node.subNodes)) {
          collectAllNodes(node.subNodes); // ✅ Usa subNodes[]
        }
      }
    };
    collectAllNodes(nodes);
    console.log('[🔍 extractStartPrompts] Processing all nodes (recursive)', {
      totalNodesCount: nodesToProcess.length
    });
  }

  // ✅ Processa ogni nodo
  for (const node of nodesToProcess) {
    // ✅ CRITICAL: Usa SEMPRE templateId (nessun fallback)
    if (!node.templateId) {
      const errorMsg = `[extractStartPrompts] Nodo senza templateId: ${node.label || node.id || 'unknown'}`;
      console.error(errorMsg, { node });
      throw new Error(errorMsg);
    }

    const nodeTemplateId = node.templateId;
    const nodeSteps = steps[nodeTemplateId];

    if (!nodeSteps) {
      console.log('[🔍 extractStartPrompts] Nodo senza steps', {
        nodeTemplateId,
        nodeLabel: node.label
      });
      continue;
    }

    // ✅ Solo step "start" (o "normal")
    const startStep = nodeSteps?.start || nodeSteps?.normal;
    if (!startStep?.escalations || !Array.isArray(startStep.escalations)) {
      console.log('[🔍 extractStartPrompts] Nodo senza step start/normal o senza escalations', {
        nodeTemplateId,
        nodeLabel: node.label,
        hasStart: !!nodeSteps.start,
        hasNormal: !!nodeSteps.normal
      });
      continue;
    }

    // ✅ Solo PRIMA escalation
    const firstEscalation = startStep.escalations[0];
    if (!firstEscalation) {
      console.log('[🔍 extractStartPrompts] Step start senza escalations', {
        nodeTemplateId,
        nodeLabel: node.label
      });
      continue;
    }

    const tasks = firstEscalation.tasks || firstEscalation.actions || [];
    console.log('[🔍 extractStartPrompts] Processing escalation', {
      nodeTemplateId,
      nodeLabel: node.label,
      tasksCount: tasks.length
    });

    for (const task of tasks) {
      // ✅ Solo task di tipo SayMessage
      if (task.type === TaskType.SayMessage || task.type === 0 || !task.type) {
        const textGuid = task.parameters?.find((p: any) => p.parameterId === 'text')?.value ||
                        task.id;

        if (textGuid && projectTranslations[textGuid]) {
          promptsToAdapt.push({
            guid: textGuid,
            text: projectTranslations[textGuid],
            nodeTemplateId: nodeTemplateId,
            taskKey: `${nodeTemplateId}:${task.id}` // Chiave per riassociazione
          });

          console.log('[🔍 extractStartPrompts] Prompt estratto', {
            nodeTemplateId,
            nodeLabel: node.label,
            guid: textGuid,
            textPreview: projectTranslations[textGuid].substring(0, 50) + '...',
            fullText: projectTranslations[textGuid]
          });
        } else {
          console.warn('[🔍 extractStartPrompts] ⚠️ Task senza textGuid o traduzione', {
            nodeTemplateId,
            taskId: task.id,
            hasTextGuid: !!textGuid,
            textGuid: textGuid,
            hasTranslation: !!(textGuid && projectTranslations[textGuid]),
            availableTranslations: Object.keys(projectTranslations),
            taskParams: task.params
          });
        }
      }
    }
  }

  console.log('[🔍 extractStartPrompts] COMPLETE', {
    extractedCount: promptsToAdapt.length,
    nodesProcessed: nodesToProcess.length
  });

  return promptsToAdapt;
}
