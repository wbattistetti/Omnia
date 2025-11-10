export type EntityType = 'agentActs' | 'userActs' | 'backendActions' | 'conditions' | 'macrotasks';

// New explicit Agent Act types (authoritative)
export type ActType =
  | 'AIAgent'
  | 'Message'
  | 'DataRequest'
  | 'ProblemClassification'
  | 'Summarizer'
  | 'BackendCall'
  | 'Negotiation';

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
  // Authoritative type for visuals/behavior
  type?: ActType;
  // Optional category name; undefined means shown at root in the sidebar
  category?: string;
  // List of user acts for interactive acts (kept for compatibility)
  userActs?: string[];
  // ProblemClassification payload (act-owned). Present only when type === 'ProblemClassification'
  problem?: ProblemPayload;
}

export type ProjectData = {
  id?: string;
  name: string;
  industry: string;
  clientName?: string;
  ownerCompany?: string; // Owner del progetto lato azienda (chi lo costruisce)
  ownerClient?: string; // Owner del progetto lato cliente (chi lo commissiona)
  agentActs?: { id?: string; name?: string; items: AgentActItem[] }[];
  userActs?: any[];
  backendActions?: any[];
  conditions?: any[];
  tasks?: any[]; // Deprecated: kept for compatibility, new data goes to macrotasks
  macrotasks?: { id?: string; name?: string; items: Macrotask[] }[];
  // ...other fields as needed
};

// ---- ProblemClassification (Intent Editor) Act-owned model ----
export type Lang = 'it' | 'en' | 'pt';

export type ProblemIntentPhrase = { id: string; text: string; lang: Lang };

export type ProblemIntent = {
  id: string;
  name: string;
  threshold?: number;
  phrases: {
    matching: ProblemIntentPhrase[];
    notMatching: ProblemIntentPhrase[];
    keywords: { t: string; w: number }[];
  };
};

export type ProblemEditorTest = { id: string; text: string; status: 'unknown' | 'correct' | 'wrong' };

export type ProblemEditorState = {
  selectedIntentId?: string;
  tests: ProblemEditorTest[];
};

export type ProblemPayload = {
  version: 1;
  intents: ProblemIntent[];
  editor?: ProblemEditorState;
};

export interface ProjectInfo {
  id: string;
  name: string;
  description: string;
  template: string;
  language: string;
  clientName?: string;
  industry?: string;
  ownerCompany?: string; // Owner del progetto lato azienda (chi lo costruisce) - obbligatorio
  ownerClient?: string; // Owner del progetto lato cliente (chi lo commissiona) - opzionale
}

/**
 * Rappresenta una riga/azione di un nodo del flowchart
 * Tutti gli altri dati (type, templateId, intents) vengono dall'istanza
 *
 * Migration note: taskId is optional for backward compatibility
 * - If taskId is present: use it to reference Task
 * - If taskId is absent: use row.id as instanceId (legacy behavior)
 */
export interface NodeRowData {
  id: string;     // UUID della riga (topological ID)
  text: string;   // Testo visualizzato
  included?: boolean; // true se la row è inclusa nel flusso
  taskId?: string; // Reference to Task (new model) - if absent, row.id is used as instanceId (legacy)
}

// --- Macrotask model (for grouping nodes into a macro action) ---
export interface MacrotaskPayloadNode {
  id: string;
  position: { x: number; y: number };
  data: { title: string; rows: NodeRowData[] };
}

export interface MacrotaskPayloadEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface Macrotask extends ProjectEntityItem {
  nodeIds: string[];          // nodes included in the macrotask (original ids)
  edgeIds: string[];          // internal edges removed from canvas
  entryEdges: string[];       // incoming from outside → inside
  exitEdges: string[];        // outgoing from inside → outside
  bounds: { x: number; y: number; w: number; h: number };
  payload: {
    nodes: MacrotaskPayloadNode[];
    edges: MacrotaskPayloadEdge[];
  };
}