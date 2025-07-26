// Tipi base (adatta se hai già Action in types.ts)
export interface Action {
  id: string;
  type: string;
  label?: string;
  text: string;
  [key: string]: any;
}

// Factory per creare una nuova action
export function createAction(data: Partial<Action>): Action {
  return {
    id: data.id || Math.random().toString(36).substr(2, 9),
    type: data.type || 'action',
    label: data.label || '',
    text: data.text ?? '',
    ...data,
  };
}

// Estrae actions da una struttura dati raw (es: DDT, array, ecc)
export function extractActions(raw: any): Action[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Action[];
  if (raw.actions && Array.isArray(raw.actions)) return raw.actions as Action[];
  return [];
}

// Aggiorna una action in una lista
export function updateAction(actions: Action[], updated: Action): Action[] {
  return actions.map(a => a.id === updated.id ? { ...a, ...updated } : a);
}

// Rimuove una action per id
export function removeAction(actions: Action[], id: string): Action[] {
  return actions.filter(a => a.id !== id);
} 