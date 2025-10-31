import { Action } from '../types';

export const normalizeActionFromViewer = (item: any): Action => {
  const action = item?.action ?? item;
  const actionId = action?.actionId || action?.id || (typeof action?.label === 'string' ? action.label.toLowerCase().replace(/\s+/g, '') : 'custom');
  const color = action?.color || item?.color;
  const text = typeof action?.text === 'string' ? action.text : undefined;
  // icon e label vengono sempre da getActionIconNode/getActionLabel centralizzate
  return { actionId, color, text } as Action;
};
