// New Task-based model types
// These types are added alongside existing types for gradual migration

import type { NormalizedIaProviderError } from '@domain/compileErrors/iaProviderErrors';

/**
 * TaskContext: Enumerated contexts where a TaskInstance can be inserted
 */
export enum TaskContext {
  NodeRow = 'NodeRow',      // Riga di nodo nel flowchart
  Response = 'Response'     // Dentro escalation di step in DDT
}

/**
 * TemplateSource: Origin of a template
 * - Project: Template created in the project (default)
 * - Factory: Template saved to general library (Factory database)
 */
export enum TemplateSource {
  Project = 'Project',  // Default: template created in project
  Factory = 'Factory'  // Template saved to general library
}

/**
 * TaskType: allineato a VB.NET `Common/Types/TaskTypes.vb` (0–7 identici).
 * 8–10 = solo client (Summarizer/Negotiation/FaqAnswering; allineare VB quando serve).
 */
export enum TaskType {
  UNDEFINED = -1,
  SayMessage = 0,
  CloseSession = 1,
  Transfer = 2,
  UtteranceInterpretation = 3,
  BackendCall = 4,
  ClassifyProblem = 5,
  AIAgent = 6,
  Subflow = 7,
  Summarizer = 8,
  Negotiation = 9,
  FaqAnswering = 10
}

/** Prima dell’allineamento, `Flow` era enum 9 → usare `normalizeLegacyTaskTypeValue` in lettura. */
export const LEGACY_TASK_TYPE_FLOW_NUM = 9;

/** Normalizza numeri salvati con il vecchio enum (9 = Flow → Subflow). */
export function normalizeLegacyTaskTypeValue(type: number | undefined | null): TaskType {
  if (type === undefined || type === null || Number.isNaN(type)) return TaskType.UNDEFINED;
  if (type === LEGACY_TASK_TYPE_FLOW_NUM) return TaskType.Subflow;
  return type as TaskType;
}

/**
 * ✅ Helper: Converte TaskType enum → templateId string (per Task.templateId)
 */
export function taskTypeToTemplateId(type: TaskType): string | null {
  switch (type) {
    case TaskType.SayMessage: return 'SayMessage';
    case TaskType.UtteranceInterpretation: return 'UtteranceInterpretation';
    case TaskType.ClassifyProblem: return 'ClassifyProblem';
    case TaskType.BackendCall: return 'BackendCall';
    case TaskType.CloseSession: return 'CloseSession';
    case TaskType.Transfer: return 'Transfer';
    case TaskType.AIAgent: return 'AIAgent';
    case TaskType.Subflow: return 'Subflow';
    case TaskType.Summarizer: return 'Summarizer';
    case TaskType.Negotiation: return 'Negotiation';
    case TaskType.FaqAnswering: return 'FaqAnswering';
    case TaskType.UNDEFINED: return 'UNDEFINED';
    default: return null;
  }
}

/**
 * ✅ Helper: Converte templateId string → TaskType enum
 */
export function templateIdToTaskType(templateId: string | null | undefined): TaskType {
  if (!templateId) return TaskType.UNDEFINED;
  const normalized = templateId.toLowerCase().trim();
  switch (normalized) {
    case 'saymessage': return TaskType.SayMessage;
    case 'message': return TaskType.SayMessage;
    case 'utteranceinterpretation': return TaskType.UtteranceInterpretation;
    case 'classifyproblem': return TaskType.ClassifyProblem;
    case 'backendcall': return TaskType.BackendCall;
    case 'closesession': return TaskType.CloseSession;
    case 'transfer': return TaskType.Transfer;
    case 'aiagent': return TaskType.AIAgent;
    case 'subflow': return TaskType.Subflow;
    case 'summarizer': return TaskType.Summarizer;
    case 'negotiation': return TaskType.Negotiation;
    case 'faqanswering': return TaskType.FaqAnswering;
    case 'flow': return TaskType.Subflow;
    case 'undefined': return TaskType.UNDEFINED;
    default: return TaskType.UNDEFINED;
  }
}

