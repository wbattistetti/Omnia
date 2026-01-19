import { TaskTemplateItem } from '../types/project';

/**
 * Restituisce il prompt principale di un Task.
 * Per Task di tipo DataRequest, cerca il primo messaggio start step
 */
export function getTaskPrompt(task: TaskTemplateItem | any): string {
  // Se è un Task con steps, cerca il primo messaggio start
  if (task?.steps) {
    const firstNodeId = Object.keys(task.steps)[0];
    const startStep = task.steps[firstNodeId]?.start;
    if (startStep?.escalations?.[0]?.tasks?.[0]?.parameters) {
      const textParam = startStep.escalations[0].tasks[0].parameters.find((p: any) => p.parameterId === 'text');
      if (textParam?.value) {
        return textParam.value; // GUID - sarà risolto dalle traduzioni
      }
    }
  }
  // Fallback: cerca examples (legacy)
  return Array.isArray(task?.examples) ? task.examples[0] : '';
}