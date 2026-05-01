import { TaskType, type SemanticValue } from './taskTypes';

export type EntityType = 'taskTemplates' | 'userTasks' | 'backendActions' | 'conditions' | 'macrotasks'; // ✅ RINOMINATO: userActs → userTasks

// ❌ RIMOSSO: ActType - sostituito con TaskType enum da taskTypes.ts
// ✅ Usa TaskType enum invece di stringhe semantiche

/**
 * Rappresenta un'entità generica di progetto (es. task, backend action, ecc.)
 */
export interface ProjectEntityItem {
  id: string;
  name: string;
  description: string;
}

/**
 * Condition Expression: contains DSL with GUIDs and compiled code
 * ✅ FASE 2: Simplified structure - readableCode is generated on-the-fly
 */
export interface ConditionExpression {
  /** DSL with GUIDs: [guid-2222] == 15 - source of truth */
  executableCode: string;
  /** JavaScript compiled from executableCode: return ctx["guid-2222"] == 15; */
  compiledCode: string;
  /** AST serialized (optional, for debug) */
  ast?: string;
  /** Format: "dsl" (default) */
  format?: string;
  // ❌ readableCode is NOT stored - generated on-the-fly from executableCode + variableMappings
}

/**
 * Condition Item: extends ProjectEntityItem with expression
 * ✅ FASE 2: Uses expression.* instead of data.*
 */
export interface ConditionItem extends ProjectEntityItem {
  label: string;
  expression: ConditionExpression;
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
 * Rappresenta un task catalog entry (sostituisce AgentActItem)
 */
export interface TaskTemplateItem extends ProjectEntityItem {
  // Authoritative type for visuals/behavior
  type?: TaskType; // ✅ FIX: ActType → TaskType (enum numerico)
  // Optional category name; undefined means shown at root in the sidebar
  category?: string;
  // List of user tasks for interactive tasks
  userTasks?: string[]; // ✅ RINOMINATO: userActs → userTasks
  // ProblemClassification payload (template-owned). Present only when type === TaskType.ClassifyProblem
  problem?: ProblemPayload;
}

// ❌ RIMOSSO: AgentActItem - non più necessario, usa TaskTemplateItem

/** @see `domain/backendCatalog/catalogTypes` — inventario backend designer-time (manuali + audit). */
export type ProjectBackendCatalogBlob = import('../domain/backendCatalog/catalogTypes').ProjectBackendCatalogBlob;

export type ProjectData = {
  id?: string;
  name: string;
  industry: string;
  clientName?: string;
  ownerCompany?: string; // Owner del progetto lato azienda (chi lo costruisce)
  ownerClient?: string; // Owner del progetto lato cliente (chi lo commissiona)
  version?: string; // es. "1.0"
  versionQualifier?: 'alpha' | 'beta' | 'rc' | 'production';
  taskTemplates?: { id?: string; name?: string; items: TaskTemplateItem[] }[];
  userTasks?: any[]; // ✅ RINOMINATO: userActs → userTasks
  backendActions?: any[];
  conditions?: any[];
  tasks?: any[]; // Deprecated: kept for compatibility, new data goes to macrotasks
  macrotasks?: { id?: string; name?: string; items: Macrotask[] }[];
  /** Catalogo backend (voci manuali + audit append-only); righe da grafo sono derivate dai task. */
  backendCatalog?: ProjectBackendCatalogBlob;
  // ...other fields as needed
};

// ---- ProblemClassification (Intent Editor) Task-owned model ---- // ✅ RINOMINATO: Act-owned → Task-owned
export type Lang = 'it' | 'en' | 'pt';

export type ProblemIntentPhrase = { id: string; text: string; lang: Lang };

export type ProblemIntent = {
  id: string;
  name: string;
  /** Business description for AI-generated training phrases. */
  description?: string;
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
  /** Labels + optional embedding training; persisted on Task.semanticValues. */
  semanticValues?: SemanticValue[];
  editor?: ProblemEditorState;
  /** Client-only: set when persisting to localStorage; merge vs Task.updatedAt. */
  persistedAt?: number;
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
  version?: string; // Versione in formato major.minor (es. "1.0")
  versionQualifier?: 'alpha' | 'beta' | 'rc' | 'production'; // Qualificatore versione
}

/**
 * Row-level metadata (UI-only / pre-task draft before TaskRepository has a task).
 */
export interface RowMeta {
  /** Pre-task semantic slot values; cleared after task creation. See semanticValuesRowState.ts */
  semanticValuesDraft?: SemanticValue[] | null;
  /** Stable promised variable GUID used by conditions, interface exposure, and utterance variable materialization. */
  variableRefId?: string;
  /** Subflow portal: child flow id when TaskRepository has not hydrated the Subflow task yet (DnD DOM markers). */
  subflowChildFlowId?: string;
}

/**
 * Rappresenta una riga/azione di un nodo del flowchart
 *
 * Architettura pulita:
 * - row.id ALWAYS equals task.id (quando task esiste)
 * - row.heuristics contiene solo dati euristici per lazy task creation
 * - Tutti gli altri dati (type, category, templateId) vengono dal task o da heuristics
 */
export interface NodeRowData {
  // ✅ Dati strutturali UI
  id: string;                    // UUID della riga - ALWAYS equals task.id when task exists
  text: string;                  // Testo visualizzato
  included?: boolean;            // Flag inclusione nel flusso

  // ✅ Dati euristici (SOLO quando task non esiste ancora - lazy creation)
  heuristics?: {
    type?: TaskType;              // Tipo dedotto dall'euristica
    templateId?: string | null;   // Template ID dedotto dall'euristica
    inferredCategory?: string | null; // Categoria semantica dedotta (es. 'problem-classification', 'choice', 'confirmation')
  };

  // ✅ Metadati UI/organizzativi
  factoryId?: string;             // ID template factory (quando la riga referenzia un template)
  isUndefined?: boolean;          // Flag tipo undefined (per UI - mostra icona "?")

  /** UI-only / pre-task draft storage (cleared when task is materialized). */
  meta?: RowMeta;
}

// --- Macrotask model (for grouping nodes into a macro action) ---
export interface MacrotaskPayloadNode {
  id: string;
  position: { x: number; y: number };
  label?: string;  // Node title (ex data.title)
  rows: NodeRowData[];  // Rows directly (ex data.rows)
  type?: string;  // ReactFlow type
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