/**
 * ✅ Helper: Converte stringa semantica legacy (da UI/Intellisense/database) → TaskType enum
 * ⚠️ TEMPORANEO: Usato per backward compatibility durante la migrazione
 * TODO: Eliminare quando tutti i punti che passano stringhe semantiche saranno aggiornati a TaskType enum
 *
 * @param taskId - Stringa semantica legacy (es. "Message", "DataRequest", "ProblemClassification")
 * @returns TaskType enum corrispondente
 */
export function taskIdToTaskType(taskId: string): TaskType { // ✅ RINOMINATO: actIdToTaskType → taskIdToTaskType
  const normalized = taskId.toLowerCase().trim(); // ✅ FIX: actId → taskId

  // Mapping taskId (UI) → TaskType enum
  switch (normalized) {
    case 'message': return TaskType.SayMessage;
    case 'utteranceinterpretation': return TaskType.UtteranceInterpretation;
    case 'problemclassification': return TaskType.ClassifyProblem;
    case 'classifyproblem': return TaskType.ClassifyProblem;
    case 'backendcall': return TaskType.BackendCall;
    case 'callbackend': return TaskType.BackendCall;
    case 'closesession': return TaskType.CloseSession;
    case 'transfer': return TaskType.Transfer;
    case 'aiagent': return TaskType.AIAgent;
    case 'summarizer': return TaskType.Summarizer;
    case 'negotiation': return TaskType.Negotiation;
    case 'faqanswering': return TaskType.FaqAnswering;
    case 'subflow': return TaskType.Subflow;
    case 'flow': return TaskType.Subflow;
    case 'undefined': return TaskType.UNDEFINED;
    default: return TaskType.UNDEFINED;
  }
}

/**
 * ✅ Helper: Converte HeuristicType string (legacy) → TaskType enum
 * Usato durante la migrazione per compatibilità
 * @deprecated Usa taskIdToTaskType() invece
 */
export function heuristicStringToTaskType(heuristic: string): TaskType {
  const normalized = heuristic.toUpperCase().trim();
  switch (normalized) {
    case 'MESSAGE': return TaskType.SayMessage;
    case 'REQUEST_DATA': return TaskType.UtteranceInterpretation;
    case 'PROBLEM_SPEC': return TaskType.ClassifyProblem;
    case 'BACKEND_CALL': return TaskType.BackendCall;
    case 'AI_AGENT': return TaskType.SayMessage; // Default to SayMessage
    case 'NEGOTIATION': return TaskType.SayMessage; // Default to SayMessage
    case 'SUMMARY': return TaskType.SayMessage; // Default to SayMessage
    case 'UNDEFINED': return TaskType.UNDEFINED;
    default: return TaskType.UNDEFINED;
  }
}

/**
 * ✅ Helper: Converte TaskType enum → string per euristica 2 (DDTTemplateMatcherService)
 */
export function taskTypeToHeuristicString(type: TaskType): string | null {
  switch (type) {
    case TaskType.UtteranceInterpretation: return 'UtteranceInterpretation';
    case TaskType.SayMessage: return 'Message';
    case TaskType.UNDEFINED: return 'UNDEFINED';
    default: return null;
  }
}

/**
 * Helper: Deriva il tipo di editor da TaskType
 */
export function getEditorFromTaskType(type: TaskType): 'message' | 'ddt' | 'problem' | 'backend' | 'simple' | 'aiagent' | 'summarizer' | 'negotiation' | 'faqanswering' | 'flow' {
  switch (type) {
    case TaskType.Subflow:
      return 'flow'; // Opens subflow tab, no task editor
    case TaskType.SayMessage:
    case TaskType.CloseSession:
    case TaskType.Transfer:
      return 'message';
    case TaskType.UtteranceInterpretation:
      return 'ddt';
    case TaskType.AIAgent:
      return 'aiagent';
    case TaskType.Summarizer:
      return 'summarizer';
    case TaskType.Negotiation:
      return 'negotiation';
    case TaskType.FaqAnswering:
      return 'faqanswering';
    case TaskType.ClassifyProblem:
      return 'ddt'; // ✅ UNIFICATO: ClassifyProblem ora usa ResponseEditor (DDT) come UtteranceInterpretation
    case TaskType.BackendCall:
      return 'backend';
    default:
      return 'simple';
  }
}

