// Tipi base (adatta se hai già Task in types.ts)
export interface Task {
  id: string;
  type: string;
  label?: string;
  text: string;
  [key: string]: any;
}

// Factory per creare un nuovo task
export function createTask(data: Partial<Task>): Task {
  return {
    id: data.id || Math.random().toString(36).substr(2, 9),
    type: data.type || 'task',
    label: data.label || '',
    text: data.text ?? '',
    ...data,
  };
}

// Estrae tasks da una struttura dati raw (es: DDT, array, ecc)
export function extractTasks(raw: any): Task[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Task[];
  if (raw.tasks && Array.isArray(raw.tasks)) return raw.tasks as Task[];
  return [];
}

// Aggiorna un task in una lista
export function updateTask(tasks: Task[], updated: Task): Task[] {
  return tasks.map(t => t.id === updated.id ? { ...t, ...updated } : t);
}

// Rimuove un task per id
export function removeTask(tasks: Task[], id: string): Task[] {
  return tasks.filter(t => t.id !== id);
}


