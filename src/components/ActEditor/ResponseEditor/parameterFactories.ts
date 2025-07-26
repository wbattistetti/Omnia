// Tipi base (adatta se hai già Parameter in types.ts)
export interface Parameter {
  id: string;
  name: string;
  value?: any;
  [key: string]: any;
}

// Factory per creare un nuovo parametro
export function createParameter(data: Partial<Parameter>): Parameter {
  return {
    id: data.id || Math.random().toString(36).substr(2, 9),
    name: data.name || '',
    value: data.value,
    ...data,
  };
}

// Estrae parametri da una struttura dati raw (es: DDT, array, ecc)
export function extractParameters(raw: any): Parameter[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Parameter[];
  if (raw.parameters && Array.isArray(raw.parameters)) return raw.parameters as Parameter[];
  return [];
}

// Aggiorna un parametro in una lista
export function updateParameter(parameters: Parameter[], updated: Parameter): Parameter[] {
  return parameters.map(p => p.id === updated.id ? { ...p, ...updated } : p);
}

// Rimuove un parametro per id
export function removeParameter(parameters: Parameter[], id: string): Parameter[] {
  return parameters.filter(p => p.id !== id);
} 