/**
 * ✅ Helper: Verifica se un task è di tipo UtteranceInterpretation
 * Sostituisce stringhe hardcoded come templateId.toLowerCase() !== 'datarequest'
 */
export function isUtteranceInterpretationTask(task: { type?: TaskType; templateId?: string | null } | null | undefined): boolean {
  if (!task) return false;
  if (task.type !== undefined) {
    return task.type === TaskType.UtteranceInterpretation;
  }
  if (task.templateId) {
    return templateIdToTaskType(task.templateId) === TaskType.UtteranceInterpretation;
  }
  return false;
}

/**
 * ✅ Helper: Verifica se un templateId corrisponde a UtteranceInterpretation
 * Sostituisce stringhe hardcoded come templateId.toLowerCase() === 'datarequest'
 */
export function isUtteranceInterpretationTemplateId(templateId: string | null | undefined): boolean {
  if (!templateId) return false;
  return templateIdToTaskType(templateId) === TaskType.UtteranceInterpretation;
}

/**
 * TaskCatalog: Defines a type of executable task (catalog entry)
 * Replaces: AgentActs, Action Catalog entries
 *
 * TaskCatalog è organizzato per scope:
 * - global: disponibile in tutti i progetti
 * - industry: disponibile solo per progetti di quell'industry
 * - client: disponibile solo nel progetto specifico
 *
 * ✅ REFACTORED: id è GUID (univoco), type è enum numerato, editor derivabile da type
 */
export interface TaskCatalog {
  id: string;                    // ✅ GUID univoco (permette più catalog entries dello stesso tipo)
  label: string;                 // Display label
  description: string;           // Description
  icon: string;                  // Icon name (e.g. "MessageCircle", "HelpCircle")
  color: string;                 // UI color (e.g. "text-blue-500")
  type: TaskType;                // ✅ Enum numerato (comportamento: DataRequest, SayMessage, ecc.)
  name?: string;                 // ✅ Nome semantico (opzionale, per built-in: "UtteranceInterpretation", "SayMessage")
  contexts: TaskContext[];        // ✅ Where this catalog entry can be inserted

  // Signature: Input parameters schema (if needed)
  signature?: {
    params: {
      [key: string]: {
        type: string;
        required?: boolean;
        multilang?: boolean;
        multistyle?: boolean;
        default?: any;
      };
    };
  };

  // ValueSchema: Defines the structure of Task.value
  // ❌ REMOVED: editor (derivabile da type con getEditorFromTaskType())
  valueSchema: {                 // Defines Task.value structure
    keys: {                        // Valid keys in Task.value
      [key: string]: {
        type: 'string' | 'object' | 'array' | 'ddt' | 'problem';
        required?: boolean;
        description?: string;
        // IDE mapping: How to render in the editor
        ideMapping?: {
          control: 'text' | 'textarea' | 'ddt-editor' | 'problem-editor' | 'json';
          label?: string;
          placeholder?: string;
        };
      };
    };
  };

