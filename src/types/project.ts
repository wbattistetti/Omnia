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

export type ProjectData = {
  id?: string;
  name: string;
  industry: string;
  agentActs?: { items: any[] }[]; // Adjust 'any' to the correct type if known
  userActs?: any[];
  backendActions?: any[];
  conditions?: any[];
  tasks?: any[];
  macrotasks?: any[];
  // ...other fields as needed
};

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
  actId?: string;
  factoryId?: string;
  // Interaction mode for the agent act row
  mode: 'DataRequest' | 'DataConfirmation' | 'Message';
  // Optional compact label for chips (fallback to name/text when absent)
  shortLabel?: string;
  isNew?: boolean;
  bgColor?: string;
  textColor?: string;
  included?: boolean; // true se la row è inclusa nel flusso
}

// --- Flow Task model (for grouping nodes into a macro action) ---
export interface FlowTaskPayloadNode {
  id: string;
  position: { x: number; y: number };
  data: { title: string; rows: NodeRowData[] };
}

export interface FlowTaskPayloadEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface FlowTask extends ProjectEntityItem {
  nodeIds: string[];          // nodes included in the task (original ids)
  edgeIds: string[];          // internal edges removed from canvas
  entryEdges: string[];       // incoming from outside → inside
  exitEdges: string[];        // outgoing from inside → outside
  bounds: { x: number; y: number; w: number; h: number };
  payload: {
    nodes: FlowTaskPayloadNode[];
    edges: FlowTaskPayloadEdge[];
  };
}