// Tipi base (adatta se hai già Constraint in types.ts)
export interface Constraint {
  id: string;
  title: string;
  explanation?: string;
  [key: string]: any;
}

// Factory per creare un nuovo constraint
export function createConstraint(data: Partial<Constraint>): Constraint {
  return {
    id: data.id || Math.random().toString(36).substr(2, 9),
    title: data.title || 'Nuovo constraint',
    explanation: data.explanation || '',
    ...data,
  };
}

// Estrae constraints da una struttura dati raw (es: DDT, array, ecc)
export function extractConstraints(raw: any): Constraint[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Constraint[];
  if (raw.constraints && Array.isArray(raw.constraints)) return raw.constraints as Constraint[];
  return [];
}

// Aggiorna un constraint in una lista
export function updateConstraint(constraints: Constraint[], updated: Constraint): Constraint[] {
  return constraints.map(c => c.id === updated.id ? { ...c, ...updated } : c);
}

// Rimuove un constraint per id
export function removeConstraint(constraints: Constraint[], id: string): Constraint[] {
  return constraints.filter(c => c.id !== id);
} 