  scope?: 'global' | 'industry' | 'client';  // Scope del catalog entry
  industry?: string;             // Industry specifico (se scope='industry')
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * TaskHeuristic: Pattern-based rules for task type detection
 * Replaces: act_type_patterns
 */
export interface TaskHeuristic {
  type: 'MESSAGE' | 'REQUEST_DATA' | 'PROBLEM' | 'BACKEND_CALL' | 'AI_AGENT' | 'PROBLEM_SPEC_DIRECT' | 'PROBLEM_REASON' | 'SUMMARY' | 'NEGOTIATION';
  patterns: string[];             // Array di regex patterns
  language: string;               // 'IT', 'EN', 'PT', etc.
}

/**
 * Task: Unified structure for all tasks
 *
 * - type: TaskType enum numerico (allineato VB 0–7 + client 8–9) → Determina il comportamento del task
 * - templateId = null → Crea automaticamente un nuovo template (ogni task ha sempre un templateId)
 * - templateId = GUID → Task che referenzia un template (per ereditare struttura/contratti)
 *
 * IMPORTANTE:
 * - Ogni task DEVE avere un templateId (o viene creato automaticamente)
 * - Non esistono più "task standalone" come concetto separato
 * - La struttura (data, constraints, dataContract) viene sempre dal template, non dall'istanza
 * - L'istanza contiene solo override: steps, label, introduction
 *
 * Esempi:
 * - Task con template: { id: "guid", type: TaskType.UtteranceInterpretation, templateId: "template-guid", label: "...", steps: {...} }
 * - Task senza templateId: { id: "guid", type: TaskType.UtteranceInterpretation, templateId: null, ... } → viene creato template automaticamente
 */
/**
 * Materialized Step: Step materializzato nell'istanza
 *
 * Semantica:
 * - Step derivato dal template: ha templateStepId → deriva da uno step del template
 * - Step aggiunto dall'utente: ha solo id, senza templateStepId → aggiunto nell'istanza, non esiste nel template
 */
export interface MaterializedStep {
  id: string;                    // ✅ Nuovo GUID per l'istanza
  templateStepId?: string;        // ✅ GUID dello step del template (presente solo se step derivato dal template)
  escalations: any[];             // ✅ Escalations (unica parte modificabile)
}

/**
 * Embedding motor training data for one semantic value (classify / similarity).
 */
export interface SemanticValueEmbedding {
  threshold?: number;
  enabled?: boolean;
  /** Business description used for LLM-assisted phrase generation (intent editor). */
  description?: string;
  phrases?: {
    matching: Array<{ id: string; text: string; lang?: string }>;
    notMatching: Array<{ id: string; text: string; lang?: string }>;
    keywords: Array<{ t: string; w: number }>;
  };
}

/**
 * Closed-domain value for semantic slots (e.g. motivo = {billing, cancellation, ...}).
 * Optional embedding holds phrases/threshold when using the embedding recognizer.
 */
export interface SemanticValue {
  id: string;
  label: string;
  embedding?: SemanticValueEmbedding;
}

/**
 * Inferred UI label for a task row (no persisted flag). "embedded" = no templateId + local subTasks graph.
 */
export type TaskKind = 'embedded' | 'instance' | 'projectTemplate' | 'factoryTemplate';

/**
 * TaskTreeNode: nodo dell'albero (sidebar) e persistenza `Task.subTasks` (UtteranceInterpretation).
 *
 * - `id` e opzionale `taskId` puntano alla riga Task nel repository (stesso valore quando materializzato).
 * - `templateId` su nodo: se valorizzato, contract di definizione si risolvono da quel task id nel repository;
 *   se null, contract incorporati sul task puntato da `taskId`/`id`.
 * - Struttura gerarchica: `subNodes` (UI) = stesso concetto di sub-task annidati persistiti.
 */
export interface TaskTreeNode {
  /** Identità nel grafo / sidebar; di solito uguale alla riga Task (`taskId`). */
  id: string;
  /** Opzionale: id riga Task nel repository per questo nodo (se omesso si usa `id`). */
  taskId?: string;
  /** Id task di definizione per i contract (repository); null/undefined = contract incorporati sul task del nodo. */
  templateId?: string | null;
  /** Opzionale: id riga template di catalogo quando `templateId` è solo id di grafo. */
  catalogTemplateId?: string;
  label: string;                  // ✅ Label del nodo
  type?: string;                  // ✅ Tipo del dato (es. 'date', 'email', 'text')
  icon?: string;                  // ✅ Icona per UI
  constraints?: any[];            // ✅ Default da template; override possibili su istanza
  dataContract?: any;             // Override/incorporato sul task del nodo quando templateId assente
  /** Behaviour steps (dizionario per chiave logica); fonte di verità per istanza sul nodo. */
  steps?: Record<string, Record<string, any>>;
  subNodes?: TaskTreeNode[];     // ✅ Nodi figli (ricorsivo)
  subTaskKey?: string;            // ✅ Chiave tecnica stabile per named groups regex (derivata da labelKey/label/name/id)
  /** Wizard variable naming (structure proposal); optional, editor-only hints */
  readableName?: string;
  dottedName?: string;
}

/**
 * TaskTree: Vista runtime costruita da Template + Instance
 * NON è un'entità persistita, NON è un DDT rinominato
 * È solo una vista in memoria per l'editor, costruita dinamicamente
 *
 * Costruzione:
 * - Template fornisce: struttura (nodes), constraints, dataContract
 * - Instance fornisce: steps override, label override, introduction override
 *
 * Uso:
 * - ResponseEditor usa TaskTree per mostrare la struttura nella sidebar
 * - TaskTree viene costruito ogni volta che si apre l'editor (non viene salvato)
 */
export interface TaskTree {
  labelKey: string;              // ✅ Translation key (es. "ask_patient_birthdate") - NON testo diretto
  nodes: TaskTreeNode[];         // ✅ Nodi principali (costruiti da template.subTasksIds)
  steps: Record<string, Record<string, any>>;  // ✅ Steps come dictionary: { "templateId": { "start": {...}, "noMatch": {...}, ... } }
  constraints?: any[];           // ✅ Dal template (sempre)
  dataContract?: any;            // ✅ Dal template (sempre)
  introduction?: any;             // ✅ Opzionale (da instance se override)
  /** Display title of the task in the editor (distinct from labelKey). */
  label?: string;
  /**
   * When multiple main nodes exist, sidebar shows an aggregate row; this is its title (e.g. "Dati personali").
   * Not a TaskTreeNode — presentation only. Do not use for taskTree.introduction (flow escalations).
   */
  aggregateLabel?: string;
}

export interface Task {
  id: string;                    // ✅ GUID univoco
  type: TaskType;                 // ✅ Enum numerico (allineato VB) - Determina il comportamento del task
  templateId: string | null;      // ✅ null = crea template automaticamente, GUID = referenzia un template
  templateVersion?: number;       // ✅ Versione del template usata per creare l'istanza (per drift detection)
  source?: TemplateSource;       // ✅ Origin of template: 'Project' (default) or 'Factory'
  // ✅ Campi diretti (niente wrapper value):
  // Per DataRequest/UtteranceInterpretation:
  labelKey?: string;              // ✅ Translation key per la label (es. "ask_patient_birthdate") - NON testo diretto
  // ✅ NUOVO: subTasksIds - Solo per template: array di templateId che referenziano altri template
  // Per istanze: sempre undefined (la struttura viene dal template)
  subTasksIds?: string[];        // ✅ Array di templateId (solo per template, non per istanze)
  // ❌ RIMOSSO: data - Non più persistito. Costruisci TaskTree da templateId usando buildTaskTree()
  // ❌ RIMOSSO: constraints - Vengono sempre dal template, non dall'istanza
  // ❌ RIMOSSO: examples - Vengono sempre dal template, non dall'istanza
  // ❌ RIMOSSO: dataContract - Viene sempre dal template, non dall'istanza
  dialogueSteps?: any[];         // ✅ Flat dialogue steps array (replaces nested data[].steps) - DEPRECATED
  steps?: Record<string, Record<string, any>>;  // ✅ Steps come dictionary: { "templateId": { "start": {...}, "noMatch": {...}, ... } }
  // ❌ RIMOSSO: steps - use steps instead
  introduction?: any;             // ✅ Introduction override (opzionale)
  // ❌ RIMOSSO: text?: string - Il task deve contenere solo GUID nei parameters
  // Il modello corretto è: task.parameters = [{ parameterId: 'text', value: GUID }]
  // La traduzione è in translations[GUID], NON in task.text
  // Closed semantic domain for a data slot. null/undefined = open domain (no fixed values).
  // ClassifyProblem / embedding: use semanticValues[].embedding for training (no separate intents field).
  semanticValues?: SemanticValue[] | null;
  // Per BackendCall:
  endpoint?: string;             // API endpoint
  method?: string;              // HTTP method
  params?: Record<string, any>;  // Parameters

