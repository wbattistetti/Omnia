import { TaskReference } from '../types';

export const normalizeTaskFromViewer = (item: any): TaskReference => {
  // Handle task objects from catalog entries
  const task = item?.task ?? item;

  // Extract templateId: prefer templateId, then id from catalog
  const templateId = task?.templateId || task?.id || (typeof task?.label === 'string' ? task.label.toLowerCase().replace(/\s+/g, '') : 'sayMessage');

  // Extract color from task or item
  const color = task?.color || item?.color;

  // Extract text (if already set)
  const text = typeof task?.text === 'string' ? task.text : undefined;

  // Extract label: prefer item.label (from TaskItem drag), then task.label
  const label = item?.label || task?.label || (typeof task?.label === 'object' ? (task.label.it || task.label.en || task.label) : undefined);

  // ✅ IMPORTANTE: Ogni drop crea una NUOVA istanza del task
  // Il templateId punta al reference originale (template nel DB)
  // Ma taskId e textKey devono essere sempre nuovi per ogni drop

  // ✅ Use pre-generated taskId if provided (for idempotency), otherwise generate new one
  // Il taskId identifica l'istanza specifica del task nell'escalation
  const taskId = item?._generatedTaskId || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // ✅ Parameters vuoti per default - verranno popolati in useTaskCommands se necessario
  // Per sayMessage, verrà generato un nuovo textKey (GUID) in useTaskCommands
  // NON copiare i parameters dal catalogo perché ogni drop deve creare una nuova istanza
  let parameters: any[] = [];

  // ✅ Non copiare textKey dal catalogo - verrà generato un nuovo GUID se necessario
  // L'unica eccezione è se viene passato esplicitamente un textKey valido (GUID) dall'item
  // Ma in genere, per tasks dal catalogo, vogliamo generare un nuovo textKey

  return { templateId, taskId, parameters, text, color, label };
};
