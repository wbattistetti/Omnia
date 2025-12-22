import { TaskReference } from '../types';

export const normalizeTaskFromViewer = (item: any): TaskReference => {
  // Handle both task objects and action catalog entries
  const task = item?.task ?? item?.action ?? item;

  // Extract templateId: prefer templateId, then actionId, then id from catalog
  const templateId = task?.templateId || task?.actionId || task?.id || (typeof task?.label === 'string' ? task.label.toLowerCase().replace(/\s+/g, '') : 'sayMessage');

  // Extract color from task/action or item
  const color = task?.color || item?.color;

  // Extract text (if already set)
  const text = typeof task?.text === 'string' ? task.text : undefined;

  // Extract label: prefer item.label (from ActionItem drag), then task.label, then action.label
  const label = item?.label || task?.label || (typeof task?.label === 'object' ? (task.label.it || task.label.en || task.label) : undefined);

  // Extract textKey from various possible locations
  const textKey = task?.textKey
    || (task?.parameters?.find((p: any) => p.parameterId === 'text')?.value)
    || (item?.parameters?.find((p: any) => p.key === 'text' || p.parameterId === 'text')?.value);

  // Generate taskId if not provided
  const taskId = task?.taskId || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Build parameters array
  // If task already has parameters, use them
  // Otherwise, if there's a textKey, create a parameter for it
  // For actions from catalog, parameters will be empty initially (user will fill them)
  let parameters: any[] = [];
  if (task?.parameters && Array.isArray(task.parameters)) {
    parameters = task.parameters;
  } else if (textKey) {
    parameters = [{ parameterId: 'text', value: textKey }];
  } else if (item?.parameters && Array.isArray(item.parameters)) {
    // Handle parameters from drag item (ActionItem passes parameters)
    parameters = item.parameters.map((p: any) => ({
      parameterId: p.key || p.parameterId || 'text',
      value: p.value || ''
    }));
  }

  return { templateId, taskId, parameters, text, color, label };
};