  // Per AIAgent (design-time + runtime prompt persistence):
  agentDesignDescription?: string;
  agentPrompt?: string;
  /** JSON string: structured sections with per-section revision state (base + deletedMask + inserts). */
  agentStructuredSectionsJson?: string;
  /** Keys: AI Agent output slotId (GUID). Values: project variable varId. */
  outputVariableMappings?: Record<string, string>;
  agentProposedFields?: Array<{ slotId: string; label: string; type: string; required: boolean }>;
  agentSampleDialogue?: Array<{ role: string; content: string }>;
  /** Anteprima design-time per stile (contenuto + note designer). */
  agentPreviewByStyle?: Record<string, Array<{ role: string; content: string; designerNote?: string; logicalStepId?: string }>>;
  agentPreviewStyleId?: string;
  agentInitialStateTemplateJson?: string;
  /** JSON string: compact runtime rules from design-time generate (`runtime_compact`). */
  agentRuntimeCompactJson?: string;
  /** Dopo "Implement": design congelato (solo lettura fino a sblocco). */
  agentDesignFrozen?: boolean;
  /** True dopo almeno una generazione LLM riuscita (etichetta Create vs Refine). */
  agentDesignHasGeneration?: boolean;
  /** Target platform id for deterministic prompt compilation previews (`@domain/agentPrompt`). */
  agentPromptTargetPlatform?: string;
  /** JSON array: logical steps for use case composer (design-time). */
  agentLogicalStepsJson?: string;
  /** JSON array: use cases tree + dialogue (design-time). */
  agentUseCasesJson?: string;
  /** JSON string: full {@link IAAgentConfig} (`types/iaAgentRuntimeSetup`) override for runtime motors (per task). */
  agentIaRuntimeOverrideJson?: string;
  /**
   * When true, runtime starts the agent turn without waiting for real user input (orchestrator injects synthetic utterance).
   */
  agentImmediateStart?: boolean;

