export type EntityType = 'agentActs' | 'userActs' | 'backendActions' | 'conditions' | 'tasks' | 'macrotasks';

/**
 * Rappresenta un'entità generica di progetto (es. task, backend action, ecc.)
 */
export interface ProjectEntityItem {
  id: string;
  name: string;
  description: string;
}

/**
 * Rappresenta una categoria di entità (es. gruppo di agent acts, tasks, ecc.)
 * T è il tipo di item contenuto (default: ProjectEntityItem)
 */
export interface Category<T = ProjectEntityItem> {
  id: string;
  name: string;
  items: T[];
}

/**
 * Rappresenta un agent act, che può avere userActs associati (se interattivo)
 */
export interface AgentActItem extends ProjectEntityItem {
  userActs?: string[];
}

export interface ProjectData {
  agentActs: Category<AgentActItem>[];
  userActs: Category[];
  backendActions: Category[];
  conditions: Category[];
  tasks: Category[];
  macrotasks: Category[];
}

export interface ProjectInfo {
  id: string;
  name: string;
  description: string;
  template: string;
  language: string;
}

/**
 * Rappresenta una riga/azione di un nodo del flowchart
 */
export interface NodeRowData {
  id: string;
  text: string;
  userActs?: string[];
  categoryType?: EntityType;
  isNew?: boolean;
  bgColor?: string;
  textColor?: string;
  included?: boolean; // true se la row è inclusa nel flusso
}