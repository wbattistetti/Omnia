/**
 * taskOrchestrator.ts - Moduli di orchestrazione per creazione Task
 *
 * Gestisce due flussi:
 * 1. Template candidato trovato → clona steps e adatta prompt
 * 2. Nessun template → genera struttura da AI e poi tutti gli steps
 */

import { buildTaskTreeNodes, cloneTemplateSteps } from './taskUtils';
import { AdaptPromptToContext } from './ddtPromptAdapter';
import { generateAllStepsFromAI } from './ddtStepGenerator';
import { DialogueTaskService } from '../services/DialogueTaskService';
import type { Task, TaskTreeNode } from '../types/taskTypes';
import type { SchemaNode } from '../components/DialogueDataTemplateBuilder/DDTWizard/types';

/**
 * CASO 1: Template candidato trovato
 *
 * 1. Monta struttura nodi dal template
 * 2. Mostra preview (TemplatePreviewDialog)
 * 3. Se confermato:
 *    - Clona steps dal template
 *    - Adatta prompt al contesto
 *    - Crea task con templateId
 */
export async function createTaskFromTemplate(
  templateId: string,
  task: Task,
  contextLabel: string,
  adaptAllNormalSteps: boolean = false
): Promise<{ nodes: TaskTreeNode[]; steps: Record<string, any> }> {
  console.log('[🔍 taskOrchestrator] createTaskFromTemplate START', {
    templateId,
    taskId: task.id,
    taskLabel: task.label,
    contextLabel,
    adaptAllNormalSteps
  });

  // 1. Carica template
  const template = DialogueTaskService.getTemplate(templateId);
  if (!template) {
    throw new Error(`[taskOrchestrator] Template ${templateId} non trovato`);
  }

  // 2. Monta struttura nodi dal template
  const nodes = buildTaskTreeNodes(template);
  console.log('[🔍 taskOrchestrator] Nodes montato', {
    nodesLength: nodes.length,
    mainNodes: nodes.map((n: TaskTreeNode) => ({ label: n.label, templateId: n.templateId }))
  });

  // 3. Clona steps dal template
  const { steps: clonedSteps } = cloneTemplateSteps(template, nodes);
  task.steps = clonedSteps;
  console.log('[🔍 taskOrchestrator] Steps clonati', {
    stepsCount: Object.keys(task.steps || {}).length,
    stepsKeys: Object.keys(task.steps || {})
  });

  // 4. Adatta prompt al contesto
  await AdaptPromptToContext(task, contextLabel, adaptAllNormalSteps);
  console.log('[🔍 taskOrchestrator] Prompt adattati');

  console.log('[🔍 taskOrchestrator] createTaskFromTemplate COMPLETE', {
    nodesLength: nodes.length,
    stepsCount: Object.keys(task.steps || {}).length
  });

  return {
    nodes, // ✅ TaskTreeNode[] invece di dataTree
    steps: task.steps || {}
  };
}

/**
 * CASO 2: Nessun template candidato - Genera struttura nodi da AI
 *
 * Chiama AI per generare la struttura nodi iniziale.
 * Il preview e la generazione degli steps avvengono separatamente.
 */
export async function generateTaskStructureFromAI(
  label: string,
  provider: 'groq' | 'openai' = 'groq'
): Promise<SchemaNode[]> {
  console.log('[🔍 taskOrchestrator] generateTaskStructureFromAI START', {
    label,
    provider
  });

  const nodes = await generateStructureFromAI(label, provider);

  console.log('[🔍 taskOrchestrator] generateTaskStructureFromAI COMPLETE', {
    nodesLength: nodes.length,
    mainNodes: nodes.map((n: any) => ({ label: n.label, type: n.type }))
  });

  return nodes;
}

/**
 * CASO 2: Genera tutti gli steps da AI dopo conferma struttura
 *
 * Dopo che l'utente ha confermato la struttura, genera tutti gli steps.
 */
export async function generateTaskStepsFromAI(
  nodes: SchemaNode[],
  rootLabel: string,
  contextLabel: string,
  provider: 'groq' | 'openai' = 'groq',
  onProgress?: (current: number, total: number, stepLabel: string) => void
): Promise<any> {
  console.log('[🔍 taskOrchestrator] generateTaskStepsFromAI START', {
    nodesLength: nodes.length,
    rootLabel,
    contextLabel,
    provider,
    mainNodes: nodes.map((n: any) => ({ label: n.label, type: n.type }))
  });

  const task = await generateAllStepsFromAI(
    nodes,
    rootLabel,
    contextLabel,
    provider,
    onProgress
  );

  console.log('[🔍 taskOrchestrator] generateTaskStepsFromAI COMPLETE', {
    taskId: task.id,
    taskLabel: task.label,
    nodesLength: task.nodes?.length || 0,
    stepsCount: Object.keys(task.steps || {}).length
  });

  return task;
}

/**
 * Genera struttura nodi da AI (helper per CASO 2)
 */
export async function generateStructureFromAI(
  label: string,
  provider: 'groq' | 'openai' = 'groq',
  model?: string
): Promise<SchemaNode[]> {
  console.log('[🔍 taskOrchestrator] generateStructureFromAI START', {
    label,
    provider,
    model
  });

  // Usa callAIInference esistente
  const { callAIInference } = await import('../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

  const defaultModel = provider === 'groq'
    ? 'llama-3.1-70b-versatile'
    : 'gpt-4-turbo-preview';

  const result = await callAIInference(label, provider, model || defaultModel);

  if (!result) {
    throw new Error('[taskOrchestrator] AI call failed o restituito null');
  }

  const ai = result.ai || result;

  if (!ai.schema || !Array.isArray(ai.schema.data) || ai.schema.data.length === 0) {
    throw new Error('[taskOrchestrator] AI non ha restituito struttura dati valida');
  }

  // Converti in SchemaNode[]
  const nodes: SchemaNode[] = ai.schema.data.map((m: any) => ({
    label: m.label || m.name || 'Field',
    type: m.type || 'text',
    constraints: m.constraints || [],
    subTasks: (m.subTasks || []).map((s: any) => ({
      label: s.label || s.name || 'Field',
      type: s.type || 'text',
      constraints: s.constraints || [],
      subTasks: []
    }))
  }));

  console.log('[🔍 taskOrchestrator] generateStructureFromAI COMPLETE', {
    nodesLength: nodes.length,
    mainNodes: nodes.map((n: any) => ({ label: n.label, type: n.type }))
  });

  return nodes;
}