  /** Client-only: last IA provisioning failure for this row (never persisted). */
  provisioningError?: NormalizedIaProviderError;

  /**
   * Persisted sub-task tree for UtteranceInterpretation (structure + refs; steps/contracts on each Task row).
   * Same shape as `TaskTree.nodes` / sidebar.
   */
  subTasks?: TaskTreeNode[];

  /**
   * Policy S2: explicit mapping child interface parameter id → parent flow variable id (GUIDs always differ).
   * @see subflowBindings
   */
  subflowBindingsSchemaVersion?: number;
  /** Each row: child `interfaceParameterId` ↔ parent `parentVariableId`. */
  subflowBindings?: Array<{ interfaceParameterId: string; parentVariableId: string }>;

  /**
   * Optional: flow canvas id (`main`, `subflow_*`) that owns authoring for this task row after moves.
   * TaskRepository remains global per project; this marks which canvas materialized the instance.
   */
  authoringFlowCanvasId?: string;

  /**
   * Backend Call: meta dopo Read API (OpenAPI) per catalogo backend + badge stale in designer-time.
   * @see `BackendCallSpecMeta` in `domain/backendCatalog/catalogTypes.ts`
   */
  backendCallSpecMeta?: import('../domain/backendCatalog/catalogTypes').BackendCallSpecMeta;

  /**
   * Precomputed GUID-form reference corpus for this task (messages, scripts, API strings), refreshed on
   * editor close / project save. Used to speed variable reference scanning; if absent, the scanner
   * reconstructs from task JSON.
   */
  referenceScanInternalText?: string;

  /** FaqAnswering: ontology document title (embedded tree name). */
  faqAnsweringTreeName?: string;
  /** FaqAnswering: root ontology nodes (single JSON document on the task). */
  faqAnsweringRoot?: import('./faqOntology').OntologyNode[];

  // ✅ TODO FUTURO: Category System (vedi documentation/TODO_NUOVO.md)
  // category?: string;              // ID categoria (preset o custom)
  // categoryCustom?: CustomCategory; // Se custom, dettagli completi

  // Generic fields:
  [key: string]: any;           // Allow additional fields
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * TaskInstance: Alias for Task (for backward compatibility during migration)
 * @deprecated Use Task instead
 */
export type TaskInstance = Task;

/**
 * FlowRow: Topological element in the flowchart
 * Replaces: NodeRowData (but keeps topology separate from Task logic)
 * Relationship: 1:1 with Task (row.id === task.id ALWAYS)
 */
export interface FlowRow {
  id: string;                    // Topological ID of the row (position in graph) - ALWAYS equals task.id when task exists
  text: string;                  // Display text
  included?: boolean;            // If included in flow
  order?: number;                 // Execution order in node (for sequence)
}

// ❌ RIMOSSO: taskTypeToModeString e modeStringToTaskType - non servono più, backend usa solo type (TaskType enum)

