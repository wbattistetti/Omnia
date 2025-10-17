import { Action } from '../types';

const toStringLabel = (label: any): string | undefined => {
  if (typeof label === 'string') return label;
  if (label && typeof label === 'object') return label.en || label.it || label.pt || Object.values(label)[0] as string;
  return undefined;
};

export const normalizeActionFromViewer = (item: any): Action => {
  const action = item?.action ?? item;
  const actionId = action?.actionId || action?.id || (typeof action?.label === 'string' ? action.label.toLowerCase().replace(/\s+/g, '') : 'custom');
  const icon = action?.icon || item?.icon || actionId;
  const color = action?.color || item?.color;
  const label = toStringLabel(action?.label) || actionId;
  const text = typeof action?.text === 'string' ? action.text : undefined;
  return { actionId, icon, color, label, text } as Action;
};
