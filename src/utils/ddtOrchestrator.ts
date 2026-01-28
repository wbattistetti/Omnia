/**
 * ddtOrchestrator.ts - Moduli di orchestrazione per creazione DDT
 *
 * Gestisce due flussi:
 * 1. Template candidato trovato → clona steps e adatta prompt
 * 2. Nessun template → genera struttura da AI e poi tutti gli steps
 */

import { buildDataTree } from './taskUtils';
import { CloneSteps } from './ddtStepsCloner';
import { AdaptPromptToContext } from './ddtPromptAdapter';
import { generateAllStepsFromAI } from './ddtStepGenerator';
import { DialogueTaskService } from '../services/DialogueTaskService';
import type { Task } from '../types/taskTypes';
import type { SchemaNode } from '../components/DialogueDataTemplateBuilder/DDTWizard/types';

/**
 * CASO 1: Template candidato trovato
 *
 * 1. Monta struttura dati dal template
 * 2. Mostra preview (TemplatePreviewDialog)
 * 3. Se confermato:
 *    - Clona steps dal template
 *    - Adatta prompt al contesto
 *    - Crea task con templateId
 */
export async function createDDTFromTemplate(
  templateId: string,
  task: Task,
  contextLabel: string,
  adaptAllNormalSteps: boolean = false
): Promise<{ dataTree: SchemaNode[]; steps: Record<string, any> }> {
  console.log('[🔍 ddtOrchestrator] createDDTFromTemplate START', {
    templateId,
    taskId: task.id,
    taskLabel: task.label,
    contextLabel,
    adaptAllNormalSteps
  });

  // 1. Carica template
  const template = DialogueTaskService.getTemplate(templateId);
  if (!template) {
    throw new Error(`[ddtOrchestrator] Template ${templateId} non trovato`);
  }

  // 2. Monta struttura dati dal template
  const dataTree = buildDataTree(template);
  console.log('[🔍 ddtOrchestrator] DataTree montato', {
    dataTreeLength: dataTree.length,
    mainNodes: dataTree.map((n: any) => ({ label: n.label, templateId: n.templateId }))
  });

  // 3. Clona steps dal template
  CloneSteps(dataTree, task);
  console.log('[🔍 ddtOrchestrator] Steps clonati', {
    stepsCount: Object.keys(task.steps || {}).length,
    stepsKeys: Object.keys(task.steps || {})
  });

  // 4. Adatta prompt al contesto
  await AdaptPromptToContext(task, contextLabel, adaptAllNormalSteps);
  console.log('[🔍 ddtOrchestrator] Prompt adattati');

  console.log('[🔍 ddtOrchestrator] createDDTFromTemplate COMPLETE', {
    dataTreeLength: dataTree.length,
    stepsCount: Object.keys(task.steps || {}).length
  });

  return {
    dataTree,
    steps: task.steps || {}
  };
}

/**
 * CASO 2: Nessun template candidato - Genera struttura dati da AI
 *
 * Chiama AI per generare la struttura dati iniziale.
 * Il preview e la generazione degli steps avvengono separatamente.
 */
export async function createDDTFromAI_GenerateStructure(
  label: string,
  provider: 'groq' | 'openai' = 'groq'
): Promise<SchemaNode[]> {
  console.log('[🔍 ddtOrchestrator] createDDTFromAI_GenerateStructure START', {
    label,
    provider
  });

  const dataTree = await generateStructureFromAI(label, provider);

  console.log('[🔍 ddtOrchestrator] createDDTFromAI_GenerateStructure COMPLETE', {
    dataTreeLength: dataTree.length,
    mainNodes: dataTree.map((n: any) => ({ label: n.label, type: n.type }))
  });

  return dataTree;
}

/**
 * CASO 2: Genera tutti gli steps da AI dopo conferma struttura
 *
 * Dopo che l'utente ha confermato la struttura, genera tutti gli steps.
 */
export async function createDDTFromAI_GenerateSteps(
  dataTree: SchemaNode[],
  rootLabel: string,
  contextLabel: string,
  provider: 'groq' | 'openai' = 'groq',
  onProgress?: (current: number, total: number, stepLabel: string) => void
): Promise<any> {
  console.log('[🔍 ddtOrchestrator] createDDTFromAI_GenerateSteps START', {
    dataTreeLength: dataTree.length,
    rootLabel,
    contextLabel,
    provider,
    mainNodes: dataTree.map((n: any) => ({ label: n.label, type: n.type }))
  });

  const ddt = await generateAllStepsFromAI(
    dataTree,
    rootLabel,
    contextLabel,
    provider,
    onProgress
  );

  console.log('[🔍 ddtOrchestrator] createDDTFromAI_GenerateSteps COMPLETE', {
    ddtId: ddt.id,
    ddtLabel: ddt.label,
    dataLength: ddt.data?.length || 0,
    stepsCount: Object.keys(ddt.steps || {}).length
  });

  return ddt;
}

/**
 * Genera struttura dati da AI (helper per CASO 2)
 */
export async function generateStructureFromAI(
  label: string,
  provider: 'groq' | 'openai' = 'groq',
  model?: string
): Promise<SchemaNode[]> {
  console.log('[🔍 ddtOrchestrator] generateStructureFromAI START', {
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
    throw new Error('[ddtOrchestrator] AI call failed o restituito null');
  }

  const ai = result.ai || result;

  if (!ai.schema || !Array.isArray(ai.schema.data) || ai.schema.data.length === 0) {
    throw new Error('[ddtOrchestrator] AI non ha restituito struttura dati valida');
  }

  // Converti in SchemaNode[]
  const dataTree: SchemaNode[] = ai.schema.data.map((m: any) => ({
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

  console.log('[🔍 ddtOrchestrator] generateStructureFromAI COMPLETE', {
    dataTreeLength: dataTree.length,
    mainNodes: dataTree.map((n: any) => ({ label: n.label, type: n.type }))
  });

  return dataTree;
}
