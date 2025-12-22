import { TaskReference } from '../types';

export const normalizeTaskFromViewer = (item: any): TaskReference => {
  const task = item?.task ?? item?.action ?? item;
  const templateId = task?.templateId || task?.actionId || task?.id || (typeof task?.label === 'string' ? task.label.toLowerCase().replace(/\s+/g, '') : 'sayMessage');
  const color = task?.color || item?.color;
  const text = typeof task?.text === 'string' ? task.text : undefined;
  const textKey = task?.textKey || (task?.parameters?.find((p: any) => p.parameterId === 'text')?.value);

  // Generate taskId if not provided
  const taskId = task?.taskId || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Build parameters array
  const parameters = task?.parameters || (textKey ? [{ parameterId: 'text', value: textKey }] : []);

  return { templateId, taskId, parameters, text, color };
};
