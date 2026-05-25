/**
 * React context supplying live AI Agent editor state to outer Dockview panel bodies (description, structured, dati, use cases).
 */

import React from 'react';
import type { AIAgentProposedVariable } from '@types/aiAgentDesign';
import type { ConversationalRule } from '@domain/conversationalRules/types';
import type {
  AIAgentLogicalStep,
  AIAgentUseCase,
  AIAgentUseCaseCategory,
} from '@types/aiAgentUseCases';
import type { AIAgentPreviewTurn } from '@types/aiAgentPreview';
import type { ConversationStyleSelections } from '@domain/aiAgentConversationStyle/conversationStyleSelections';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import type { OtOp } from './otTypes';
import type { StructuredSectionsRevisionState } from './structuredSectionsRevisionReducer';
import type { IaSectionDiffPair } from './iaSectionDiffTypes';
import type { RevisionBatchOp } from './textRevisionLinear';
import type { AgentPromptPlatformId, BackendPlaceholderInstance, PlatformPromptOutput } from '@domain/agentPrompt';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import type { UseCaseGeneratorWizardModel } from './useCaseGeneratorWizard/useUseCaseGeneratorWizard';
import type { UseCaseSiblingSortMode } from './useCaseHierarchy';
import type { MappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import type { KbDocumentPatch, StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import type { AiCallMeta } from '@services/aiAgentDesignApi';

/** Triade `(purpose, taskId, taskLabel)` serializzabile verso `/design/*` — allineato a {@link AiCallMeta}. */
/** Which catalog the use-case composer is editing in the Prompts step. */
export type UseCaseCatalogMode = 'prompts' | 'error_handling';

export type AIAgentPropagatorCallMeta = {
  readonly purpose?: string;
  readonly taskId?: string;
  readonly taskLabel?: string;
};

export interface AIAgentEditorDockContextValue {
  instanceId: string | undefined;
  hasAgentGeneration: boolean;
  designDescription: string;
  setDesignDescription: (value: string) => void;
  /** Baseline testo per rilevare edit sostanziali e proporre polish descrizione. */
  designDescriptionPolishBaseline: string;
  /** Pillola «riformatta senza cambiare contenuto» visibile dopo edit significative. */
  showDesignDescriptionPolishOffer: boolean;
  designDescriptionPolishBusy: boolean;
  onPolishDesignDescription: () => void | Promise<void>;
  onDismissDesignDescriptionPolishOffer: () => void;
  composedRuntimeMarkdown: string;
  /** True when structured sections diverge from last committed snapshot (Create/Refine baseline). */
  structuredDesignDirty: boolean;
  structuredSectionsState: StructuredSectionsRevisionState;
  onApplyRevisionOps: (sectionId: AgentStructuredSectionId, ops: readonly RevisionBatchOp[]) => void;
  /** When {@link structuredOtEnabled}, structured sections may commit UTF-16 OT ops instead of linear batch ops. */
  onApplyOtCommit: (sectionId: AgentStructuredSectionId, newOps: readonly OtOp[]) => void;
  /** Undo/redo last committed edit for a structured section (Ctrl+Z / Ctrl+Y in revision editor). */
  onUndoSection: (sectionId: AgentStructuredSectionId) => void;
  onRedoSection: (sectionId: AgentStructuredSectionId) => void;
  structuredOtEnabled: boolean;
  iaRevisionDiffBySection: Partial<Record<AgentStructuredSectionId, IaSectionDiffPair>> | null;
  onDismissIaRevisionForSection: (sectionId: AgentStructuredSectionId) => void;
  generating: boolean;
  /** Whether the dock shows the right column (Dati / Use case); drives header actions visibility. */
  showRightPanel: boolean;
  /** Primary action (Create / Refine) rendered by panels that previously showed it in the left column. */
  headerAction: React.ReactNode;
  primaryAgentActionLabel: string;
  proposedFields: AIAgentProposedVariable[];
  outputVariableMappings: Record<string, string>;
  onUpdateProposedField: (slotId: string, patch: Partial<AIAgentProposedVariable>) => void;
  onRemoveProposedField: (slotId: string) => void;
  /** Append proposed variable rows (e.g. Workspace ElevenLabs import). */
  appendProposedFields: (fields: AIAgentProposedVariable[]) => void;
  onProposedLabelBlur: (slotId: string, labelTrimmed: string) => void;
  logicalSteps: readonly AIAgentLogicalStep[];
  useCases: readonly AIAgentUseCase[];
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  useCaseCategories: readonly AIAgentUseCaseCategory[];
  setUseCaseCategories: React.Dispatch<React.SetStateAction<AIAgentUseCaseCategory[]>>;
  conversationalRules: readonly ConversationalRule[];
  setConversationalRules: React.Dispatch<React.SetStateAction<ConversationalRule[]>>;
  /** Prompts step: business use cases vs error-handling rules (separate JSON). */
  useCaseCatalogMode: UseCaseCatalogMode;
  useCaseComposerBusy: boolean;
  /** Generazione / estensione lista use case (LLM bundle); separato da propagazione stile. */
  useCaseBundleGenerationBusy: boolean;
  /** Use case già generati nel batch corrente (null se idle). */
  useCaseBundleGenerationCount: number | null;
  /** Pass di riordino narrativo dopo i batch chunked. */
  useCaseBundleGenerationOrdering: boolean;
  useCaseBundleGenerationCategorizing: boolean;
  /** Propagazione stile frasi esempio (LLM); separato da bundle. */
  useCasePhraseStylePropagationBusy: boolean;
  /** Avanzamento batch (un use case per chiamata); null se non in corso. */
  useCasePhraseStyleBatchProgress: { current: number; total: number } | null;
  useCaseComposerError: string | null;
  onClearUseCaseComposerError: () => void;
  onGenerateUseCaseBundle: () => void | Promise<void>;
  onCreateUseCase: (params: {
    label: string;
    parentId: string | null;
    creationScope?: 'single' | 'batch';
    holdComposerBusy?: boolean;
    deferSiblingReorder?: boolean;
  }) => Promise<string>;
  /** Root INVIO: LLM split draft into 1..N labels (semantic). */
  onSplitRootUseCaseDraft: (draftText: string) => Promise<string[]>;
  /** After a root batch finishes: merge highlight ids (amber border + New chip). */
  onRootUseCaseBatchCreated: (createdIds: readonly string[]) => void;
  onRegenerateUseCase: (useCaseId: string) => void | Promise<void | AIAgentUseCase | null>;
  /** Generalizza titolo e scenario (payoff) via LLM, senza rigenerare il dialogo. */
  onGeneralizeUseCaseMeta: (useCaseId: string) => void | Promise<void | AIAgentUseCase | null>;
  /** Rifinisce solo il testo scenario (forma/chiarezza, stesso significato). */
  onPolishUseCaseScenario: (
    useCaseId: string,
    scenarioTextOverride?: string
  ) => void | Promise<void | AIAgentUseCase | null>;
  /** Risolve con il nuovo testo assistente quando la rigenerazione ha successo (per baseline UI). */
  onRegenerateAgentMessage: (useCaseId: string) => void | Promise<string | null | void>;
  onAnnotateAgentMessageForJson: (
    useCaseId: string,
    assistantContentFromEditor?: string
  ) => void | Promise<boolean>;
  onDeleteUseCase: (useCaseId: string) => void;
  /** Persistenza nota invalidazione scenario + sync documento KB. */
  onUseCaseInvalidationNoteChange?: (useCaseId: string, note: string) => void;
  /** Notifica cambio stato invalidato (pollice giù) per pulizia KB. */
  onUseCaseInvalidationStateChange?: (useCaseId: string, isInvalid: boolean) => void;
  onCreateConversationalRule: (params: {
    label: string;
    parentId: string | null;
    creationScope?: 'single' | 'batch';
  }) => Promise<string>;
  onDeleteConversationalRule: (ruleId: string) => void;
  useCaseCreationMessage: string | null;
  /** Global style contract for all use-case dialogues. */
  useCaseGlobalStyleId: string;
  setUseCaseGlobalStyleId: (styleId: string) => void;
  /** Designer notes merged into the preset style contract (`Task.agentUseCaseStyleLearningNotes`). */
  agentUseCaseStyleLearningNotes: string;
  setAgentUseCaseStyleLearningNotes: (next: string) => void;
  /** Design-time preview style (persisted with task). */
  previewStyleId: string;
  setPreviewStyleId: (styleId: string) => void;
  /** Runtime state template edited in design-time and persisted on task. */
  initialStateTemplateJson: string;
  /** Persisted JSON string for `runtime_compact` (token-efficient rules); empty for legacy tasks. */
  agentRuntimeCompactJson: string;
  /** Optional style-indexed preview turns that can be projected into runtime examples. */
  previewByStyle: Record<string, AIAgentPreviewTurn[]>;
  /** Declared backend placeholder rows (tokens live in section text). */
  backendPlaceholders: readonly BackendPlaceholderInstance[];
  /** Insert `🗄️ path` at caret / replace selection in IR section + register instance. */
  insertBackendPathAtSection: (
    sectionId: AgentStructuredSectionId,
    backendPath: string,
    rangeStart: number,
    rangeEnd?: number
  ) => void;
  /** Insert `🗄️ path` at caret / replace selection in task description. */
  insertBackendPathInDesign: (backendPath: string, rangeStart: number, rangeEnd?: number) => void;
  /** Persisted target platform for deterministic compile preview. */
  agentPromptTargetPlatform: AgentPromptPlatformId;
  setAgentPromptTargetPlatform: (v: AgentPromptPlatformId) => void;
  /** Designer «Avvio immediato»: orchestrator injects synthetic first user turn at runtime. */
  agentImmediateStart: boolean;
  setAgentImmediateStart: (value: boolean) => void;
  /** Structured compile for {@link agentPromptTargetPlatform} (derived views + debugger). */
  compiledPlatformOutput: PlatformPromptOutput;
  /** Flattened preview string (same information as structured compile). */
  compiledPromptForTargetPlatform: string;
  /**
   * True when persisted `runtime_compact` matches deterministic Phase-2 output for the current IR.
   * Governs lazy recompilation (Prompt finale view + flow debugger compile).
   */
  promptFinalAligned: boolean;
  /**
   * Synchronously rebuilds `agentRuntimeCompactJson` from current IR and patches TaskRepository when misaligned.
   * No LLM; safe to call before compile/debug.
   */
  ensurePromptFinalDeterministicCompile: (reason: string) => void;
  /** Prompt Finale panel: mutually exclusive textual IR preview vs readonly JS/JSON bundle. */
  promptFinaleJsMode: boolean;
  setPromptFinaleJsMode: (value: boolean) => void;

  /** Project ID (needed for direct DB save of IA runtime override). */
  projectId: string | undefined;
  /** Per-task runtime IA motor overrides (persisted as `agentIaRuntimeOverrideJson`). */
  iaRuntimeConfig: IAAgentConfig;
  setIaRuntimeConfig: (next: IAAgentConfig) => void;
  /** Loaded from saved task JSON vs copied global defaults when override was absent. */
  iaRuntimeLoadedFrom: 'saved_override' | 'global_defaults';
  /** Writes current editor state to TaskRepository including override JSON ("Salva override"). */
  saveIaRuntimeOverrideToTask: () => void;
  /** Merges partial IA fields into TaskRepository (`normalize` ×2); no hydrated gate. */
  persistIaRuntimeOverrideSnapshot: (partial: Partial<IAAgentConfig>) => void;

  /**
   * {@link EditorBackendsPanel} registers the handler; tab strip calls {@link invokeBackendsAddManual}
   * to append a manual backend row (same logic as in-panel «Aggiungi»).
   */
  registerBackendsAddManualHandler: (
    handler: ((mode: import('@domain/backendCatalog/catalogTypes').ManualBackendCreationMode) => void) | null
  ) => void;
  invokeBackendsAddManual: (
    mode?: import('@domain/backendCatalog/catalogTypes').ManualBackendCreationMode
  ) => void;
  /**
   * {@link EditorKnowledgeBasePanel} registers the file-picker opener; wizard step header
   * calls {@link invokeKbAddDocumentPicker}.
   */
  registerKbAddDocumentPicker: (handler: (() => void) | null) => void;
  invokeKbAddDocumentPicker: () => void;
  /**
   * Wizard passo Backend (3/5): il pulsante «Aggiungi backend» è nello shell header;
   * il pannello non duplica la stessa riga in cima.
   */
  hideBackendsPanelInlineAddButton?: boolean;

  /** Wizard passo Backend: pannello destro Interface (INPUT/OUTPUT agente). */
  agentInterfacePanelOpen: boolean;
  setAgentInterfacePanelOpen: (open: boolean) => void;
  agentInterfaceInput: readonly MappingEntry[];
  agentInterfaceOutput: readonly MappingEntry[];
  setAgentInterfaceInput: React.Dispatch<React.SetStateAction<MappingEntry[]>>;
  setAgentInterfaceOutput: React.Dispatch<React.SetStateAction<MappingEntry[]>>;
  /** Titolo nell’header «Interface · …». */
  agentInterfaceTitle: string;

  /** Task-scoped knowledge-base documents (design-time). */
  knowledgeBaseDocuments: readonly StagedKbDocument[];
  knowledgeBaseAddFiles: (files: readonly File[]) => void;
  knowledgeBaseRemoveDocument: (docId: string) => void;
  knowledgeBaseUpdateDocument: (docId: string, patch: KbDocumentPatch) => void;
  knowledgeBaseReorderDocuments: (next: readonly StagedKbDocument[]) => void;
  /** Call meta for KB document analysis refine. */
  knowledgeBaseCallMeta?: AiCallMeta;
  knowledgeBaseTaskContext?: import('@domain/knowledgeBase/kbDocumentAnalysisApi').KbDocumentAnalysisTaskContext;

  /** Presente dopo il mount dell’editor quando il generatore guidato è disponibile. */
  useCaseGeneratorWizard: UseCaseGeneratorWizardModel | null;

  /** Messaggio dopo «Genera» / «creane altri» (wizard use case). */
  useCaseBundleFeedback: string | null;
  onDismissUseCaseBundleFeedback: () => void;
  /** Id evidenziati nel composer dopo un batch generato. */
  useCaseHighlightIds: readonly string[];
  onClearUseCaseHighlight: (useCaseId: string) => void;

  /** Passo 2 wizard: propaga stile dalle frasi modificate al resto (LLM). */
  onPropagateExamplePhraseStyle: () => void | Promise<void>;
  /**
   * Toolbar wizard «Completa correzione»: chiama `propagate_correction_style` con coppie
   * directional `(original→modified)` per gli esempi e l'`original` di ogni target.
   * Vedi {@link AIAgentUseCaseComposerProps.onCompleteCorrection} per la firma.
   */
  onCompleteCorrection: (params: {
    directionalExamples: ReadonlyArray<{
      useCaseId: string;
      useCaseLabel: string;
      original: string;
      modified: string;
    }>;
    directionalTargets: ReadonlyArray<{
      useCaseId: string;
      useCaseLabel: string;
      original: string;
    }>;
  }) => Promise<{
    updates: ReadonlyArray<{ useCaseId: string; newAssistantContent: string }>;
  } | null>;
  /** Use case il cui messaggio assistente è stato appena aggiornato da «Aggiorna stile». */
  assistantPhraseStyleNewIds: readonly string[];

  /**
   * Messaggio assistente ancora in textarea (non committato in useCases): serve al piano stile nel wizard.
   * `draftText === null` rimuove la bozza per quell’id; `(null, null)` svuota tutto.
   */
  onAssistantPhraseDraftChange?: (useCaseId: string | null, draftText: string | null) => void;

  /** Ordine tra fratelli: dialogo (default) vs alfabetico (toolbar AB). */
  useCaseSiblingSortMode: UseCaseSiblingSortMode;
  setUseCaseSiblingSortMode: (mode: UseCaseSiblingSortMode) => void;
  /**
   * Riordino drag & drop tra use case **fratelli** (stesso `parent_id`). Forza ordine «elenco»
   * e aggiorna `sort_order` in modo persistente con la lista.
   */
  reorderUseCaseSiblingByDrag: (
    draggedId: string,
    targetId: string,
    position: 'before' | 'after'
  ) => void;

  /**
   * Passo 2 wizard — Crea/aggiunge una conversazione simulata mescolando use case (LLM).
   * I parametri arrivano dai pulsanti contestuali del pannello DX (pollice su / pollice giù / lampadina):
   *   - pollice su → { outcome: 'positive', allowSuggestedUseCases: false }
   *   - pollice giù → { outcome: 'negative', allowSuggestedUseCases: false }
   *   - lampadina → { outcome: 'positive', allowSuggestedUseCases: true }
   */
  onAssembleConversation: (params: {
    outcome: 'positive' | 'negative';
    allowSuggestedUseCases: boolean;
  }) => void | Promise<void>;
  assembleConversationBusy: boolean;
  /**
   * Passo 2 wizard — Proofread (solo ortografia/punteggiatura) delle bubble agente modificate
   * manualmente nella conversazione attiva. Sostituisce la vecchia funzione «omogeneizza» (più ampia).
   */
  onProofreadConversationAgentTurns: () => void | Promise<void>;
  proofreadConversationBusy: boolean;
  /**
   * Passo 2 wizard — Promuove uno use case emergente (suggestion `pending`) a use case reale
   * nel catalogo. Crea il nuovo use case con la frase agente della bubble come canonical e collega
   * la bubble al nuovo id.
   */
  onPromoteSuggestionToCatalog: (conversationId: string, turnId: string) => void | Promise<void>;
  /** Passo 2 wizard — Scarta uno use case emergente (suggestion → `rejected`). */
  onRejectSuggestion: (conversationId: string, turnId: string) => void;
  /**
   * Passo 3 wizard — Tokenizza con l'AI le frasi canoniche degli use case correnti. A successo,
   * imposta `assistant_example_tokenized` su ciascun use case e cattura la baseline AI.
   */
  onTokenizeUseCases: () => void | Promise<void>;
  tokenizeUseCasesBusy: boolean;
  /** Mappa derivata `useCaseId → assistant_example_tokenized` per le bubble Passo 2 (anteprima). */
  tokenizedByUseCaseId: Readonly<Record<string, string>>;
  /** «Pulisci tutto»: azzera solo l'output del wizard (use case, conversazioni, JSON, baselines). */
  onClearAllWizardOutput: () => void;
  /** Reset contestuale Passo 2: elimina solo conversazioni e baseline conversazioni. */
  onClearWizardConversations: () => void;
  /** Reset contestuale Passo 3: elimina solo tokenizzazione e baseline tokenizzazione. */
  onClearWizardTokenization: () => void;
  /**
   * Bottone «Crea prompt conversazionale»: vive nella tab strip Dockview (right header
   * actions) del gruppo di destra (Dati / Use case / Agent setup / Backends), allineato a
   * destra. Lo state apertura del dialog è gestito dal parent ({@link AIAgentEditor}); il
   * dialog è renderizzato lì. Qui esponiamo:
   *  - `canCreateConversationalPrompt`: tutti gli use case sono compilabili
   *    ({@link areAllUseCasesProjectable}). Se false, il bottone è disabilitato.
   *  - `onOpenConversationalPromptDialog`: apre il dialog se le condizioni sono OK.
   */
  canCreateConversationalPrompt: boolean;
  onOpenConversationalPromptDialog: () => void;

  /**
   * **Gate di stile v2 multi-pill** del passo «Conversazione» (persistito sul task).
   *
   * - `agentConversationStyleAuto`: checkbox **GLOBALE** «Lascia che Omnia scelga uno stile».
   *   Quando true, gli esempi di dialogo sono opzionali; l'AI inventa frasi nello stile
   *   descritto dalla `description` di ogni stile checkato.
   * - `agentConversationStyleSelections`: mappa `styleId → { checked, description, example }`.
   *   Il batch di generazione produce 1 conversazione PER OGNI styleId con `checked = true`
   *   (chiamate parallele via `Promise.all`).
   * - `agentConversationDeployStyleId`: stile target di Upload (singolo per ora). `null` =
   *   Upload disabilitato; il picker mostra solo stili che hanno almeno 1 conversazione
   *   generata (vedi `listGeneratedStyleIds`).
   *
   * Il vecchio `agentConversationStyleExample` resta esposto per compat ma è readonly:
   * la migrazione verso `selections` avviene in `buildTaskSnapshotFromRaw`.
   */
  agentConversationStyleExample: string;
  setAgentConversationStyleExample: (next: string) => void;
  agentConversationStyleAuto: boolean;
  setAgentConversationStyleAuto: (next: boolean) => void;
  agentConversationStyleSelections: ConversationStyleSelections;
  setAgentConversationStyleSelections: (
    next:
      | ConversationStyleSelections
      | ((prev: ConversationStyleSelections) => ConversationStyleSelections)
  ) => void;
  agentConversationDeployStyleId: string | null;
  setAgentConversationDeployStyleId: (next: string | null) => void;
  /**
   * Toggle "Logga Use Case" del deploy menu (vedi `Task.agentLogUseCase`). Quando true,
   * il compilatore di prompt aggiunge il campo `log: "USECASE: \"<NOME>\""` a ogni elemento
   * di `UseCaseConversationalJson` e antepone l'istruzione testuale "non riconosciuto"
   * in testa al blocco use cases del system prompt.
   */
  agentLogUseCase: boolean;
  setAgentLogUseCase: (next: boolean) => void;
  agentBehavior: 'A' | 'B' | 'C';
  setAgentBehavior: (next: 'A' | 'B' | 'C') => void;
  agentUseCasesJson: string;
  agentConversationalRulesJson: string;
  compileUseCasePhrasesForCatalog: () => void;
  compilePhrasesBusy: boolean;
  projectSlotLexicon: import('@domain/useCaseBundle/projectSlotLexicon').ProjectSlotLexicon;
  approveLexiconSurface: (surface: string) => void;
  revokeLexiconSurface: (surface: string) => void;
  updateLexiconSlotId: (surface: string, slotId: string) => void;

  /**
   * Parametri per propagazione/anteprima stile correzioni nel composer (mirror di Omnia Tutor +
   * `globalStyleContract` del controller).
   */
  useCasePropagatorProvider: string;
  useCasePropagatorModel: string;
  useCasePropagatorGlobalStyleContract: string;
  buildUseCasePropagatorCallMeta: (purpose: string) => AIAgentPropagatorCallMeta;

  /** Canale review condiviso (file su server per web + Omnia). */
  agentReviewChannel: import('./useAgentReviewChannel').UseAgentReviewChannelResult;

  /** Portal review: read-only KB/backend project mutations; IA actions disabled. */
  reviewPortalMode: boolean;

  /** Modello LLM pubblicato da Omnia (portale review — picker inline nel banner). */
  reviewDesignerLlm?: import('@domain/agentReviewChannel/reviewDocument').AgentReviewDesignerLlmSnapshot | null;

  /** Snapshot backend pubblicato (solo portale review — righe grafo/agent). */
  reviewBackendSnapshot?: import('@domain/agentReviewChannel/reviewSnapshots').AgentReviewBackendSnapshot | null;
}

/** Exported for {@link useAgentStructuredDockSlice} (unified dock + legacy nested dock). */
export const AIAgentEditorDockContext = React.createContext<AIAgentEditorDockContextValue | null>(null);

export function AIAgentEditorDockProvider({
  value,
  children,
}: {
  value: AIAgentEditorDockContextValue;
  children: React.ReactNode;
}) {
  return <AIAgentEditorDockContext.Provider value={value}>{children}</AIAgentEditorDockContext.Provider>;
}

/**
 * Panel bodies must be rendered under {@link AIAgentEditorDockProvider}.
 */
export function useAIAgentEditorDock(): AIAgentEditorDockContextValue {
  const ctx = React.useContext(AIAgentEditorDockContext);
  if (!ctx) {
    throw new Error('useAIAgentEditorDock must be used within AIAgentEditorDockProvider');
  }
  return ctx;
}

/** Used by Dockview tabs outside mandatory panel bodies (e.g. tab strip only has context when unified dock is wrapped). */
export function useOptionalAIAgentEditorDock(): AIAgentEditorDockContextValue | null {
  return React.useContext(AIAgentEditorDockContext);
}
