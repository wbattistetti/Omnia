/**
 * Use Case Composer: tree of scenarios, metadata fields, dialogue via chat preview bridge.
 */

import React from 'react';
import { MissingDesignerLlmModelAlert } from '@components/settings/designerLlm/MissingDesignerLlmModelAlert';
import { isDesignerLlmMissingModelMessage } from '@components/settings/designerLlm/designerLlmMessages';
import {
  BookOpen,
  Brackets,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileJson,
  Globe,
  GitBranch,
  GripVertical,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Variable,
  Wand2,
  X,
} from 'lucide-react';
import {
  newAgentUseCaseTurnId,
  isUseCaseIncludedInConversations,
  type AIAgentLogicalStep,
  type AIAgentUseCase,
  type AIAgentUseCaseCategory,
} from '@types/aiAgentUseCases';
import { ensureUseCasePhrases } from '@domain/useCaseBundle/migrateUseCase';
import {
  addParametricCatalogDimension,
  addParametricFreeDimension,
  addParametricRow,
  expandParametricCartesian,
  patchParametricDimensionLabel,
  patchParametricRowCell,
  patchParametricRowPrompt,
  removeParametricDimension,
  setPrimaryPhraseParametricEnabled,
} from '@domain/useCaseBundle/parametricPhraseHelpers';
import {
  emptyProjectSlotLexicon,
  type ProjectSlotLexicon,
} from '@domain/useCaseBundle/projectSlotLexicon';
import { UseCaseResponseEditor } from './UseCaseResponseEditor';
import { usePatchUseCaseResponseTasks } from './usePatchUseCaseResponseTasks';
import { isPrimaryPhraseParametricEnabled } from './useCaseMessageHelpers';
import { PhraseParametricEditor } from './useCaseBundle/PhraseParametricEditor';
import { UseCaseRowDeployChips } from './useCaseBundle/UseCaseRowDeployChips';
import { getUseCaseDeployRowStats } from './useCaseBundle/useCaseBundleDeployStats';
import {
  AI_AGENT_DEFAULT_PREVIEW_STYLE_ID,
} from '@types/aiAgentPreview';
import {
  getScenarioText,
  withScenarioText,
} from '@domain/aiAgentUseCase/scenarioText';
import { UseCaseWizardScenarioDisplay } from './useCaseWizardScenarioDisplay';
import { orderUseCasesWithDepth } from './useCaseTreeOrder';
import { applySiblingReorderForPersist } from './useCaseHierarchy';
import { syncPrimaryPhraseNaturalFromAssistantTurn } from '@domain/useCaseBundle/phraseVariantHelpers';
import {
  AI_AGENT_GLOBAL_USE_CASE_STYLES,
  LABEL_AGENT_MSG_STRIP_TOKENS,
  LABEL_AGENT_MSG_WRAP_TOKEN,
  LABEL_ANALYZE_AND_CREATE_USE_CASES,
  LABEL_CREATING_MULTIPLE_USE_CASES,
  LABEL_CREATING_ONE_USE_CASE,
  LABEL_ROOT_DRAFT_ANALYZING,
  LABEL_GENERATE_USE_CASES,
  LABEL_GENERALIZE_USE_CASE_META_CONFIRM,
  LABEL_GENERALIZE_USE_CASE_META_PENDING,
  LABEL_POLISH_USE_CASE_SCENARIO,
  LABEL_POLISH_USE_CASE_SCENARIO_PENDING,
  LABEL_REGENERATE_AGENT_EXAMPLE,
  LABEL_REGENERATE_USE_CASE_FOR_SCENARIO,
  TOOLTIP_POLISH_USE_CASE_SCENARIO,
} from './constants';
import {
  normalizeRootUseCaseDraftDisplay,
  parseRootUseCaseDraftSegmentsFallback,
  resolveRootUseCaseDraftForCreateAsync,
  ROOT_USE_CASE_BATCH_MAX,
} from './parseRootUseCaseDraft';
import { logUseCaseRootBatch } from './useCaseRootBatchDebug';
import {
  computeAgentTokenSelectionPopoverAction,
  messageHasAgentTokens,
  stripAgentMessageTokens,
  unwrapBracketTokenContainingSelection,
  buildBracketWrapForSelection,
  buildStyleWrapForSelection,
  findTokenSpanAtSelection,
} from './agentMessageTokenHelpers';
import {
  getPrimaryPhraseStyleTokens,
  patchStyleTokenVariants,
  removeStyleTokenOnUnwrap,
  upsertStyleTokenOnWrap,
} from '@domain/useCaseBundle/styleTokenPhraseHelpers';
import { AgentMessageSelectionTokenPopover } from './AgentMessageSelectionTokenPopover';
import { AgentMessageStyleExamplesWrap } from './AgentMessageStyleExamplesToolbarButton';
import {
  buildVirtualAgentRuntimeCatalogFromUseCases,
  buildVirtualAgentUseCaseConstrainedPromptAppendix,
  serializeVirtualAgentRuntimeCatalog,
} from '@domain/aiAgentUseCase/virtualAgentRuntimeCatalog';
import { useOptionalAIAgentEditorDock } from './AIAgentEditorDockContext';
import {
  type AiTripletFieldBaseline,
  UC_USE_CASE_LIST_SCROLL,
  USE_CASE_PANEL_SHELL,
  UC_AGENT_ROW_EDIT_BTN,
  UC_AGENT_VOTE_BTN,
  UC_CLASSIC_TEXTAREA_AGENT,
  UC_CLASSIC_TEXTAREA_SCENARIO,
  UC_SCENARIO_BODY_TEXT,
  UC_SCENARIO_PANEL_SURFACE,
  UC_HEAD_VOTE_BTN,
  UC_LIST_ZEBRA_CLASSIC_EVEN,
  UC_LIST_ZEBRA_CLASSIC_ODD,
  UC_LIST_ZEBRA_WIZARD_EVEN,
  UC_LIST_ZEBRA_WIZARD_ODD,
  UC_PILL_AGENT_MSG,
  UC_PILL_SCENARIO,
  UC_SCENARIO_ROW_EDIT_BTN,
  UC_SCENARIO_VOTE_BTN,
  UC_WIZARD_CARD_BODY,
  UC_WIZARD_AGENT_MESSAGE_PANEL,
  UC_WIZARD_AGENT_MESSAGE_TEXT,
  UC_WIZARD_ROW_EXPANDED,
  UC_ROW_REVIEW_EDGE,
  useCaseHeaderShellClass,
  useCaseHeaderTitleTextClass,
  UC_WIZARD_SCENARIO_BLOCK,
  UC_WIZARD_SCENARIO_TEXT,
  fieldTextClass,
} from './useCaseComposerPresentation';
import {
  applyUseCaseCardExpansion,
  collapseAllUseCaseCards,
  expandAllUseCaseCards,
  expandOnlyUseCaseCards,
  type UseCaseAccordionFoldMode,
  type UseCaseCardExpandSource,
} from './useCaseAccordionFold';
import {
  applyDesignerFieldVoteToggle,
  useCaseHasDesignerReviewVote,
  type DesignerFieldVote,
  applyUseCaseHeaderVoteToggle,
  applyUseCaseValidatedOnMessageCommit,
  type DesignerVoteField,
} from './useCaseComposerDesignerVotes';
import { useUseCaseFieldBaselineSync } from './useUseCaseFieldBaselineSync';
import {
  countSubstantialEditsAcrossUseCases,
  isSubstantialEdit,
  COMPLETE_CORRECTION_VISIBILITY_THRESHOLD,
} from './useCaseSubstantialEdits';
import { VoteThumbPair } from './VoteThumbPair';
import { SeedHighlightedText } from '@components/common/SeedHighlightedText';
import { TokenizedHighlightedText } from './useCaseGeneratorWizard/TokenizedHighlightedText';
import { CORRECTION_PREVIEW_SYNTHESIS_WAITING_MESSAGE } from './useCaseGeneratorWizard/CompletaCorrezioneCallout';
import { useUseCaseWizardListToolbarOptional } from './useCaseGeneratorWizard/UseCaseWizardListToolbarContext';
import { UseCaseEmptyTutorPanel } from './useCaseGeneratorWizard/UseCaseEmptyTutorPanel';
import { UseCaseRootComposerHeader } from './useCaseGeneratorWizard/UseCaseRootComposerHeader';
import { UseCaseCategoryHeader } from './useCaseGeneratorWizard/UseCaseCategoryHeader';
import {
  displayUseCaseLabelForCategory,
  resolveUseCaseListDisplayLayout,
} from '@domain/aiAgentUseCase/useCaseCategories';
import {
  BracketTokenHighlightedText,
  BracketTokenHighlightedTextarea,
} from './BracketTokenHighlightedTextarea';
import {
  propagateCorrectionStylePreviewApi,
} from '@services/aiAgentDesignApi';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import { resolveAiAgentOutputLanguage } from './resolveAiAgentOutputLanguage';
import { getTextareaCaretViewportPoint } from './textareaCaretViewport';
import {
  buildTokenPopoverAnchorBelowCaret,
  type AgentMessageTokenPopoverAnchor,
} from './agentMessageTokenPopoverAnchor';
import { mergeUseCaseGlobalStyleContract } from './mergeUseCaseGlobalStyleContract';
import {
  UseCaseDropSentinel,
  UseCaseListDndShell,
  UseCaseRowDnDWrapper,
  UseCaseRowDragHandle,
  UseCaseRowHeader,
} from './UseCaseListDndKit';

export type { AiTripletFieldBaseline } from './useCaseComposerPresentation';

export interface AIAgentUseCaseComposerProps {
  /** When set, selects this use case id once after it appears (e.g. debugger «Aggiungi»). */
  editorTaskInstanceId?: string;
  logicalSteps: readonly AIAgentLogicalStep[];
  useCases: readonly AIAgentUseCase[];
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  busy: boolean;
  creationMessage?: string | null;
  error: string | null;
  onDismissError: () => void;
  onCreateUseCase: (params: {
    label: string;
    parentId: string | null;
    creationScope?: 'single' | 'batch';
    holdComposerBusy?: boolean;
    deferSiblingReorder?: boolean;
  }) => Promise<string>;
  /** Root INVIO: semantic split via LLM (Prompts catalog only). */
  onSplitRootUseCaseDraft?: (draftText: string) => Promise<string[]>;
  /** Fine batch root: evidenzia tutti gli id creati (bordo ambra + chip New). */
  onRootUseCaseBatchCreated?: (createdIds: readonly string[]) => void;
  onRegenerateUseCase: (useCaseId: string) => void | Promise<void | AIAgentUseCase | null>;
  /** Generalizza titolo e scenario (payoff) via LLM; assente = nessun pulsante. */
  onGeneralizeUseCaseMeta?: (useCaseId: string) => void | Promise<void | AIAgentUseCase | null>;
  /** Rifinisce forma scenario (stesso significato); assente = nessun pulsante bacchetta. */
  onPolishUseCaseScenario?: (
    useCaseId: string,
    scenarioTextOverride?: string
  ) => void | Promise<void | AIAgentUseCase | null>;
  onRegenerateAgentMessage: (useCaseId: string) => void | Promise<string | null | void>;
  /** IA: tokenizza il messaggio con [slot] e allinea il JSON motore (preview sotto). */
  onAnnotateAgentMessageForJson: (
    useCaseId: string,
    assistantContentFromEditor?: string
  ) => void | Promise<boolean>;
  onDeleteUseCase: (useCaseId: string) => void;
  useCaseGlobalStyleId: string;
  onUseCaseGlobalStyleIdChange: (styleId: string) => void;
  /** Persistite su `Task.agentUseCaseStyleLearningNotes`, unite al preset stile nelle API. */
  useCaseStyleLearningNotes?: string;
  onUseCaseStyleLearningNotesChange?: (next: string) => void;
  previewStyleId?: string;
  onPreviewStyleIdChange?: (styleId: string) => void;
  /** When set, empty state shows a primary CTA (e.g. tab toolbar hidden). */
  onGenerateUseCaseBundle?: () => void | Promise<void>;
  /** Disables generate CTA while Create/Refine agent is running. */
  generating?: boolean;
  /** Etichetta durante generazione bundle chunked (es. «Generando use case… (8)»). */
  bundleGenerateBusyLabel?: string;
  /** Scenari già creati nel batch corrente (banner in cima alla lista). */
  useCaseBundleGenerationCount?: number | null;
  /** Fase finale di riordino scenari. */
  useCaseBundleGenerationOrdering?: boolean;
  bundleGenerationCategorizing?: boolean;
  /** Contesto per messaggio dinamico nello stato vuoto (descrizione, KB, back-end). */
  emptyTutorGenerateContext?: {
    hasDesignDescription: boolean;
    hasKbDocuments: boolean;
    hasBackend: boolean;
  };
  useCaseCategories?: readonly AIAgentUseCaseCategory[];
  onUseCaseCategoryLabelChange?: (categoryId: string, label: string) => void;
  onUseCaseCategoryDescriptionChange?: (categoryId: string, description: string) => void;
  /** Id da evidenziare dopo generazione / «creane altri». */
  highlightIds?: readonly string[];
  /** Rimuove l’evidenziazione quando l’use case è confermato (edit o cerchio). */
  onClearUseCaseHighlight?: (useCaseId: string) => void;
  /** Passo 2 wizard: messaggio esempio appena rigenerato da «Aggiorna stile». */
  assistantPhraseStyleNewIds?: readonly string[];
  /** Wizard: bozza messaggio assistente → piano stile (testo non ancora committato in useCases). */
  onAssistantPhraseDraftChange?: (useCaseId: string | null, draftText: string | null) => void;
  /**
   * Toolbar wizard «Completa correzione»: invocato dal context quando l'utente preme il
   * pulsante. Il composer costruisce il payload directional `(original, modified)` dai
   * propri `useCases` + baseline IA e delega questa callback al parent (chiama l'API LLM
   * via `useAIAgentEditorController.handleCompleteCorrection`). Il parent NON tocca
   * `useCases` né `fieldBaselineByUseCaseId`: lo fa il composer dopo aver ricevuto gli
   * updates, così il marker `[NEW]` e la nuova baseline restano coerenti localmente.
   */
  onCompleteCorrection?: (params: {
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
  /**
   * Notifica esterna quando la selezione lista cambia (lift-up). Usato dal wizard per il pannello
   * «Mostra JSON»: il preview Monaco mostra il JSON dello use case selezionato.
   * Chiamato anche al primo `effectiveSelectedId` calcolato dopo il mount.
   */
  onSelectionChange?: (selectedUseCaseId: string | null) => void;
  /**
   * Selezione controllata dal parent (wizard + pannello DX). Va passata insieme a
   * `onSelectionChange`: il composer non duplica lo stato e non risincronizza con un effect
   * separato (evita loop di update). `undefined` = selezione solo interna al composer.
   */
  controlledSelectionId?: string | null;
  /**
   * Wizard «Mostra Tokens»: quando `true` E lo use case ha una versione tokenizzata in
   * {@link tokenizedByUseCaseId}, il messaggio agente nella riga lista viene reso con
   * {@link TokenizedHighlightedText} (placeholder `[token]` in giallo) **read-only** —
   * la matita di edit è nascosta. Quando `false` o senza tokenizzazione disponibile,
   * resta la frase canonica editabile (comportamento storico).
   *
   * Stato condiviso col toggle delle conversazioni (`useCaseGeneratorWizard.showTokenizedInBubbles`),
   * così l'esperienza è coerente attraversando i passi.
   */
  showTokenizedAgentMessage?: boolean;
  /** Mappa `useCaseId → assistant_example_tokenized` (solo wizard). */
  tokenizedByUseCaseId?: Readonly<Record<string, string>>;
  /** Lessico progetto per chip deploy e anteprima compile varianti. */
  projectSlotLexicon?: ProjectSlotLexicon;
  /** Apre «Vedi compilato» per uno use case (barra salute / chip occhio). */
  onInspectCompiled?: (useCaseId: string) => void;
  /** `conversational_rules`: catalogo error handling (no IA create/regenerate). */
  composerCatalog?: 'prompts' | 'conversational_rules';
}

export function AIAgentUseCaseComposer({
  editorTaskInstanceId,
  logicalSteps: _logicalSteps,
  useCases,
  setUseCases,
  busy,
  creationMessage = null,
  error,
  onDismissError,
  onCreateUseCase,
  onSplitRootUseCaseDraft,
  onRootUseCaseBatchCreated,
  onRegenerateUseCase,
  onGeneralizeUseCaseMeta,
  onPolishUseCaseScenario,
  onRegenerateAgentMessage,
  onAnnotateAgentMessageForJson: _onAnnotateAgentMessageForJson,
  onDeleteUseCase,
  useCaseGlobalStyleId,
  onUseCaseGlobalStyleIdChange,
  useCaseStyleLearningNotes = '',
  onUseCaseStyleLearningNotesChange = () => {},
  previewStyleId = AI_AGENT_DEFAULT_PREVIEW_STYLE_ID,
  onPreviewStyleIdChange = () => {},
  onGenerateUseCaseBundle,
  generating = false,
  bundleGenerateBusyLabel,
  useCaseBundleGenerationCount = null,
  useCaseBundleGenerationOrdering = false,
  bundleGenerationCategorizing = false,
  emptyTutorGenerateContext = {
    hasDesignDescription: false,
    hasKbDocuments: false,
    hasBackend: false,
  },
  useCaseCategories = [],
  onUseCaseCategoryLabelChange,
  onUseCaseCategoryDescriptionChange,
  highlightIds = [],
  onClearUseCaseHighlight,
  assistantPhraseStyleNewIds = [],
  onAssistantPhraseDraftChange,
  onCompleteCorrection,
  onSelectionChange,
  controlledSelectionId,
  showTokenizedAgentMessage = false,
  tokenizedByUseCaseId,
  projectSlotLexicon = emptyProjectSlotLexicon(),
  onInspectCompiled,
  composerCatalog = 'prompts',
}: AIAgentUseCaseComposerProps) {
  const isConversationalRulesCatalog = composerCatalog === 'conversational_rules';
  const patchUseCaseResponseTasks = usePatchUseCaseResponseTasks(setUseCases);

  const seedUseCaseResponse = React.useCallback(
    (next: AIAgentUseCase) => {
      setUseCases((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    },
    [setUseCases]
  );

  /**
   * Marker locale `[NEW]` aggiunto dal flow «Completa correzione» (toolbar). Vive nel
   * composer (non viene propagato al parent) perché lega vita-e-morte alla baseline:
   * appena la baseline viene riallineata al `newAssistantContent` lo set non serve più
   * — ma manteniamo il badge finché lo use case non viene votato/edita di nuovo.
   * L'unione con `assistantPhraseStyleNewIds` (legacy callout) conserva il render esistente.
   */
  const [completeCorrectionNewIds, setCompleteCorrectionNewIds] = React.useState<
    ReadonlySet<string>
  >(() => new Set());
  const phraseStyleNewSet = React.useMemo(
    () => new Set([...assistantPhraseStyleNewIds, ...completeCorrectionNewIds]),
    [assistantPhraseStyleNewIds, completeCorrectionNewIds]
  );
  /** Pannello note stile: nascosto se vuoto, salvo apertura esplicita o testo persistito. */
  const [styleLearningNotesEditorOpen, setStyleLearningNotesEditorOpen] = React.useState(false);
  const showStyleLearningNotesPanel =
    useCaseStyleLearningNotes.trim().length > 0 || styleLearningNotesEditorOpen;
  const { ordered } = React.useMemo(() => orderUseCasesWithDepth(useCases), [useCases]);
  const highlightIdSet = React.useMemo(() => new Set(highlightIds), [highlightIds]);
  /** Rimuove chip/bordo «New» solo dopo un’azione designer esplicita (voto, commit testo, …). */
  const clearNewHighlightOnDesignerAction = React.useCallback(
    (useCaseId: string) => {
      onClearUseCaseHighlight?.(useCaseId);
    },
    [onClearUseCaseHighlight]
  );
  const listToolbarCtx = useUseCaseWizardListToolbarOptional();
  const dock = useOptionalAIAgentEditorDock();
  /** Portale review: stile globale / runtime catalog nel composer (in Omnia wizard sono nel pannello DX). */
  const showComposerClassicChrome = dock?.reviewPortalMode === true;
  /** `dock` dal parent è un oggetto nuovo a ogni render: non va nelle deps dell'effect anteprima. */
  const dockRef = React.useRef(dock);
  dockRef.current = dock;
  /**
   * Setter stabile (useState nel provider). L'oggetto `listToolbarCtx` cambia identità a ogni
   * aggiornamento di `correctionPreviewState` (useMemo del provider): se era nelle deps
   * dell'effect anteprima → abort in loop e UI bloccata su «sto analizzando…».
   */
  const setCorrectionPreviewState = listToolbarCtx?.setCorrectionPreviewState ?? null;
  const pendingCorrectionsCountToolbar = listToolbarCtx?.pendingCorrectionsCount ?? 0;
  const correctionsDismissedToolbar = listToolbarCtx?.correctionsDismissed ?? false;
  /**
   * Etichette campo «Scenario» / «Messaggio agente»: in modalità wizard
   * (layout accordion inline) usiamo **icone-only** colorate con il **colore del font**
   * usato in `UC_PILL_SCENARIO` (violetto) e `UC_PILL_AGENT_MSG` (emerald), così le righe
   * dello use case respirano e l'identità del campo resta riconoscibile a colpo d'occhio.
   * In modalità classica restano le pill testuali (più spazio orizzontale disponibile).
   */
  const scenarioFieldLabel: React.ReactNode = (
    <span
      title="Scenario"
      aria-label="Scenario"
      className="shrink-0 self-start inline-flex h-6 w-6 items-center justify-center text-violet-300"
    >
      <BookOpen size={15} aria-hidden />
    </span>
  );
  const agentMsgFieldLabel: React.ReactNode = (
    <span
      title="Messaggio agente"
      aria-label="Messaggio agente"
      className="shrink-0 inline-flex h-6 w-6 items-center justify-center text-emerald-300"
    >
      <MessageSquareText size={15} aria-hidden />
    </span>
  );
  const wizardShowScenario = listToolbarCtx ? listToolbarCtx.showScenario : true;
  const wizardShowMessage = listToolbarCtx ? listToolbarCtx.showMessage : true;
  const wizardAccordionHeaderMode = listToolbarCtx
    ? listToolbarCtx.listAccordionHeaderMode
    : 'label';
  /**
   * Seed di ricerca dalla toolbar wizard. Gli highlight col chip giallo sui messaggi
   * agente sono attivi solo nella vista wizard (layout accordion inline) — è
   * lì che vive la search box, e fuori dalla wizard non ha senso evidenziare nulla.
   */
  const wizardSearchSeed =
    listToolbarCtx?.searchSeed ?? '';

  /**
   * Lista filtrata dal seed di ricerca: mostra solo gli use case il cui messaggio
   * agente contiene il seed (case-insensitive, substring). Quando `wizardSearchSeed`
   * è vuoto la funzione restituisce esattamente `ordered` (stessa reference, evita
   * re-render inutili dei figli memo). Il filtro coinvolge **solo** il rendering
   * della lista — `selected`, `orderedIds` e gli altri calcoli logici continuano a
   * usare `ordered` (l'esistenza degli use case non cambia, cambia solo cosa è
   * visibile ora).
   *
   * Criterio di match coerente con l'highlight: stessa colonna evidenziata col chip
   * giallo (messaggio agente). Se l'utente cerca una parola che vive solo nello
   * scenario, niente match — coerenza visiva: ciò che evidenzio = ciò che filtro.
   */
  const filteredOrdered = React.useMemo(() => {
    if (!wizardSearchSeed) return ordered;
    const lower = wizardSearchSeed.toLocaleLowerCase();
    return ordered.filter((u) => {
      const ast = u.dialogue.find((t) => t.role === 'assistant');
      const text = (ast?.content ?? '').toLocaleLowerCase();
      return text.includes(lower);
    });
  }, [ordered, wizardSearchSeed]);

  const deployRowStatsByUseCaseId = React.useMemo(() => {
    const map = new Map<string, ReturnType<typeof getUseCaseDeployRowStats>>();
    for (const u of filteredOrdered) {
      map.set(u.id, getUseCaseDeployRowStats(u, projectSlotLexicon));
    }
    return map;
  }, [filteredOrdered, projectSlotLexicon]);

  const messageSpellLang = resolveAiAgentOutputLanguage().tag;

  const useCaseDragEnabled = !busy && !wizardSearchSeed;

  const commitUseCaseSiblingReorder = React.useCallback(
    (draggedId: string, targetId: string, position: 'before' | 'after') => {
      if (draggedId === targetId) return;
      if (dock?.reorderUseCaseSiblingByDrag) {
        dock.reorderUseCaseSiblingByDrag(draggedId, targetId, position);
      } else {
        setUseCases((prev) => applySiblingReorderForPersist(prev, draggedId, targetId, position));
      }
    },
    [dock, setUseCases]
  );

  /**
   * Selezione «lifted»: parent tiene `selectedUseCaseId` e passa `controlledSelectionId` +
   * `onSelectionChange`. Una sola fonte di verità — niente stato interno duplicato né effect
   * che risincronizzano in direzioni opposte (causa «Maximum update depth» dopo batch root).
   */
  const isLiftedSelection =
    onSelectionChange != null && controlledSelectionId !== undefined;
  const [internalSelectedId, setInternalSelectedId] = React.useState<string | null>(null);
  const selectedId = isLiftedSelection ? (controlledSelectionId ?? null) : internalSelectedId;
  const setSelectedId = React.useCallback(
    (value: React.SetStateAction<string | null>) => {
      if (isLiftedSelection) {
        const prev = controlledSelectionId ?? null;
        const next = typeof value === 'function' ? value(prev) : value;
        if (next !== prev) onSelectionChange(next);
        return;
      }
      setInternalSelectedId(value);
    },
    [isLiftedSelection, controlledSelectionId, onSelectionChange]
  );
  /** Blocca effetti selezione durante batch root (evita salti lista / flicker). */
  const rootBatchInProgressRef = React.useRef(false);
  const [rootDraftSubmitting, setRootDraftSubmitting] = React.useState(false);
  /** True for entire handleCreateRoot (split + create); drives chip + hides top creation banner. */
  const [rootDraftFlowActive, setRootDraftFlowActive] = React.useState(false);
  const [rootDraftLabel, setRootDraftLabel] = React.useState('');
  const rootComposerLocked = busy || rootDraftSubmitting;
  const rootChipBusy = rootDraftFlowActive && rootComposerLocked;
  const rootChipLabel = React.useMemo(() => {
    if (!rootChipBusy) return LABEL_ANALYZE_AND_CREATE_USE_CASES;
    if (rootDraftSubmitting && !busy) return LABEL_ROOT_DRAFT_ANALYZING;
    return (
      creationMessage ??
      (busy ? LABEL_CREATING_MULTIPLE_USE_CASES : LABEL_CREATING_ONE_USE_CASE)
    );
  }, [rootChipBusy, rootDraftSubmitting, busy, creationMessage]);
  const suppressTopCreationMessage =
    !isConversationalRulesCatalog && rootDraftFlowActive;
  /** Chip CTA visibile solo con bozza in textbox o mentre split/creazione è in corso. */
  const showRootAnalyzeChip =
    !isConversationalRulesCatalog &&
    (rootChipBusy || rootDraftLabel.trim().length > 0);

  const showUseCaseEmptyTutor =
    ordered.length === 0 && !isConversationalRulesCatalog;

  const bundleGenerateBusy =
    (Boolean(bundleGenerateBusyLabel) && busy && !rootChipBusy) || bundleGenerationCategorizing;

  type UseCaseListRow =
    | { kind: 'category'; category: AIAgentUseCaseCategory; count: number }
    | {
        kind: 'use_case';
        useCase: AIAgentUseCase;
        category: AIAgentUseCaseCategory | null;
        groupCases: readonly AIAgentUseCase[];
      };

  const useCaseListLayout = React.useMemo(
    () =>
      isConversationalRulesCatalog
        ? null
        : resolveUseCaseListDisplayLayout(useCaseCategories, filteredOrdered),
    [isConversationalRulesCatalog, useCaseCategories, filteredOrdered]
  );

  const useCaseListRows = React.useMemo((): UseCaseListRow[] => {
    if (!useCaseListLayout) {
      return filteredOrdered.map((u) => ({
        kind: 'use_case' as const,
        useCase: u,
        category: null,
        groupCases: filteredOrdered,
      }));
    }
    const { uncategorized, categoryGroups } = useCaseListLayout;
    const rows: UseCaseListRow[] = [];
    for (const u of uncategorized) {
      rows.push({
        kind: 'use_case',
        useCase: u,
        category: null,
        groupCases: uncategorized,
      });
    }
    for (const g of categoryGroups) {
      rows.push({ kind: 'category', category: g.category, count: g.cases.length });
      for (const u of g.cases) {
        rows.push({
          kind: 'use_case',
          useCase: u,
          category: g.category,
          groupCases: g.cases,
        });
      }
    }
    return rows;
  }, [filteredOrdered, useCaseListLayout]);

  const [collapsedCategoryIds, setCollapsedCategoryIds] = React.useState<Set<string>>(
    () => new Set()
  );

  const toggleCategoryExpanded = React.useCallback((categoryId: string) => {
    setCollapsedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (!useCaseListLayout?.categoryGroups.length) return;
    setCollapsedCategoryIds(new Set());
  }, [useCaseListLayout?.categoryGroups.map((g) => g.category.id).join('|')]);

  React.useEffect(() => {
    if (rootBatchInProgressRef.current) return;
    if (useCases.length === 0) {
      setSelectedId(null);
      return;
    }
    let pending: string | null = null;
    if (editorTaskInstanceId?.trim()) {
      try {
        const key = `omnia.pendingAiAgentUseCaseSelection.${editorTaskInstanceId.trim()}`;
        const raw = sessionStorage.getItem(key);
        if (raw) {
          sessionStorage.removeItem(key);
          if (useCases.some((u) => u.id === raw)) pending = raw;
        }
      } catch {
        /* ignore */
      }
    }
    setSelectedId((prev) => {
      if (pending) return pending;
      if (prev && useCases.some((u) => u.id === prev)) return prev;
      const { ordered: o } = orderUseCasesWithDepth(useCases);
      return o[0]?.id ?? null;
    });
  }, [editorTaskInstanceId, useCases, setSelectedId]);

  /** Stable selection while the list is non-empty (avoids empty right pane before effect runs). */
  const effectiveSelectedId = React.useMemo(() => {
    if (ordered.length === 0) return null;
    if (selectedId != null && ordered.some((u) => u.id === selectedId)) return selectedId;
    return ordered[0]?.id ?? null;
  }, [ordered, selectedId]);

  const selected = React.useMemo(
    () => (effectiveSelectedId ? useCases.find((u) => u.id === effectiveSelectedId) : undefined),
    [effectiveSelectedId, useCases]
  );

  const [editingTitleId, setEditingTitleId] = React.useState<string | null>(null);
  const [draftTitle, setDraftTitle] = React.useState('');
  const [creatingChildParentId, setCreatingChildParentId] = React.useState<string | null>(null);
  const [childDraftLabel, setChildDraftLabel] = React.useState('');
  /** Valori triplet (etichetta, scenario, messaggio) all’ingresso in lista o dopo rigenera IA. */
  const [fieldBaselineByUseCaseId, setFieldBaselineByUseCaseId] = React.useState<
    Record<string, AiTripletFieldBaseline>
  >({});
  /** Wizard only: corpo card espanso per id (default true quando compare un nuovo use case). */
  const [cardExpandedById, setCardExpandedById] = React.useState<Record<string, boolean>>({});
  /**
   * Wizard: `default` = tutti collassati, doppio click apre uno solo; `custom` = più aperti
   * (chevron con seconda apertura o «Espandi tutti»). «Collassa tutto» → default.
   */
  const [accordionFoldMode, setAccordionFoldMode] =
    React.useState<UseCaseAccordionFoldMode>('default');
  const accordionFoldModeRef = React.useRef<UseCaseAccordionFoldMode>('default');
  accordionFoldModeRef.current = accordionFoldMode;
  const orderedIds = React.useMemo(() => ordered.map((u) => u.id), [ordered]);

  const commitCardExpansion = React.useCallback(
    (useCaseId: string, open: boolean, source: UseCaseCardExpandSource) => {
      setCardExpandedById((prev) => {
        const result = applyUseCaseCardExpansion(
          accordionFoldModeRef.current,
          prev,
          useCaseId,
          open,
          orderedIds,
          source
        );
        accordionFoldModeRef.current = result.mode;
        setAccordionFoldMode(result.mode);
        return result.expandedById;
      });
    },
    [orderedIds]
  );

  const toggleCardExpansion = React.useCallback(
    (useCaseId: string, source: UseCaseCardExpandSource) => {
      setCardExpandedById((prev) => {
        const isOpen = prev[useCaseId] !== false;
        const result = applyUseCaseCardExpansion(
          accordionFoldModeRef.current,
          prev,
          useCaseId,
          !isOpen,
          orderedIds,
          source
        );
        accordionFoldModeRef.current = result.mode;
        setAccordionFoldMode(result.mode);
        return result.expandedById;
      });
    },
    [orderedIds]
  );
  const [rootBatchWarning, setRootBatchWarning] = React.useState<string | null>(null);
  const rootDraftRef = React.useRef<HTMLTextAreaElement>(null);
  /** Selection range in assistant message textarea (for Token wrap UX). */
  const [agentMsgSelection, setAgentMsgSelection] = React.useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  /** Viewport anchor (caret fine selezione) per toolbar Tokenizza `position: fixed`. */
  const [agentMsgTokenAnchor, setAgentMsgTokenAnchor] =
    React.useState<AgentMessageTokenPopoverAnchor | null>(null);
  /**
   * Durante drag-select (mouse/touch) la selezione nel DOM cambia ma non mostriamo ancora
   * «Tokenizza»: solo al rilascio (mouseup/touchend) la toolbar contestuale può comparire.
   */
  const [agentMsgPointerSelecting, setAgentMsgPointerSelecting] = React.useState(false);

  const markAgentMsgPointerSelectingMouse = React.useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setAgentMsgPointerSelecting(true);
  }, []);

  const markAgentMsgPointerSelectingTouch = React.useCallback(() => {
    setAgentMsgPointerSelecting(true);
  }, []);

  /** Durante `onGeneralizeUseCaseMeta` mostriamo il messaggio di attesa accanto al globo (riga lista). */
  const [generalizeMetaPendingUseCaseId, setGeneralizeMetaPendingUseCaseId] = React.useState<
    string | null
  >(null);

  const invokeGeneralizeUseCaseMeta = React.useCallback(
    async (useCaseId: string): Promise<void> => {
      if (!onGeneralizeUseCaseMeta) return;
      setGeneralizeMetaPendingUseCaseId(useCaseId);
      try {
        await Promise.resolve(onGeneralizeUseCaseMeta(useCaseId));
      } finally {
        setGeneralizeMetaPendingUseCaseId((cur) => (cur === useCaseId ? null : cur));
      }
    },
    [onGeneralizeUseCaseMeta]
  );

  /** Click sul globo apre il menu; solo «Generalizza» avvia l’IA. */
  const [generalizeGlobeMenuOpenUseCaseId, setGeneralizeGlobeMenuOpenUseCaseId] = React.useState<
    string | null
  >(null);

  const confirmGeneralizeFromGlobeMenu = React.useCallback(
    async (useCaseId: string): Promise<void> => {
      setGeneralizeGlobeMenuOpenUseCaseId(null);
      await invokeGeneralizeUseCaseMeta(useCaseId);
    },
    [invokeGeneralizeUseCaseMeta]
  );

  React.useEffect(() => {
    if (busy) setGeneralizeGlobeMenuOpenUseCaseId(null);
  }, [busy]);

  React.useEffect(() => {
    if (generalizeGlobeMenuOpenUseCaseId === null) return;
    const onMouseDownCapture = (ev: MouseEvent): void => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      if (t.closest(`[data-uc-generalize-popover-root="${generalizeGlobeMenuOpenUseCaseId}"]`)) {
        return;
      }
      setGeneralizeGlobeMenuOpenUseCaseId(null);
    };
    document.addEventListener('mousedown', onMouseDownCapture, true);
    return () => document.removeEventListener('mousedown', onMouseDownCapture, true);
  }, [generalizeGlobeMenuOpenUseCaseId]);

  React.useEffect(() => {
    if (generalizeGlobeMenuOpenUseCaseId === null) return;
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') setGeneralizeGlobeMenuOpenUseCaseId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [generalizeGlobeMenuOpenUseCaseId]);

  /** Modifica payoff / messaggio: vista etichetta+matita, edit con textbox classica e ✓ / ✗ */
  const [payoffEditUseCaseId, setPayoffEditUseCaseId] = React.useState<string | null>(null);
  const [payoffEditDraft, setPayoffEditDraft] = React.useState('');
  const [agentMsgEditUseCaseId, setAgentMsgEditUseCaseId] = React.useState<string | null>(null);
  const [agentMsgEditDraft, setAgentMsgEditDraft] = React.useState('');

  const [polishScenarioPendingUseCaseId, setPolishScenarioPendingUseCaseId] = React.useState<
    string | null
  >(null);

  const resolveScenarioTextForPolish = React.useCallback(
    (useCaseId: string): string => {
      const uc = useCases.find((x) => x.id === useCaseId);
      if (!uc) return '';
      if (payoffEditUseCaseId === useCaseId) {
        return payoffEditDraft.trim();
      }
      return getScenarioText(uc);
    },
    [useCases, payoffEditUseCaseId, payoffEditDraft]
  );

  const invokePolishUseCaseScenario = React.useCallback(
    async (useCaseId: string): Promise<void> => {
      if (!onPolishUseCaseScenario) return;
      const text = resolveScenarioTextForPolish(useCaseId);
      if (text.length < 8) return;
      setPolishScenarioPendingUseCaseId(useCaseId);
      try {
        const merged = await Promise.resolve(
          onPolishUseCaseScenario(useCaseId, text)
        );
        if (merged) {
          if (payoffEditUseCaseId === useCaseId) {
            setPayoffEditDraft(getScenarioText(merged));
          }
          clearNewHighlightOnDesignerAction(useCaseId);
        }
      } finally {
        setPolishScenarioPendingUseCaseId((cur) => (cur === useCaseId ? null : cur));
      }
    },
    [
      onPolishUseCaseScenario,
      resolveScenarioTextForPolish,
      payoffEditUseCaseId,
      clearNewHighlightOnDesignerAction,
    ]
  );

  React.useEffect(() => {
    setEditingTitleId(null);
  }, [effectiveSelectedId]);

  /**
   * Lift-up solo in modalità non controllata: se il parent passa anche `controlledSelectionId`,
   * la selezione è già condivisa e `setSelectedId` notifica il parent — un secondo effect qui
   * creerebbe ping-pong con la risincronizzazione controllata.
   */
  React.useEffect(() => {
    if (isLiftedSelection) return;
    onSelectionChange?.(effectiveSelectedId);
  }, [effectiveSelectedId, onSelectionChange, isLiftedSelection]);

  useUseCaseFieldBaselineSync(ordered, useCases, setFieldBaselineByUseCaseId);

  /**
   * Pubblica al `UseCaseWizardListToolbarContext` quante correzioni sostanziali
   * (≥ 3 parole cambiate per campo, vedi `useCaseSubstantialEdits.ts`) sono pendenti
   * rispetto all'ultima baseline IA. Include **bozze** aperte nelle textarea (scenario /
   * messaggio agente): finché l'utente non preme ✓ il `useCases` resta al valore
   * committato e il conteggio sarebbe zero — il callout DX non comparirebbe mai durante
   * l'edit. Solo nella vista wizard (layout accordion inline): fuori wizard no-op.
   */
  React.useEffect(() => {
    if (!listToolbarCtx) return;
    const items = ordered.map((u) => {
      const ast = u.dialogue.find((t) => t.role === 'assistant');
      const committedAgent = ast?.content ?? '';
      const agentMessage =
        agentMsgEditUseCaseId === u.id ? agentMsgEditDraft : committedAgent;
      const scenario =
        payoffEditUseCaseId === u.id
          ? payoffEditDraft
          : getScenarioText(u);
      return {
        id: u.id,
        current: { scenario, agentMessage },
        baseline: fieldBaselineByUseCaseId[u.id],
      };
    });
    listToolbarCtx.setPendingCorrectionsCount(countSubstantialEditsAcrossUseCases(items));
  }, [
    listToolbarCtx,
    ordered,
    useCases,
    fieldBaselineByUseCaseId,
    payoffEditUseCaseId,
    payoffEditDraft,
    agentMsgEditUseCaseId,
    agentMsgEditDraft,
  ]);

  /**
   * Registra al context l'handler «Completa correzione»: costruisce il payload directional
   * `(original, modified)` dalle baseline IA + draft correnti dei messaggi agente, delega
   * la chiamata LLM al parent (`onCompleteCorrection`), poi applica i risultati localmente:
   *
   *  1. sostituisce il `content` dell'ultimo turno assistente per ogni target rigenerato;
   *  2. riallinea la baseline IA degli **esempi** al loro draft corrente (così il count
   *     non li conteggia più come "modificati") e dei **target** al `newAssistantContent`
   *     ricevuto dall'LLM (così non vengono ri-toccati al prossimo round);
   *  3. registra i target nel set locale `completeCorrectionNewIds` per renderizzare il
   *     badge giallo `[NEW]` nei pill (riusa il rendering esistente di `phraseStyleNewSet`).
   *
   * Se non ci sono esempi o target da propagare, l'handler è no-op.
   * Se i `targets` sono vuoti (tutti già toccati) non c'è nulla da rigenerare: no-op.
   * Errori dell'API risalgono al parent (`useAIAgentEditorController.handleCompleteCorrection`)
   * che li espone via `useCaseComposerError`.
   */
  React.useEffect(() => {
    if (!listToolbarCtx) return;
    /**
     * Handler **async**: il context wrappa la chiamata e gestisce il busy flag
     * (`triggerConsolidateCorrections` setta `correctionsBusy` true → false a
     * settle). Restituiamo la stessa promise dell'IIFE per propagare il completamento
     * (e gli eventuali reject) al chiamante.
     */
    const handler = async (): Promise<void> => {
      await (async () => {
        if (typeof onCompleteCorrection !== 'function') return;
        const directionalExamples: Array<{
          useCaseId: string;
          useCaseLabel: string;
          original: string;
          modified: string;
        }> = [];
        const directionalTargets: Array<{
          useCaseId: string;
          useCaseLabel: string;
          original: string;
        }> = [];
        for (const u of ordered) {
          const baseline = fieldBaselineByUseCaseId[u.id];
          if (!baseline) continue;
          const ast = u.dialogue.find((t) => t.role === 'assistant');
          const committedAgent = ast?.content ?? '';
          const current =
            agentMsgEditUseCaseId === u.id ? agentMsgEditDraft : committedAgent;
          if (!current.trim() || !baseline.assistantContent.trim()) continue;
          if (
            isSubstantialEdit(current, baseline.assistantContent)
          ) {
            directionalExamples.push({
              useCaseId: u.id,
              useCaseLabel: u.label,
              original: baseline.assistantContent,
              modified: current,
            });
          } else if (current === baseline.assistantContent) {
            directionalTargets.push({
              useCaseId: u.id,
              useCaseLabel: u.label,
              original: current,
            });
          }
        }
        if (directionalExamples.length === 0 || directionalTargets.length === 0) return;
        const result = await onCompleteCorrection({
          directionalExamples,
          directionalTargets,
        });
        if (!result || result.updates.length === 0) return;

        const newContentByUseCaseId = new Map<string, string>();
        for (const u of result.updates) newContentByUseCaseId.set(u.useCaseId, u.newAssistantContent);
        const exampleContentByUseCaseId = new Map(
          directionalExamples.map((ex) => [ex.useCaseId, ex.modified])
        );

        setUseCases((prev) =>
          prev.map((u) => {
            const apiNew = newContentByUseCaseId.get(u.id);
            const exModified = exampleContentByUseCaseId.get(u.id);
            const content = apiNew ?? exModified;
            if (content === undefined) return u;
            const assistantTurnId = u.dialogue.find((x) => x.role === 'assistant')?.turn_id;
            if (!assistantTurnId) return u;
            return {
              ...u,
              dialogue: u.dialogue.map((t) =>
                t.role === 'assistant' && t.turn_id === assistantTurnId
                  ? { ...t, content, motor_snapshot: undefined }
                  : t
              ),
            };
          })
        );

        setFieldBaselineByUseCaseId((prev) => {
          const next: Record<string, AiTripletFieldBaseline> = { ...prev };
          for (const ex of directionalExamples) {
            const cur = next[ex.useCaseId];
            if (cur) next[ex.useCaseId] = { ...cur, assistantContent: ex.modified };
          }
          for (const u of result.updates) {
            const cur = next[u.useCaseId];
            if (cur) next[u.useCaseId] = { ...cur, assistantContent: u.newAssistantContent };
          }
          return next;
        });

        setCompleteCorrectionNewIds(
          (prev) => new Set([...prev, ...result.updates.map((u) => u.useCaseId)])
        );
        setAgentMsgEditUseCaseId(null);
      })();
    };
    listToolbarCtx.registerConsolidateCorrectionsHandler(handler);
    return () => {
      listToolbarCtx.registerConsolidateCorrectionsHandler(null);
    };
  }, [
    listToolbarCtx,
    ordered,
    fieldBaselineByUseCaseId,
    onCompleteCorrection,
    setUseCases,
    agentMsgEditUseCaseId,
    agentMsgEditDraft,
  ]);

  /**
   * Anteprima propagazione correzione nel callout DX: richiede stessi directional payload
   * del consolidamento quando il callout è visibile (`pendingCorrectionsCount` sopra soglia,
   * non dismissato).
   *
   * **Non** parte mentre l’utente sta ancora scrivendo nelle textarea inline (scenario /
   * messaggio agente): solo dopo il commit (`useCases` aggiornato e editor chiuso) si
   * ricalcola il payload e si lancia la richiesta. Il conteggio «correzioni pendenti»
   * continua a includere le bozze (callout visibile durante l’edit); l’anteprima IA si
   * aggiorna invece solo su dati committati.
   */
  React.useEffect(() => {
    if (!setCorrectionPreviewState) return;

    const dockNow = dockRef.current;
    if (!dockNow) {
      setCorrectionPreviewState(null);
      return;
    }

    const correctionsCalloutVisible =
      pendingCorrectionsCountToolbar >= COMPLETE_CORRECTION_VISIBILITY_THRESHOLD &&
      !correctionsDismissedToolbar;

    if (!correctionsCalloutVisible) {
      setCorrectionPreviewState(null);
      return;
    }

    if (agentMsgEditUseCaseId !== null || payoffEditUseCaseId !== null) {
      setCorrectionPreviewState(null);
      return;
    }

    const directionalExamples: Array<{
      useCaseId: string;
      useCaseLabel: string;
      original: string;
      modified: string;
    }> = [];
    const directionalTargets: Array<{
      useCaseId: string;
      useCaseLabel: string;
      original: string;
    }> = [];
    for (const u of ordered) {
      const baseline = fieldBaselineByUseCaseId[u.id];
      if (!baseline) continue;
      const ast = u.dialogue.find((t) => t.role === 'assistant');
      const committedAgent = ast?.content ?? '';
      const current = committedAgent;
      if (!current.trim() || !baseline.assistantContent.trim()) continue;
      if (isSubstantialEdit(current, baseline.assistantContent)) {
        directionalExamples.push({
          useCaseId: u.id,
          useCaseLabel: u.label,
          original: baseline.assistantContent,
          modified: current,
        });
      } else if (current === baseline.assistantContent) {
        directionalTargets.push({
          useCaseId: u.id,
          useCaseLabel: u.label,
          original: current,
        });
      }
    }

    if (directionalExamples.length === 0 || directionalTargets.length === 0) {
      setCorrectionPreviewState(null);
      return;
    }

    const previewTargetSlice = directionalTargets.slice(0, 3);
    const aiModel = dockNow.useCasePropagatorModel.trim();
    if (!aiModel) {
      setCorrectionPreviewState({
        loading: false,
        error: 'Configura un modello IA in Omnia Tutor per vedere un’anteprima.',
        synthesis: '',
        rows: [],
      });
      return;
    }

    const abort = new AbortController();
    const { tag: outputLanguage } = resolveAiAgentOutputLanguage();

    void (async (): Promise<void> => {
      setCorrectionPreviewState({
        loading: true,
        error: null,
        synthesis: CORRECTION_PREVIEW_SYNTHESIS_WAITING_MESSAGE,
        rows: [],
      });
      try {
        const result = await propagateCorrectionStylePreviewApi({
          directionalExamples,
          directionalTargets,
          provider: dockNow.useCasePropagatorProvider,
          model: aiModel,
          outputLanguage,
          globalStyleContract:
            dockNow.useCasePropagatorGlobalStyleContract.trim() || undefined,
          maxPreviewTargets: 3,
          callMeta: dockNow.buildUseCasePropagatorCallMeta(
            AI_CALL_PURPOSE.USE_CASE_COMPLETE_CORRECTION_PREVIEW
          ),
          signal: abort.signal,
        });
        if (abort.signal.aborted) return;
        const updateById = new Map<string, string>();
        for (const u of result.updates) {
          updateById.set(u.useCaseId, u.newAssistantContent);
        }
        const rows = previewTargetSlice.map((t) => ({
          useCaseId: t.useCaseId,
          useCaseLabel: t.useCaseLabel,
          current: t.original,
          proposed: updateById.get(t.useCaseId) ?? '',
        }));
        setCorrectionPreviewState({
          loading: false,
          error: null,
          synthesis: typeof result.styleSynthesis === 'string' ? result.styleSynthesis : '',
          rows,
        });
      } catch (e) {
        if (abort.signal.aborted) return;
        setCorrectionPreviewState({
          loading: false,
          error: e instanceof Error ? e.message : String(e),
          synthesis: '',
          rows: [],
        });
      }
    })();

    return () => abort.abort();
  }, [
    setCorrectionPreviewState,
    pendingCorrectionsCountToolbar,
    correctionsDismissedToolbar,
    ordered,
    fieldBaselineByUseCaseId,
    agentMsgEditUseCaseId,
    payoffEditUseCaseId,
    dock?.instanceId,
    dock?.useCasePropagatorProvider,
    dock?.useCasePropagatorModel,
    dock?.useCasePropagatorGlobalStyleContract,
  ]);

  React.useEffect(() => {
    setAgentMsgSelection({ start: 0, end: 0 });
    setAgentMsgTokenAnchor(null);
  }, [effectiveSelectedId]);

  React.useEffect(() => {
    /**
     * Sync della mappa espansione card con la lista ordinata: aggiunge entry mancanti
     * (default = collassato) e rimuove orfane. **Idempotente**: se non ci sono variazioni
     * effettive (es. l'utente sta solo togliendo la spunta «incluso»), restituiamo il
     * `prev` originale per evitare un rerender inutile dell'intera lista (ogni nuovo
     * oggetto stato innesca re-render di tutti gli `<li>` figli).
     */
    setCardExpandedById((prev) => {
      const orderedIds = new Set(ordered.map((u) => u.id));
      let added = 0;
      for (const u of ordered) {
        if (!(u.id in prev)) added += 1;
      }
      let removed = 0;
      for (const id of Object.keys(prev)) {
        if (!orderedIds.has(id)) removed += 1;
      }
      if (added === 0 && removed === 0) return prev;
      const next: Record<string, boolean> = {};
      for (const u of ordered) {
        next[u.id] = u.id in prev ? prev[u.id] : false;
      }
      return next;
    });
  }, [ordered]);

  const expandAllWizardCards = React.useCallback(() => {
    const { expandedById, mode } = expandAllUseCaseCards(orderedIds);
    accordionFoldModeRef.current = mode;
    setCardExpandedById(expandedById);
    setAccordionFoldMode(mode);
  }, [orderedIds]);

  const collapseAllWizardCards = React.useCallback(() => {
    const { expandedById, mode } = collapseAllUseCaseCards(orderedIds);
    accordionFoldModeRef.current = mode;
    setCardExpandedById(expandedById);
    setAccordionFoldMode(mode);
  }, [orderedIds]);

  /**
   * Dopo espansione accordion wizard: scroll della lista così la card resti visibile
   * (due rAF per attendere il layout del corpo espanso).
   */
  const scheduleScrollExpandedUseCaseCardIntoView = React.useCallback((useCaseId: string) => {
    const run = (): void => {
      const el = document.querySelector(`[data-uc-row-id="${CSS.escape(useCaseId)}"]`);
      if (!(el instanceof HTMLElement)) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
  }, []);

  React.useEffect(() => {
    if (!listToolbarCtx) return;
    listToolbarCtx.registerHandlers({
      expandAll: expandAllWizardCards,
      collapseAll: collapseAllWizardCards,
    });
    return () => listToolbarCtx.registerHandlers(null);
  }, [
    listToolbarCtx,
    expandAllWizardCards,
    collapseAllWizardCards,
  ]);

  /** Filtro ricerca / lente Slot Mapping: espandi solo i match visibili. */
  React.useEffect(() => {
    if (!wizardSearchSeed.trim()) return;
    const openIds = filteredOrdered.map((u) => u.id);
    if (openIds.length === 0) return;
    const { expandedById, mode } = expandOnlyUseCaseCards(openIds, orderedIds);
    accordionFoldModeRef.current = mode;
    setCardExpandedById(expandedById);
    setAccordionFoldMode(mode);
  }, [wizardSearchSeed, filteredOrdered, orderedIds]);

  const commitTitleEdit = React.useCallback(
    (useCaseId: string) => {
      const next = draftTitle.trim();
      if (!next) {
        setEditingTitleId(null);
        return;
      }
      setUseCases((prev) =>
        prev.map((u) =>
          u.id === useCaseId
            ? {
                ...u,
                label: next,
                designer_edit_confirmed: true as const,
                designer_label_vote: 'up' as const,
              }
            : u
        )
      );
      clearNewHighlightOnDesignerAction(useCaseId);
      setEditingTitleId(null);
    },
    [draftTitle, setUseCases, clearNewHighlightOnDesignerAction]
  );

  const createUseCase = React.useCallback(
    async (params: {
      label: string;
      parentId: string | null;
      creationScope?: 'single' | 'batch';
      holdComposerBusy?: boolean;
      deferSiblingReorder?: boolean;
      skipSelectAfterCreate?: boolean;
    }) => {
      const label = String(params.label || '').trim();
      if (!label) {
        logUseCaseRootBatch('createUseCase_skip_empty_label', { parentId: params.parentId });
        return '';
      }
      logUseCaseRootBatch('createUseCase_call', {
        labelPreview: label.slice(0, 120),
        labelLen: label.length,
        parentId: params.parentId,
        creationScope: params.creationScope ?? 'single',
        holdComposerBusy: params.holdComposerBusy === true,
      });
      const createdId = await onCreateUseCase({
        label,
        parentId: params.parentId,
        creationScope: params.creationScope,
        holdComposerBusy: params.holdComposerBusy,
        deferSiblingReorder: params.deferSiblingReorder,
      });
      logUseCaseRootBatch('createUseCase_done', { createdId });
      if (!params.skipSelectAfterCreate && createdId) {
        setSelectedId(createdId);
      }
      return createdId;
    },
    [onCreateUseCase]
  );

  const handleCreateRoot = React.useCallback(async () => {
    logUseCaseRootBatch('handleCreateRoot_start', {
      busy,
      rootDraftSubmitting,
      rawLen: rootDraftLabel.length,
      rawPreview: rootDraftLabel.slice(0, 200),
    });
    if (rootComposerLocked) {
      logUseCaseRootBatch('handleCreateRoot_abort_busy');
      return;
    }
    const rawSnapshot = rootDraftLabel;
    rootBatchInProgressRef.current = true;
    setRootDraftFlowActive(true);
    setRootDraftSubmitting(true);
    try {
      if (!String(rawSnapshot || '').trim()) {
        logUseCaseRootBatch('handleCreateRoot_abort_no_segments');
        return;
      }

      if (isConversationalRulesCatalog) {
        const parts = parseRootUseCaseDraftSegmentsFallback(rawSnapshot);
        if (parts.length === 0) return;
        if (parts.length > ROOT_USE_CASE_BATCH_MAX) {
          setRootBatchWarning(
            `Massimo ${ROOT_USE_CASE_BATCH_MAX} use case per invio. Riduci il batch.`
          );
          return;
        }
        setRootBatchWarning(null);
        setRootDraftLabel('');
        const batchScope = parts.length > 1 ? 'batch' : 'single';
        for (const label of parts) {
          await createUseCase({ label, parentId: null, creationScope: batchScope });
        }
        return;
      }

      let resolved: Awaited<ReturnType<typeof resolveRootUseCaseDraftForCreateAsync>>;
      try {
        resolved = await resolveRootUseCaseDraftForCreateAsync({
          raw: rawSnapshot,
          catalog: useCases,
          splitApi: onSplitRootUseCaseDraft
            ? (draft) => onSplitRootUseCaseDraft(draft)
            : undefined,
        });
      } catch (e) {
        logUseCaseRootBatch('handleCreateRoot_resolve_error', {
          message: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }

      logUseCaseRootBatch('handleCreateRoot_parsed', {
        segmentCount: resolved.labels.length,
        skippedCount: resolved.skippedCount,
        usedLlm: resolved.usedLlm,
        partsPreview: resolved.labels.map((p) => p.slice(0, 80)),
      });

      setRootDraftLabel('');
      logUseCaseRootBatch('handleCreateRoot_cleared_textarea');

      if (resolved.labels.length === 0) {
        if (resolved.skippedCount > 0) {
          setRootBatchWarning(
            resolved.skippedCount === 1
              ? '1 use case già presente, saltato.'
              : `${resolved.skippedCount} use case già presenti, saltati.`
          );
        }
        logUseCaseRootBatch('handleCreateRoot_abort_no_segments');
        return;
      }

      if (resolved.skippedCount > 0) {
        setRootBatchWarning(
          resolved.skippedCount === 1
            ? '1 duplicato saltato; creazione degli altri in corso…'
            : `${resolved.skippedCount} duplicati saltati; creazione degli altri in corso…`
        );
      } else {
        setRootBatchWarning(null);
      }

      const batchScope = resolved.labels.length > 1 ? 'batch' : 'single';
      const deferReorder = batchScope === 'batch';
      const createdIds: string[] = [];
      for (let i = 0; i < resolved.labels.length; i++) {
        const label = resolved.labels[i];
        const isLast = i === resolved.labels.length - 1;
        logUseCaseRootBatch('batch_segment_start', { index: i, total: resolved.labels.length });
        const createdId = await createUseCase({
          label,
          parentId: null,
          creationScope: batchScope,
          holdComposerBusy: !isLast,
          deferSiblingReorder: deferReorder,
          skipSelectAfterCreate: true,
        });
        if (createdId) createdIds.push(createdId);
        logUseCaseRootBatch('batch_segment_ok', { index: i, total: resolved.labels.length });
      }
      logUseCaseRootBatch('handleCreateRoot_batch_complete', { createdCount: createdIds.length });
      if (createdIds.length > 0) {
        requestAnimationFrame(() => {
          onRootUseCaseBatchCreated?.(createdIds);
        });
      }
    } catch (e) {
      logUseCaseRootBatch('handleCreateRoot_batch_error', {
        message: e instanceof Error ? e.message : String(e),
      });
      throw e;
    } finally {
      rootBatchInProgressRef.current = false;
      setRootDraftSubmitting(false);
      setRootDraftFlowActive(false);
    }
  }, [
    rootComposerLocked,
    rootDraftSubmitting,
    rootDraftLabel,
    useCases,
    isConversationalRulesCatalog,
    onSplitRootUseCaseDraft,
    onRootUseCaseBatchCreated,
    createUseCase,
  ]);

  React.useLayoutEffect(() => {
    const el = rootDraftRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minPx = 36;
    el.style.height = `${Math.max(minPx, el.scrollHeight)}px`;
  }, [rootDraftLabel]);

  const handleCreateChild = React.useCallback(
    async (parentId: string) => {
      if (busy) return;
      const nextLabel = childDraftLabel.trim();
      if (!nextLabel) return;
      await createUseCase({ label: nextLabel, parentId });
      setCreatingChildParentId(null);
      setChildDraftLabel('');
    },
    [busy, childDraftLabel, createUseCase]
  );

  /**
   * Aggiorna il contenuto del turno assistente per uno use case.
   *
   * - `mode: 'commit'` (default): conferma implicita (voti, incluso nelle conversazioni,
   *   collasso card wizard) come dopo il segno di spunta di conferma messaggio.
   * - `mode: 'silent'`: solo aggiornamento testo + `userEdited` sul turno (es. tokenizza /
   *   rimuovi quadre durante l’edit) **senza** collassare la card né forzare i voti in header.
   */
  const setAssistantTurnContentForUseCase = React.useCallback(
    (
      useCaseId: string,
      turnId: string,
      content: string,
      options?: { mode?: 'commit' | 'silent' }
    ) => {
      const mode = options?.mode ?? 'commit';
      if (mode === 'silent') {
        setUseCases((prev) =>
          prev.map((u) =>
            u.id === useCaseId
              ? syncPrimaryPhraseNaturalFromAssistantTurn(
                  {
                    ...u,
                    dialogue: u.dialogue.map((turn) =>
                      turn.turn_id === turnId ? { ...turn, content, userEdited: true } : turn
                    ),
                  },
                  turnId,
                  content
                )
              : u
          )
        );
        return;
      }
      setUseCases((prev) =>
        prev.map((u) =>
          u.id === useCaseId
            ? applyUseCaseValidatedOnMessageCommit(
                syncPrimaryPhraseNaturalFromAssistantTurn(
                  {
                    ...u,
                    dialogue: u.dialogue.map((turn) =>
                      turn.turn_id === turnId ? { ...turn, content, userEdited: true } : turn
                    ),
                  },
                  turnId,
                  content
                )
              )
            : u
        )
      );
      clearNewHighlightOnDesignerAction(useCaseId);
      commitCardExpansion(useCaseId, false, 'programmatic');
      listToolbarCtx?.notifyCardToggle();
    },
    [setUseCases, clearNewHighlightOnDesignerAction, listToolbarCtx, commitCardExpansion]
  );

  const [parametricCartesianErrorById, setParametricCartesianErrorById] = React.useState<
    Record<string, string>
  >({});

  const handleTogglePrimaryParametric = React.useCallback(
    (useCaseId: string, enabled: boolean) => {
      setParametricCartesianErrorById((m) => {
        const n = { ...m };
        delete n[useCaseId];
        return n;
      });
      setUseCases((prev) =>
        prev.map((uc) =>
          uc.id === useCaseId ? setPrimaryPhraseParametricEnabled(uc, enabled) : uc
        )
      );
    },
    [setUseCases]
  );

  const handleAddParametricCatalogDimension = React.useCallback(
    (useCaseId: string, catalogKey: string) => {
      setUseCases((prev) =>
        prev.map((uc) =>
          uc.id === useCaseId ? addParametricCatalogDimension(uc, catalogKey) : uc
        )
      );
    },
    [setUseCases]
  );

  const handleAddParametricFreeDimension = React.useCallback(
    (useCaseId: string) => {
      setUseCases((prev) =>
        prev.map((uc) => (uc.id === useCaseId ? addParametricFreeDimension(uc) : uc))
      );
    },
    [setUseCases]
  );

  const handleRemoveParametricDimension = React.useCallback(
    (useCaseId: string, dimensionId: string) => {
      setUseCases((prev) =>
        prev.map((uc) =>
          uc.id === useCaseId ? removeParametricDimension(uc, dimensionId) : uc
        )
      );
    },
    [setUseCases]
  );

  const handlePatchParametricDimensionLabel = React.useCallback(
    (useCaseId: string, dimensionId: string, label: string) => {
      setUseCases((prev) =>
        prev.map((uc) =>
          uc.id === useCaseId
            ? patchParametricDimensionLabel(uc, dimensionId, label)
            : uc
        )
      );
    },
    [setUseCases]
  );

  const handleAddParametricRow = React.useCallback(
    (useCaseId: string) => {
      setUseCases((prev) =>
        prev.map((uc) => (uc.id === useCaseId ? addParametricRow(uc) : uc))
      );
    },
    [setUseCases]
  );

  const handlePatchParametricCell = React.useCallback(
    (useCaseId: string, rowId: string, dimensionId: string, value: string) => {
      setUseCases((prev) =>
        prev.map((uc) =>
          uc.id === useCaseId ? patchParametricRowCell(uc, rowId, dimensionId, value) : uc
        )
      );
    },
    [setUseCases]
  );

  const handlePatchParametricPrompt = React.useCallback(
    (useCaseId: string, rowId: string, promptNaturalText: string) => {
      setUseCases((prev) =>
        prev.map((uc) =>
          uc.id === useCaseId
            ? patchParametricRowPrompt(uc, rowId, promptNaturalText)
            : uc
        )
      );
    },
    [setUseCases]
  );

  const handleExpandParametricCartesian = React.useCallback(
    (useCaseId: string) => {
      const uc = useCases.find((x) => x.id === useCaseId);
      if (!uc) return;
      const { uc: nextUc, error } = expandParametricCartesian(uc);
      if (error) {
        setParametricCartesianErrorById((m) => ({ ...m, [useCaseId]: error }));
        return;
      }
      setParametricCartesianErrorById((m) => {
        const n = { ...m };
        delete n[useCaseId];
        return n;
      });
      setUseCases((prev) => prev.map((u) => (u.id === useCaseId ? nextUc : u)));
    },
    [useCases, setUseCases]
  );

  const handlePatchUseCase = React.useCallback(
    (useCaseId: string, updater: (uc: AIAgentUseCase) => AIAgentUseCase) => {
      setUseCases((prev) => prev.map((uc) => (uc.id === useCaseId ? updater(uc) : uc)));
    },
    [setUseCases]
  );

  const payoffTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const agentTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const payoffTextareaRefsById = React.useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const agentTextareaRefsById = React.useRef<Map<string, HTMLTextAreaElement>>(new Map());
  /**
   * Textarea attiva per il messaggio agente in modifica: pannello dettaglio (classic) vs riga
   * lista (wizard).
   */
  const getActiveAgentTextarea = React.useCallback((): HTMLTextAreaElement | null => {
    if (!agentMsgEditUseCaseId) return null;
    return agentTextareaRefsById.current.get(agentMsgEditUseCaseId) ?? null;
  }, [agentMsgEditUseCaseId]);
  /** Live assistant text per use case (Annotate JSON / focus safety). */
  const liveAgentContentByIdRef = React.useRef<Record<string, string>>({});
  /** Turn in modifica nel wizard (commit messaggio). */
  const agentMsgEditTurnIdRef = React.useRef<string>('');
  /** Shell for JSON “Espandi”: overlay fills treeview + dettaglio (intera riga use case). */
  const useCaseDetailShellRef = React.useRef<HTMLDivElement>(null);

  const syncDetailTextareaHeights = React.useCallback(() => {
    const grow = (el: HTMLTextAreaElement | null, minPx: number) => {
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.max(minPx, el.scrollHeight)}px`;
    };
    grow(payoffTextareaRef.current, 48);
    grow(agentTextareaRef.current, 64);
  }, []);

  const syncWizardTextareaHeights = React.useCallback(() => {
    const grow = (el: HTMLTextAreaElement | null, minPx: number) => {
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.max(minPx, el.scrollHeight)}px`;
    };
    for (const el of payoffTextareaRefsById.current.values()) grow(el, 48);
    for (const el of agentTextareaRefsById.current.values()) grow(el, 64);
  }, []);

  /**
   * All’apertura dell’edit (click matita / doppio click) le textarea sono appena montate con
   * `rows={2}`: senza questa sync l’altezza resta bassa finché non si digita. Qui forziamo
   * l’espansione al contenuto completo prima del paint visibile.
   */
  React.useLayoutEffect(() => {
    if (!payoffEditUseCaseId && !agentMsgEditUseCaseId) return;
    syncWizardTextareaHeights();
    syncDetailTextareaHeights();
  }, [payoffEditUseCaseId, agentMsgEditUseCaseId, syncWizardTextareaHeights, syncDetailTextareaHeights]);

  const setPayoffForUseCase = React.useCallback(
    (useCaseId: string, value: string) => {
      setUseCases((prev) =>
        prev.map((u) =>
          u.id === useCaseId
            ? {
                ...withScenarioText(u, value),
                designer_edit_confirmed: true as const,
                designer_payoff_vote: 'up' as const,
              }
            : u
        )
      );
      clearNewHighlightOnDesignerAction(useCaseId);
    },
    [setUseCases, clearNewHighlightOnDesignerAction]
  );

  /**
   * Toggle del flag "incluso nelle conversazioni" sul use case.
   *
   * Persistenza: scrivo `included_in_conversations` direttamente nel record dello use case.
   * Backward-compat: assenza del campo == incluso (vedi {@link isUseCaseIncludedInConversations}),
   * quindi i task storici restano invariati. Quando l'utente toglie la spunta:
   *  - le conversazioni gi\u00e0 generate per questo use case vengono SOLO nascoste in vista (non
   *    cancellate dallo storage), e il use case viene escluso dal JSON proiettato per il
   *    system prompt;
   *  - resta invece SEMPRE visibile in lista (checkbox disattivata; eventuale header rosso se
   *    invalidato) e continua ad essere passato come `existingUseCases` a tutti i contesti dove
   *    l'IA propone nuovi use case (no duplicati).
   */
  const setUseCaseIncludedInConversations = React.useCallback(
    (useCaseId: string, included: boolean) => {
      setUseCases((prev) =>
        prev.map((u) =>
          u.id === useCaseId ? { ...u, included_in_conversations: included } : u
        )
      );
    },
    [setUseCases]
  );

  const toggleDesignerFieldVote = React.useCallback(
    (useCaseId: string, field: DesignerVoteField, choice: DesignerFieldVote) => {
      setUseCases((prev) => applyDesignerFieldVoteToggle(prev, useCaseId, field, choice));
      clearNewHighlightOnDesignerAction(useCaseId);
    },
    [setUseCases, clearNewHighlightOnDesignerAction]
  );

  /**
   * Voto «di validazione» sull'intero use case, applicato dal pollice nell'header della
   * lista. Tre effetti coordinati:
   *  1. Aggiorna `designer_label_vote` con la stessa logica del toggle generico (un secondo
   *     click sulla stessa scelta rimuove il voto). Se il voto risultante è rosso (`down`),
   *     l'use case viene automaticamente escluso dalle conversazioni (`included=false`);
   *     verde/neutro torna incluso di default.
   *  2. Collassa l'accordion del use case (in modalità wizard): il designer ha appena
   *     espresso un giudizio, non ha più bisogno di vedere scenario / messaggio aperti.
   *  3. Notifica la toolbar wizard del cambio espansione (per aggiornare il contatore
   *     «X di Y aperti»).
   * Il colore di sfondo dell'header è derivato in render dal voto risultante: verde su
   * `'up'`, rosso su `'down'`, neutro altrimenti — vedi `headerBgClass` più sotto.
   */
  const validateUseCaseFromHeader = React.useCallback(
    (useCaseId: string, choice: DesignerFieldVote) => {
      setUseCases((prev) => applyUseCaseHeaderVoteToggle(prev, useCaseId, choice));
      clearNewHighlightOnDesignerAction(useCaseId);
      commitCardExpansion(useCaseId, false, 'programmatic');
      listToolbarCtx?.notifyCardToggle();
    },
    [setUseCases, clearNewHighlightOnDesignerAction, listToolbarCtx, commitCardExpansion]
  );

  const beginPayoffEdit = React.useCallback((useCaseId: string, current: string) => {
    setAgentMsgEditUseCaseId(null);
    setPayoffEditUseCaseId(useCaseId);
    setPayoffEditDraft(current);
  }, []);

  const commitPayoffEdit = React.useCallback(() => {
    if (!payoffEditUseCaseId) return;
    setPayoffForUseCase(payoffEditUseCaseId, payoffEditDraft.trim());
    setPayoffEditUseCaseId(null);
    requestAnimationFrame(() => {
      syncWizardTextareaHeights();
      syncDetailTextareaHeights();
    });
  }, [
    payoffEditUseCaseId,
    payoffEditDraft,
    setPayoffForUseCase,
    syncWizardTextareaHeights,
    syncDetailTextareaHeights,
  ]);

  const cancelPayoffEdit = React.useCallback(() => {
    setPayoffEditUseCaseId(null);
  }, []);

  const beginAgentMsgEdit = React.useCallback(
    (useCaseId: string, turnId: string, current: string) => {
      if (onAssistantPhraseDraftChange && agentMsgEditUseCaseId && agentMsgEditUseCaseId !== useCaseId) {
        onAssistantPhraseDraftChange(agentMsgEditUseCaseId, null);
      }
      setPayoffEditUseCaseId(null);
      agentMsgEditTurnIdRef.current = turnId;
      setAgentMsgEditUseCaseId(useCaseId);
      setAgentMsgEditDraft(current);
      liveAgentContentByIdRef.current[useCaseId] = current;
      liveAgentContentRef.current = current;
    },
    [agentMsgEditUseCaseId, onAssistantPhraseDraftChange]
  );

  const commitAgentMsgEdit = React.useCallback(() => {
    if (!agentMsgEditUseCaseId || !agentMsgEditTurnIdRef.current) return;
    const tid = agentMsgEditTurnIdRef.current;
    const ucId = agentMsgEditUseCaseId;
    onAssistantPhraseDraftChange?.(ucId, null);
    setAssistantTurnContentForUseCase(ucId, tid, agentMsgEditDraft);
    liveAgentContentByIdRef.current[ucId] = agentMsgEditDraft;
    setAgentMsgEditUseCaseId(null);
    requestAnimationFrame(() => {
      syncWizardTextareaHeights();
      syncDetailTextareaHeights();
    });
  }, [
    agentMsgEditUseCaseId,
    agentMsgEditDraft,
    onAssistantPhraseDraftChange,
    setAssistantTurnContentForUseCase,
    syncWizardTextareaHeights,
    syncDetailTextareaHeights,
  ]);

  const cancelAgentMsgEdit = React.useCallback(() => {
    if (agentMsgEditUseCaseId) {
      onAssistantPhraseDraftChange?.(agentMsgEditUseCaseId, null);
    }
    setAgentMsgEditUseCaseId(null);
  }, [agentMsgEditUseCaseId, onAssistantPhraseDraftChange]);

  const setPayoffContent = React.useCallback(
    (value: string) => {
      if (!selected) return;
      setPayoffForUseCase(selected.id, value);
    },
    [selected, setPayoffForUseCase]
  );

  const assistantTurn = React.useMemo(
    () => (selected ? selected.dialogue.find((t) => t.role === 'assistant') : undefined),
    [selected]
  );

  /**
   * Tracks the live textarea content synchronously on every onChange, bypassing React's rendering
   * cycle. This is the source of truth for the "Aggiorna JSON" action: avoids the race condition
   * where React re-renders with stale state between a paste and the button click.
   * Declared after `assistantTurn` so the initial ref matches the selected turn (sync effect below).
   */
  const liveAgentContentRef = React.useRef<string>(assistantTurn?.content ?? '');

  const scenarioDirty = React.useMemo(() => {
    if (!selected) return false;
    const b = fieldBaselineByUseCaseId[selected.id];
    if (!b) return false;
    return getScenarioText(selected) !== b.payoff;
  }, [selected, fieldBaselineByUseCaseId]);

  const agentMessageEmpty = React.useMemo(
    () => !assistantTurn || !String(assistantTurn.content ?? '').trim(),
    [assistantTurn, assistantTurn?.content]
  );

  /**
   * Sincronizza `agentMsgSelection` con il DOM. Richiede che la textarea del messaggio abbia
   * il focus: evita aggiornamenti spurii quando `selectionchange` globale scatta mentre l’utente
   * interagisce con altri controlli; mantiene comunque il caso «mouseup fuori dalla textarea»
   * perché in quel caso il focus resta sulla textarea finché non si clicca altrove.
   */
  const syncAgentMsgSelection = React.useCallback(() => {
    const ta = getActiveAgentTextarea();
    if (!ta) return;
    if (document.activeElement !== ta) return;
    setAgentMsgSelection({ start: ta.selectionStart, end: ta.selectionEnd });
  }, [getActiveAgentTextarea]);

  React.useEffect(() => {
    setAgentMsgSelection({ start: 0, end: 0 });
    setAgentMsgTokenAnchor(null);
    setAgentMsgPointerSelecting(false);
  }, [agentMsgEditUseCaseId]);

  React.useEffect(() => {
    if (!agentMsgPointerSelecting) return;
    const end = (): void => {
      setAgentMsgPointerSelecting(false);
    };
    window.addEventListener('mouseup', end, true);
    window.addEventListener('touchend', end, true);
    return () => {
      window.removeEventListener('mouseup', end, true);
      window.removeEventListener('touchend', end, true);
    };
  }, [agentMsgPointerSelecting]);

  /**
   * `mouseup` sulla textarea non arriva se l’utente rilascia il tasto fuori dal campo dopo un
   * drag-select; `selectionchange` sul document è emesso quando la selezione nel textarea cambia
   * (doppio click, Shift+frecce, drag anche con rilascio esterno). Coalesciamo con rAF per non
   * saturare React durante il drag.
   */
  React.useEffect(() => {
    if (!agentMsgEditUseCaseId || busy) return;
    let raf = 0;
    const scheduleSync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        syncAgentMsgSelection();
      });
    };
    document.addEventListener('selectionchange', scheduleSync);
    document.addEventListener('mouseup', scheduleSync, true);
    return () => {
      document.removeEventListener('selectionchange', scheduleSync);
      document.removeEventListener('mouseup', scheduleSync, true);
      cancelAnimationFrame(raf);
    };
  }, [agentMsgEditUseCaseId, busy, syncAgentMsgSelection]);

  const agentMsgContentForDetailOps = React.useMemo(() => {
    if (!assistantTurn) return '';
    if (selected && agentMsgEditUseCaseId === selected.id) return agentMsgEditDraft;
    return assistantTurn.content;
  }, [assistantTurn, selected, agentMsgEditUseCaseId, agentMsgEditDraft]);

  const agentMsgTokenPopoverAction = React.useMemo(
    () =>
      agentMsgEditUseCaseId
        ? computeAgentTokenSelectionPopoverAction(
            agentMsgEditDraft,
            agentMsgSelection.start,
            agentMsgSelection.end
          )
        : ('none' as const),
    [agentMsgEditUseCaseId, agentMsgEditDraft, agentMsgSelection.start, agentMsgSelection.end]
  );

  const agentMsgTokenPopoverActionVisible = React.useMemo(() => {
    if (agentMsgPointerSelecting) return 'none' as const;
    return agentMsgTokenPopoverAction;
  }, [agentMsgPointerSelecting, agentMsgTokenPopoverAction]);

  const recalcAgentMsgTokenAnchor = React.useCallback(() => {
    if (busy || !agentMsgEditUseCaseId || agentMsgPointerSelecting) {
      setAgentMsgTokenAnchor(null);
      return;
    }
    const action = computeAgentTokenSelectionPopoverAction(
      agentMsgEditDraft,
      agentMsgSelection.start,
      agentMsgSelection.end
    );
    if (action === 'none') {
      setAgentMsgTokenAnchor(null);
      return;
    }
    const ta = getActiveAgentTextarea();
    if (!ta) {
      setAgentMsgTokenAnchor(null);
      return;
    }
    const { start, end } = agentMsgSelection;
    if (start === end) {
      setAgentMsgTokenAnchor(null);
      return;
    }
    const caretIndex = Math.max(start, end);
    const pt = getTextareaCaretViewportPoint(ta, caretIndex);
    if (!pt) {
      setAgentMsgTokenAnchor(null);
      return;
    }
    const cs = window.getComputedStyle(ta);
    const lhParsed = Number.parseFloat(cs.lineHeight);
    const fontSize = Number.parseFloat(cs.fontSize) || 14;
    const lineHeightPx = Number.isFinite(lhParsed) ? lhParsed : fontSize * 1.25;
    const anchor = buildTokenPopoverAnchorBelowCaret(pt, lineHeightPx);
    setAgentMsgTokenAnchor((prev) => {
      if (
        prev &&
        prev.top === anchor.top &&
        prev.left === anchor.left &&
        prev.caretTop === anchor.caretTop
      ) {
        return prev;
      }
      return anchor;
    });
  }, [
    busy,
    agentMsgEditUseCaseId,
    agentMsgEditDraft,
    agentMsgPointerSelecting,
    agentMsgSelection.start,
    agentMsgSelection.end,
    getActiveAgentTextarea,
  ]);

  React.useLayoutEffect(() => {
    recalcAgentMsgTokenAnchor();
  }, [recalcAgentMsgTokenAnchor]);

  const queueRecalcAgentMsgTokenAnchor = React.useCallback(() => {
    requestAnimationFrame(() => {
      recalcAgentMsgTokenAnchor();
    });
  }, [recalcAgentMsgTokenAnchor]);

  const dismissAgentMsgTokenPopover = React.useCallback(() => {
    const ta = getActiveAgentTextarea();
    const collapseAt = agentMsgSelection.end;
    if (ta) {
      ta.focus();
      ta.setSelectionRange(collapseAt, collapseAt);
    }
    setAgentMsgSelection({ start: collapseAt, end: collapseAt });
    setAgentMsgTokenAnchor(null);
  }, [getActiveAgentTextarea, agentMsgSelection.end]);

  const canWrapAgentToken = React.useMemo(() => {
    if (busy || !agentMsgEditUseCaseId || agentMsgPointerSelecting) return false;
    const { start, end } = agentMsgSelection;
    if (start === end) return false;
    return agentMsgTokenPopoverAction === 'tokenize';
  }, [busy, agentMsgEditUseCaseId, agentMsgPointerSelecting, agentMsgSelection, agentMsgTokenPopoverAction]);

  const canStripAgentTokens = React.useMemo(
    () => Boolean(agentMsgEditUseCaseId && !busy && messageHasAgentTokens(agentMsgEditDraft)),
    [agentMsgEditUseCaseId, busy, agentMsgEditDraft]
  );

  const handleWrapAgentToken = React.useCallback(() => {
    if (!agentMsgEditUseCaseId || busy) return;
    const turnId = agentMsgEditTurnIdRef.current;
    if (!turnId) return;
    const ta = getActiveAgentTextarea();
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return;
    const content = agentMsgEditDraft;
    if (computeAgentTokenSelectionPopoverAction(content, start, end) !== 'tokenize') return;
    const built = buildBracketWrapForSelection(content, start, end);
    if (!built) return;
    const { next, selStart, selEnd } = built;
    setAssistantTurnContentForUseCase(agentMsgEditUseCaseId, turnId, next, { mode: 'silent' });
    setAgentMsgEditDraft(next);
    liveAgentContentByIdRef.current[agentMsgEditUseCaseId] = next;
    if (selected?.id === agentMsgEditUseCaseId) {
      liveAgentContentRef.current = next;
    }
    onAssistantPhraseDraftChange?.(agentMsgEditUseCaseId, next);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = getActiveAgentTextarea();
        if (!el) return;
        el.focus();
        el.setSelectionRange(selStart, selEnd);
        syncDetailTextareaHeights();
        syncWizardTextareaHeights();
        setAgentMsgSelection({ start: selStart, end: selEnd });
      });
    });
  }, [
    agentMsgEditUseCaseId,
    busy,
    agentMsgEditDraft,
    getActiveAgentTextarea,
    selected?.id,
    setAssistantTurnContentForUseCase,
    syncDetailTextareaHeights,
    syncWizardTextareaHeights,
    onAssistantPhraseDraftChange,
  ]);

  const handleWrapStyleAgentToken = React.useCallback(() => {
    if (!agentMsgEditUseCaseId || busy) return;
    const turnId = agentMsgEditTurnIdRef.current;
    if (!turnId) return;
    const ta = getActiveAgentTextarea();
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return;
    const content = agentMsgEditDraft;
    if (computeAgentTokenSelectionPopoverAction(content, start, end) !== 'tokenize') return;
    const built = buildStyleWrapForSelection(content, start, end);
    if (!built) return;
    const { next, selStart, selEnd, inner } = built;
    setUseCases((prev) =>
      prev.map((uc) =>
        uc.id === agentMsgEditUseCaseId ? upsertStyleTokenOnWrap(uc, inner) : uc
      )
    );
    setAssistantTurnContentForUseCase(agentMsgEditUseCaseId, turnId, next, { mode: 'silent' });
    setAgentMsgEditDraft(next);
    liveAgentContentByIdRef.current[agentMsgEditUseCaseId] = next;
    if (selected?.id === agentMsgEditUseCaseId) {
      liveAgentContentRef.current = next;
    }
    onAssistantPhraseDraftChange?.(agentMsgEditUseCaseId, next);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = getActiveAgentTextarea();
        if (!el) return;
        el.focus();
        el.setSelectionRange(selStart, selEnd);
        syncDetailTextareaHeights();
        syncWizardTextareaHeights();
        setAgentMsgSelection({ start: selStart, end: selEnd });
      });
    });
  }, [
    agentMsgEditUseCaseId,
    busy,
    agentMsgEditDraft,
    getActiveAgentTextarea,
    selected?.id,
    setAssistantTurnContentForUseCase,
    setUseCases,
    syncDetailTextareaHeights,
    syncWizardTextareaHeights,
    onAssistantPhraseDraftChange,
  ]);

  const agentMsgEditingStyleTokens = React.useMemo(() => {
    if (!agentMsgEditUseCaseId) return [];
    const uc = useCases.find((u) => u.id === agentMsgEditUseCaseId);
    return uc ? getPrimaryPhraseStyleTokens(uc) : [];
  }, [agentMsgEditUseCaseId, useCases]);

  const agentMsgActiveStyleToken = React.useMemo(() => {
    if (agentMsgTokenPopoverAction !== 'untokenize') return null;
    const span = findTokenSpanAtSelection(
      agentMsgEditDraft,
      agentMsgSelection.start,
      agentMsgSelection.end
    );
    if (span?.kind !== 'style') return null;
    return agentMsgEditingStyleTokens.find((t) => t.defaultSurface === span.inner) ?? null;
  }, [
    agentMsgTokenPopoverAction,
    agentMsgEditDraft,
    agentMsgSelection.start,
    agentMsgSelection.end,
    agentMsgEditingStyleTokens,
  ]);

  const handlePatchAgentStyleTokenVariants = React.useCallback(
    (styleTokenId: string, variants: string[]) => {
      if (!agentMsgEditUseCaseId || busy) return;
      setUseCases((prev) =>
        prev.map((uc) =>
          uc.id === agentMsgEditUseCaseId ? patchStyleTokenVariants(uc, styleTokenId, variants) : uc
        )
      );
    },
    [agentMsgEditUseCaseId, busy, setUseCases]
  );

  const handleUnwrapAgentTokenAtSelection = React.useCallback(() => {
    if (!agentMsgEditUseCaseId || busy) return;
    const turnId = agentMsgEditTurnIdRef.current;
    if (!turnId) return;
    const ta = getActiveAgentTextarea();
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const content = agentMsgEditDraft;
    const result = unwrapBracketTokenContainingSelection(content, start, end);
    if (!result) return;
    const { next, selStart, selEnd, kind, inner } = result;
    if (kind === 'style') {
      setUseCases((prev) =>
        prev.map((uc) =>
          uc.id === agentMsgEditUseCaseId ? removeStyleTokenOnUnwrap(uc, inner) : uc
        )
      );
    }
    setAssistantTurnContentForUseCase(agentMsgEditUseCaseId, turnId, next, { mode: 'silent' });
    setAgentMsgEditDraft(next);
    liveAgentContentByIdRef.current[agentMsgEditUseCaseId] = next;
    if (selected?.id === agentMsgEditUseCaseId) {
      liveAgentContentRef.current = next;
    }
    onAssistantPhraseDraftChange?.(agentMsgEditUseCaseId, next);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = getActiveAgentTextarea();
        if (!el) return;
        el.focus();
        el.setSelectionRange(selStart, selEnd);
        syncDetailTextareaHeights();
        syncWizardTextareaHeights();
        setAgentMsgSelection({ start: selStart, end: selEnd });
      });
    });
  }, [
    agentMsgEditUseCaseId,
    busy,
    agentMsgEditDraft,
    getActiveAgentTextarea,
    selected?.id,
    setAssistantTurnContentForUseCase,
    syncDetailTextareaHeights,
    syncWizardTextareaHeights,
    onAssistantPhraseDraftChange,
    setUseCases,
  ]);

  const handleStripAgentTokens = React.useCallback(() => {
    if (!agentMsgEditUseCaseId || busy) return;
    const turnId = agentMsgEditTurnIdRef.current;
    if (!turnId) return;
    const content = agentMsgEditDraft;
    if (!messageHasAgentTokens(content)) return;
    const next = stripAgentMessageTokens(content);
    setAssistantTurnContentForUseCase(agentMsgEditUseCaseId, turnId, next, { mode: 'silent' });
    setAgentMsgEditDraft(next);
    liveAgentContentByIdRef.current[agentMsgEditUseCaseId] = next;
    if (selected?.id === agentMsgEditUseCaseId) {
      liveAgentContentRef.current = next;
    }
    onAssistantPhraseDraftChange?.(agentMsgEditUseCaseId, next);
    requestAnimationFrame(() => {
      syncDetailTextareaHeights();
      syncWizardTextareaHeights();
      syncAgentMsgSelection();
    });
  }, [
    agentMsgEditUseCaseId,
    busy,
    agentMsgEditDraft,
    selected?.id,
    setAssistantTurnContentForUseCase,
    syncAgentMsgSelection,
    syncDetailTextareaHeights,
    syncWizardTextareaHeights,
    onAssistantPhraseDraftChange,
  ]);

  const handleScenarioRegenerateClick = React.useCallback(async () => {
    if (!selected || busy) return;
    const updated = await onRegenerateUseCase(selected.id);
    if (updated) {
      const ast = updated.dialogue.find((t) => t.role === 'assistant');
      setFieldBaselineByUseCaseId((prev) => ({
        ...prev,
        [selected.id]: {
          label: updated.label,
          payoff: typeof updated.payoff === 'string' ? updated.payoff : '',
          assistantContent: ast?.content ?? '',
        },
      }));
    }
  }, [selected, busy, onRegenerateUseCase]);

  const ensureAssistantTurnFor = React.useCallback(
    (useCaseId: string) => {
      setUseCases((prev) =>
        prev.map((u) => {
          if (u.id !== useCaseId) return u;
          if (u.dialogue.some((t) => t.role === 'assistant')) return u;
          return {
            ...u,
            dialogue: [
              ...u.dialogue,
              {
                turn_id: newAgentUseCaseTurnId(),
                role: 'assistant' as const,
                content: '',
                editable: true,
              },
            ],
          };
        })
      );
    },
    [setUseCases]
  );

  const ensureAssistantTurn = React.useCallback(() => {
    if (!selected) return;
    ensureAssistantTurnFor(selected.id);
  }, [selected, ensureAssistantTurnFor]);

  React.useLayoutEffect(() => {
    syncDetailTextareaHeights();
  }, [
    syncDetailTextareaHeights,
    effectiveSelectedId,
    selected?.payoff,
    assistantTurn?.content,
    assistantTurn?.turn_id,
  ]);

  React.useLayoutEffect(() => {
    syncWizardTextareaHeights();
  }, [
    syncWizardTextareaHeights,
    wizardShowScenario,
    wizardShowMessage,
    cardExpandedById,
  ]);

  /**
   * Keep liveAgentContentRef in sync with external state changes (API annotation response,
   * use case selection, regeneration). User input is captured directly in onChange and takes
   * precedence since it runs synchronously before React's render cycle.
   */
  React.useEffect(() => {
    liveAgentContentRef.current = assistantTurn?.content ?? '';
  }, [assistantTurn?.content, assistantTurn?.turn_id]);

  React.useEffect(() => {
    const m = { ...liveAgentContentByIdRef.current };
    for (const uc of useCases) {
      const t = uc.dialogue.find((x) => x.role === 'assistant');
      m[uc.id] = t?.content ?? '';
    }
    liveAgentContentByIdRef.current = m;
  }, [useCases]);

  const mergedStyleContractForCatalog = React.useMemo(() => {
    const base =
      AI_AGENT_GLOBAL_USE_CASE_STYLES.find((s) => s.id === useCaseGlobalStyleId)?.contract ?? '';
    return mergeUseCaseGlobalStyleContract(base, useCaseStyleLearningNotes.trim());
  }, [useCaseGlobalStyleId, useCaseStyleLearningNotes]);

  const runtimeCatalogExport = React.useMemo(() => {
    const built = buildVirtualAgentRuntimeCatalogFromUseCases(useCases);
    return {
      catalogJson: serializeVirtualAgentRuntimeCatalog(built),
      appendix: buildVirtualAgentUseCaseConstrainedPromptAppendix(built.entries, {
        globalStyleContract: mergedStyleContractForCatalog,
      }),
      skippedCount: built.skipped.length,
      entryCount: built.entries.length,
    };
  }, [useCases, mergedStyleContractForCatalog]);

  const copyRuntimeCatalogJson = React.useCallback(() => {
    void navigator.clipboard.writeText(runtimeCatalogExport.catalogJson).catch(() => {
      /* clipboard denied */
    });
  }, [runtimeCatalogExport.catalogJson]);

  const copyRuntimeAppendix = React.useCallback(() => {
    void navigator.clipboard.writeText(runtimeCatalogExport.appendix).catch(() => {
      /* clipboard denied */
    });
  }, [runtimeCatalogExport.appendix]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2">
      {showComposerClassicChrome && showStyleLearningNotesPanel ? (
        <div className={`rounded-lg px-3 py-2 text-xs ${USE_CASE_PANEL_SHELL} space-y-1.5`}>
          <div className="flex items-start justify-between gap-2">
            <label
              htmlFor="ai-agent-use-case-style-learning-notes"
              className="block font-medium text-slate-400"
            >
              Note stile (apprendimento)
            </label>
            {!useCaseStyleLearningNotes.trim() ? (
              <button
                type="button"
                className="shrink-0 text-[11px] text-slate-500 underline hover:text-slate-300"
                onClick={() => setStyleLearningNotesEditorOpen(false)}
              >
                Chiudi
              </button>
            ) : null}
          </div>
          <p className="text-slate-500 leading-snug">
            {
              "Testo aggiunto al contratto stile del preset per tutte le chiamate IA sugli use case e per l'appendice del catalogo runtime."
            }
          </p>
          <textarea
            id="ai-agent-use-case-style-learning-notes"
            rows={3}
            spellCheck
            className="w-full min-h-[72px] resize-y rounded-md bg-slate-950/80 border border-slate-600 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="Esempio: evitare domande retoriche; usare «lei»; …"
            value={useCaseStyleLearningNotes}
            onChange={(e) => onUseCaseStyleLearningNotesChange(e.target.value)}
            onBlur={() => {
              if (!useCaseStyleLearningNotes.trim()) {
                setStyleLearningNotesEditorOpen(false);
              }
            }}
            disabled={busy}
            aria-label="Note stile use case"
          />
        </div>
      ) : showComposerClassicChrome ? (
        <div className="shrink-0 px-1">
          <button
            type="button"
            className="text-[11px] text-violet-300/95 underline hover:text-violet-200"
            onClick={() => setStyleLearningNotesEditorOpen(true)}
          >
            Aggiungi note di stile (opzionale)
          </button>
        </div>
      ) : null}
      {showComposerClassicChrome ? (
        <div className={`rounded-lg px-3 py-2 text-xs ${USE_CASE_PANEL_SHELL}`}>
          <div className="flex items-center gap-2">
            <label htmlFor="ai-agent-global-use-case-style" className="text-slate-300 whitespace-nowrap">
              Stile globale
            </label>
            <select
              id="ai-agent-global-use-case-style"
              value={useCaseGlobalStyleId}
              onChange={(e) => onUseCaseGlobalStyleIdChange(e.target.value)}
              disabled={busy}
              className="rounded-md bg-slate-900 border border-slate-600 px-2 py-1 text-xs text-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-60"
            >
              {AI_AGENT_GLOBAL_USE_CASE_STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </select>
            <span className="text-slate-500">Applicato a tutti i use case</span>
          </div>
        </div>
      ) : null}

      {ordered.length > 0 && showComposerClassicChrome ? (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs ${USE_CASE_PANEL_SHELL}`}
        >
          <span className="font-semibold text-slate-400 shrink-0">Runtime catalogo</span>
          <span className="text-slate-500">
            {runtimeCatalogExport.entryCount} scenari con JSON motore
            {runtimeCatalogExport.skippedCount > 0 ? (
              <span className="text-amber-400/95">
                {' '}
                · {runtimeCatalogExport.skippedCount} senza motor snapshot (esclusi)
              </span>
            ) : null}
          </span>
          <button
            type="button"
            title="Copia JSON catalogo (schema + esempi) negli appunti"
            onClick={copyRuntimeCatalogJson}
            disabled={busy || runtimeCatalogExport.entryCount === 0}
            className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800/90 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-750 disabled:opacity-40"
          >
            <FileJson size={12} aria-hidden />
            Copia JSON
          </button>
          <button
            type="button"
            title="Copia appendix prompt (use case vincolati + stile globale) negli appunti"
            onClick={copyRuntimeAppendix}
            disabled={busy || runtimeCatalogExport.entryCount === 0}
            className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800/90 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-750 disabled:opacity-40"
          >
            <Copy size={12} aria-hidden />
            Copia appendix prompt
          </button>
        </div>
      ) : null}

      {creationMessage && !suppressTopCreationMessage ? (
        <div className="rounded-lg border border-violet-800/70 bg-violet-950/40 px-3 py-2 text-sm text-violet-100 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin shrink-0" aria-hidden />
          <span>{creationMessage}</span>
        </div>
      ) : null}

      {isDesignerLlmMissingModelMessage(error) ? (
        <MissingDesignerLlmModelAlert
          onModelSelected={onDismissError}
          publishedSnapshot={dock?.reviewDesignerLlm}
        />
      ) : error ? (
        <div className="rounded-lg border border-red-800/80 bg-red-950/40 px-3 py-2 text-sm text-red-200 flex justify-between gap-2">
          <span className="min-w-0 break-words">{error}</span>
          <button
            type="button"
            onClick={onDismissError}
            className="shrink-0 text-red-300 hover:text-red-100 underline text-xs"
          >
            Chiudi
          </button>
        </div>
      ) : null}

      <div
        ref={useCaseDetailShellRef}
        className="relative flex flex-1 min-h-0 gap-2 flex-col sm:flex-row sm:items-stretch sm:min-h-[320px]"
      >
        <div
          className={`${
            'w-full'
          } flex min-h-0 min-w-0 flex-1 flex-col self-stretch overflow-hidden min-h-[240px] ${USE_CASE_PANEL_SHELL}`}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {!showUseCaseEmptyTutor ? (
                <UseCaseRootComposerHeader
                  rootDraftRef={rootDraftRef}
                  rootDraftLabel={rootDraftLabel}
                  onRootDraftChange={(v) => {
                    setRootBatchWarning(null);
                    setRootDraftLabel(v);
                  }}
                  onRootDraftBlur={() => {
                    setRootDraftLabel((prev) => normalizeRootUseCaseDraftDisplay(prev));
                  }}
                  onRootDraftPaste={(e) => {
                    const pasted = e.clipboardData.getData('text/plain');
                    if (!/[;,\r\n]/.test(pasted)) return;
                    e.preventDefault();
                    const ta = e.currentTarget;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const before = rootDraftLabel.slice(0, start);
                    const after = rootDraftLabel.slice(end);
                    setRootDraftLabel(normalizeRootUseCaseDraftDisplay(before + pasted + after));
                    setRootBatchWarning(null);
                  }}
                  onRootDraftKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleCreateRoot();
                    } else if (e.key === 'Escape') {
                      setRootDraftLabel('');
                      setRootBatchWarning(null);
                    }
                  }}
                  rootComposerLocked={rootComposerLocked}
                  placeholder={
                    isConversationalRulesCatalog
                      ? 'Una o più regole: una riga per titolo, oppure separa con ; o ,. INVIO crea tutte in sequenza.'
                      : 'Incolla o scrivi uno o più scenari (anche un paragrafo). INVIO: l’IA decide quanti use case creare.'
                  }
                  showAnalyzeChip={showRootAnalyzeChip}
                  rootChipBusy={rootChipBusy}
                  rootChipLabel={rootChipLabel}
                  onAnalyzeClick={() => void handleCreateRoot()}
                  rootBatchWarning={rootBatchWarning}
                  bundleGenerateBusy={bundleGenerateBusy}
                  bundleGenerationCount={useCaseBundleGenerationCount}
                  bundleGenerationOrdering={useCaseBundleGenerationOrdering}
                  bundleGenerationCategorizing={bundleGenerationCategorizing}
                  onGenerateUseCaseBundle={onGenerateUseCaseBundle}
                  generating={generating}
                  hasExistingUseCases={ordered.length > 0}
                />
              ) : null}
              {showUseCaseEmptyTutor ? (
                <UseCaseEmptyTutorPanel
                  rootDraftRef={rootDraftRef}
                  rootDraftLabel={rootDraftLabel}
                  onRootDraftChange={(v) => {
                    setRootBatchWarning(null);
                    setRootDraftLabel(v);
                  }}
                  onRootDraftBlur={() => {
                    setRootDraftLabel((prev) => normalizeRootUseCaseDraftDisplay(prev));
                  }}
                  onRootDraftPaste={(e) => {
                    const pasted = e.clipboardData.getData('text/plain');
                    if (!/[;,\r\n]/.test(pasted)) return;
                    e.preventDefault();
                    const ta = e.currentTarget;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const before = rootDraftLabel.slice(0, start);
                    const after = rootDraftLabel.slice(end);
                    setRootDraftLabel(normalizeRootUseCaseDraftDisplay(before + pasted + after));
                    setRootBatchWarning(null);
                  }}
                  onRootDraftKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleCreateRoot();
                    } else if (e.key === 'Escape') {
                      setRootDraftLabel('');
                      setRootBatchWarning(null);
                    }
                  }}
                  rootComposerLocked={rootComposerLocked}
                  showAnalyzeChip={showRootAnalyzeChip}
                  rootChipBusy={rootChipBusy}
                  rootChipLabel={rootChipLabel}
                  onAnalyzeClick={() => void handleCreateRoot()}
                  rootBatchWarning={rootBatchWarning}
                  generateContext={emptyTutorGenerateContext}
                  onGenerateFromScratch={onGenerateUseCaseBundle}
                  generating={generating}
                  bundleGenerateBusy={bundleGenerateBusy}
                  bundleGenerationCount={useCaseBundleGenerationCount}
                  bundleGenerationOrdering={useCaseBundleGenerationOrdering}
                  bundleGenerationCategorizing={bundleGenerationCategorizing}
                />
              ) : ordered.length === 0 ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-6">
                  <p className="max-w-md text-center text-sm text-slate-500">
                    Le regole predefinite (error handling) compaiono qui. Aggiungi nuove regole nella
                    text box sopra e premi INVIO.
                  </p>
                </div>
              ) : (
              <>
              {/*
                Contenitore scroll: block layout (non flex) perché in un flex-col i figli
                hanno flex-shrink:1 e si restringono invece di traboccare → scrollbar inattiva.
                Con block i <li> crescono liberamente e la scrollbar si attiva.
              */}
              <div className="min-h-0 flex-1 min-w-0 flex flex-col overflow-hidden">
              <UseCaseListDndShell
                reorderEnabled={useCaseDragEnabled}
                onReorder={commitUseCaseSiblingReorder}
              >
              <ul
                className={`p-1 pb-2 ${UC_USE_CASE_LIST_SCROLL}`}
              >
                {filteredOrdered.length === 0 && wizardSearchSeed ? (
                  /*
                    Nessun match: la lista esiste (`ordered.length > 0`) ma il filtro
                    della search box ha azzerato tutto. Mostriamo un placeholder esplicito
                    invece di un `<ul>` vuoto, così l'utente capisce che la lista non è
                    vuota davvero — basta cancellare il seed (X o Esc nella search box).
                  */
                  <li className="px-3 py-6 text-center text-xs text-slate-600 dark:text-slate-500">
                    Nessuno use case corrisponde a «
                    <span className="font-mono text-slate-700 dark:text-slate-300">{wizardSearchSeed}</span>
                    ». Pulisci la ricerca per vederli tutti.
                  </li>
                ) : null}
                {useCaseListRows.map((row, rowIndex) => {
                  if (row.kind === 'category') {
                    const expanded = !collapsedCategoryIds.has(row.category.id);
                    return (
                      <UseCaseCategoryHeader
                        key={`cat-${row.category.id}`}
                        category={row.category}
                        useCaseCount={row.count}
                        expanded={expanded}
                        disabled={busy}
                        onToggle={() => toggleCategoryExpanded(row.category.id)}
                        onLabelChange={(categoryId, label) =>
                          onUseCaseCategoryLabelChange?.(categoryId, label)
                        }
                        onDescriptionChange={(categoryId, description) =>
                          onUseCaseCategoryDescriptionChange?.(categoryId, description)
                        }
                      />
                    );
                  }
                  if (row.category && collapsedCategoryIds.has(row.category.id)) {
                    return null;
                  }
                  const u = row.useCase;
                  const listDisplayLabel = row.category
                    ? displayUseCaseLabelForCategory(u, row.category)
                    : u.label || u.id;
                  const rowBaseline = fieldBaselineByUseCaseId[u.id];
                  const active = u.id === effectiveSelectedId;
                  const editingTitle = editingTitleId === u.id;
                  const creatingChild = creatingChildParentId === u.id;
                  const descriptionTooltip = String(u.notes?.behavior || '').trim();
                  const rowAssistant = u.dialogue.find((t) => t.role === 'assistant');
                  const cardExpanded =
                    cardExpandedById[u.id] === true;
                  const showWizardBody =
                    cardExpanded && (wizardShowScenario || wizardShowMessage);
                  /**
                   * Esclusione conversazioni: attenuazione titolo solo su voto verde + checkbox off
                   * (vedi useCaseHeaderExcludedDimClass). Rosso/arancione restano in vista normale.
                   */
                  const includedInConv = isUseCaseIncludedInConversations(u);
                  const searchHighlight = highlightIdSet.has(u.id);
                  const reviewHighlight = useCaseHasDesignerReviewVote(u);
                  const stripeStable = u.id.split('').reduce((h, ch) => h + ch.charCodeAt(0), 0);
                  const zebraRow =
                    stripeStable % 2 === 0 ? UC_LIST_ZEBRA_WIZARD_EVEN : UC_LIST_ZEBRA_WIZARD_ODD;
                  const liSurface = searchHighlight
                    ? 'overflow-hidden rounded-md border border-amber-500/55 bg-amber-50/90 ring-2 ring-amber-300/50 dark:bg-amber-950/20 dark:ring-amber-400/40'
                    : reviewHighlight
                      ? `overflow-hidden rounded-md ${UC_ROW_REVIEW_EDGE}`
                      : cardExpanded
                        ? `overflow-hidden rounded-md border ${UC_WIZARD_ROW_EXPANDED}`
                        : `rounded-md ${zebraRow}`;
                  const nextRow = useCaseListRows[rowIndex + 1];
                  const nextInFiltered =
                    nextRow?.kind === 'use_case' ? nextRow.useCase : undefined;
                  const showSiblingGapSentinel =
                    nextInFiltered != null &&
                    (u.parent_id ?? null) === (nextInFiltered.parent_id ?? null);
                  const showTailSentinelAfterRow =
                    !nextInFiltered ||
                    (u.parent_id ?? null) !== (nextInFiltered.parent_id ?? null);
                  return (
                    <React.Fragment key={u.id}>
                    <li
                      data-uc-row-id={u.id}
                      className={`group/uc-row ${liSurface} ${
                        row.category ? 'ml-8 mr-1 border-l-2 border-violet-500/40 pl-2' : ''
                      }`}
                    >
                      <UseCaseRowDnDWrapper
                        useCaseId={u.id}
                        parentId={u.parent_id ?? null}
                        enabled={useCaseDragEnabled && !editingTitle}
                        onReorder={commitUseCaseSiblingReorder}
                      >
                      <UseCaseRowHeader
                        onDoubleClick={(e) => {
                          if (busy) return;
                          const el = e.target as HTMLElement;
                          if (el.closest('input')) return;
                          if (el.closest('[data-uc-chevron]')) return;
                          if (el.closest('[data-uc-head-toolbar]')) return;
                          e.preventDefault();
                          e.stopPropagation();
                          const wasCollapsed = !cardExpandedById[u.id];
                          toggleCardExpansion(u.id, 'dblclick');
                          listToolbarCtx?.notifyCardToggle();
                          if (wasCollapsed) {
                            scheduleScrollExpandedUseCaseCardIntoView(u.id);
                          }
                        }}
                        onClick={() => {
                          if (u.id !== effectiveSelectedId) setSelectedId(u.id);
                        }}
                        className={`group/uc-head flex cursor-pointer items-start gap-1 pl-1.5 pr-2 py-1.5 ${useCaseHeaderShellClass(active)}`}
                      >
                        {/*
                          Checkbox "incluso nelle conversazioni" (sempre presente, default
                          checked). Posizionato per primo a sinistra perch\u00e9 governa il
                          *destino* del use case (se partecipa o meno alla generazione delle
                          conversazioni e al JSON finale del system prompt). Lo stop-propagation
                          evita che il click sulla checkbox selezioni anche la riga.
                        */}
                        <div className="mt-[2px] flex shrink-0 items-center gap-0.5">
                          <input
                            type="checkbox"
                            checked={includedInConv}
                            disabled={busy}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              setUseCaseIncludedInConversations(u.id, e.target.checked);
                            }}
                            aria-label={
                              includedInConv
                                ? 'Escludi dalle conversazioni e dal prompt finale'
                                : 'Includi nelle conversazioni e nel prompt finale'
                            }
                            title={
                              includedInConv
                                ? 'Use case incluso nelle conversazioni e nel prompt finale. Click per escluderlo.'
                                : 'Use case escluso dalle conversazioni e dal prompt finale. Click per includerlo.'
                            }
                            className="h-3.5 w-3.5 cursor-pointer accent-violet-500"
                          />
                        </div>
                        <button
                          type="button"
                          data-uc-chevron
                          className="mt-[1px] shrink-0 rounded p-0.5 text-slate-700/80 hover:bg-black/10 hover:text-slate-900 dark:text-slate-200/90 dark:hover:bg-white/10"
                          title={cardExpanded ? 'Collassa' : 'Espandi'}
                          aria-expanded={cardExpanded}
                          onClick={(e) => {
                            e.stopPropagation();
                            const wasCollapsed = !cardExpandedById[u.id];
                            toggleCardExpansion(u.id, 'chevron');
                            listToolbarCtx?.notifyCardToggle();
                            if (wasCollapsed) {
                              scheduleScrollExpandedUseCaseCardIntoView(u.id);
                            }
                          }}
                        >
                          {cardExpanded ? (
                            <ChevronDown size={14} aria-hidden />
                          ) : (
                            <ChevronRight size={14} aria-hidden />
                          )}
                        </button>
                        {searchHighlight ? (
                          <span
                            className="mt-[2px] shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide bg-sky-500/25 text-sky-200 ring-1 ring-sky-400/40"
                            aria-label="Use case appena aggiunto"
                          >
                            New
                          </span>
                        ) : null}
                        <GitBranch size={12} className="mt-[4px] shrink-0 opacity-60 text-slate-400" aria-hidden />
                        {editingTitle ? (
                          <div
                            className="flex min-w-0 flex-1 items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={draftTitle}
                              onChange={(e) => setDraftTitle(e.target.value)}
                              className="min-w-0 flex-1 rounded border border-violet-600/50 bg-slate-950 px-2 py-0.5 text-xs text-slate-100"
                              autoFocus
                              disabled={busy}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  commitTitleEdit(u.id);
                                  return;
                                }
                                if (e.key === 'Escape') {
                                  e.stopPropagation();
                                  setDraftTitle(u.label);
                                  setEditingTitleId(null);
                                }
                              }}
                            />
                            <button
                              type="button"
                              title="Conferma"
                              disabled={busy}
                              className="shrink-0 rounded p-0.5 text-emerald-400 hover:bg-slate-800/90 hover:text-emerald-300 disabled:opacity-40"
                              onClick={(e) => {
                                e.stopPropagation();
                                commitTitleEdit(u.id);
                              }}
                            >
                              <Check size={14} aria-hidden />
                            </button>
                            <button
                              type="button"
                              title="Annulla"
                              disabled={busy}
                              className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-800/90 hover:text-slate-100 disabled:opacity-40"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDraftTitle(u.label);
                                setEditingTitleId(null);
                              }}
                            >
                              <X size={14} aria-hidden />
                            </button>
                          </div>
                        ) : (
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <button
                              type="button"
                              title={descriptionTooltip || undefined}
                              className={`min-w-0 max-w-full text-left text-sm leading-snug ${
                                wizardAccordionHeaderMode === 'message'
                                  ? `${useCaseHeaderTitleTextClass(
                                      u.designer_agent_message_vote,
                                      active,
                                      includedInConv
                                    )} ${UC_WIZARD_AGENT_MESSAGE_TEXT}`
                                  : useCaseHeaderTitleTextClass(
                                      u.designer_label_vote,
                                      active,
                                      includedInConv
                                    )
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (u.id !== effectiveSelectedId) setSelectedId(u.id);
                              }}
                            >
                              <span className="min-w-0 break-words whitespace-normal">
                                {wizardAccordionHeaderMode === 'message' ? (
                                  rowAssistant?.content?.trim() ? (
                                    wizardSearchSeed.trim() ? (
                                      <SeedHighlightedText
                                        text={rowAssistant.content}
                                        seed={wizardSearchSeed}
                                      />
                                    ) : (
                                      <BracketTokenHighlightedText
                                        text={rowAssistant.content}
                                        className="inline min-w-0 whitespace-pre-wrap align-baseline"
                                      />
                                    )
                                  ) : (
                                    <span className="text-slate-500">— messaggio vuoto</span>
                                  )
                                ) : (
                                  listDisplayLabel
                                )}
                              </span>
                            </button>
                            <UseCaseRowDeployChips
                              stats={
                                deployRowStatsByUseCaseId.get(u.id) ??
                                getUseCaseDeployRowStats(u, projectSlotLexicon)
                              }
                              onInspectCompiled={undefined}
                            />
                            {phraseStyleNewSet.has(u.id) ? (
                              <span
                                className="shrink-0 rounded bg-emerald-600/40 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-emerald-100"
                                title="Messaggio esempio aggiornato con il nuovo stile"
                              >
                                NEW
                              </span>
                            ) : null}
                            {/*
                              Toolbar unica (pollici, matita, [+ classico], globo con conferma, cestino):
                              visibile solo su hover/focus header; resta aperta durante menu «Generalizza» o
                              generalizzazione in corso (messaggio sotto il globo).
                            */}
                            <div
                              data-uc-head-toolbar
                              className={`mt-[1px] flex shrink-0 items-center gap-0.5 transition-opacity ${
                                generalizeMetaPendingUseCaseId === u.id ||
                                generalizeGlobeMenuOpenUseCaseId === u.id
                                  ? 'pointer-events-auto opacity-100'
                                  : 'pointer-events-none opacity-0 group-hover/uc-head:pointer-events-auto group-hover/uc-head:opacity-100 group-focus-within/uc-head:pointer-events-auto group-focus-within/uc-head:opacity-100'
                              }`}
                            >
                              <VoteThumbPair
                                vote={u.designer_label_vote}
                                disabled={busy}
                                outerBtnClass={UC_HEAD_VOTE_BTN}
                                onVote={(choice) => validateUseCaseFromHeader(u.id, choice)}
                              />
                              <button
                                type="button"
                                title="Modifica etichetta"
                                className="shrink-0 rounded p-0.5 text-slate-400 hover:text-violet-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDraftTitle(u.label);
                                  setEditingTitleId(u.id);
                                }}
                              >
                                <Pencil size={12} aria-hidden />
                              </button>
                              {onGeneralizeUseCaseMeta ? (
                                <span
                                  className="relative inline-flex shrink-0 flex-col items-center"
                                  {...{ 'data-uc-generalize-popover-root': u.id }}
                                >
                                  <button
                                    type="button"
                                    title="Generalizzazione titolo e scenario — apre il menu"
                                    aria-label="Menu generalizza use case"
                                    aria-expanded={generalizeGlobeMenuOpenUseCaseId === u.id}
                                    disabled={busy || generalizeMetaPendingUseCaseId === u.id}
                                    className="shrink-0 rounded p-0.5 text-slate-400 hover:text-violet-300 disabled:opacity-40"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (busy || generalizeMetaPendingUseCaseId === u.id) return;
                                      setGeneralizeGlobeMenuOpenUseCaseId((cur) =>
                                        cur === u.id ? null : u.id
                                      );
                                    }}
                                  >
                                    <Globe size={12} aria-hidden />
                                  </button>
                                  {generalizeGlobeMenuOpenUseCaseId === u.id &&
                                  generalizeMetaPendingUseCaseId !== u.id ? (
                                    <div
                                      className="absolute left-1/2 top-full z-[60] mt-0.5 min-w-[7.5rem] -translate-x-1/2 rounded-md border border-slate-600/70 bg-slate-950 px-1 py-1 shadow-lg shadow-black/50"
                                      role="menu"
                                    >
                                      <button
                                        type="button"
                                        role="menuitem"
                                        disabled={busy}
                                        className="w-full rounded px-2 py-1 text-left text-[10px] font-semibold text-violet-100 hover:bg-violet-900/50 disabled:opacity-40"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void confirmGeneralizeFromGlobeMenu(u.id);
                                        }}
                                      >
                                        {LABEL_GENERALIZE_USE_CASE_META_CONFIRM}
                                      </button>
                                    </div>
                                  ) : null}
                                  {generalizeMetaPendingUseCaseId === u.id ? (
                                    <div
                                      className="absolute left-1/2 top-full z-[60] mt-0.5 w-max max-w-[14rem] -translate-x-1/2 rounded-md border border-violet-700/45 bg-slate-950 px-2 py-1 text-center text-[10px] font-medium italic text-violet-200/95"
                                      aria-live="polite"
                                    >
                                      {LABEL_GENERALIZE_USE_CASE_META_PENDING}
                                    </div>
                                  ) : null}
                                </span>
                              ) : null}
                              <button
                                  type="button"
                                  title="Elimina questo scenario e i figli"
                                  aria-label="Elimina scenario"
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteUseCase(u.id);
                                  }}
                                  className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-800/90 hover:text-rose-300 disabled:opacity-40"
                                >
                                  <Trash2 size={14} aria-hidden />
                                </button>
                              <UseCaseRowDragHandle
                                aria-label={
                                  useCaseDragEnabled
                                    ? 'Riordina trascinando la riga (stesso livello gerarchico)'
                                    : 'Riordino non disponibile'
                                }
                                className={`inline-flex shrink-0 rounded p-0.5 ${
                                  useCaseDragEnabled
                                    ? 'cursor-grab text-slate-400 hover:bg-slate-800/90 hover:text-violet-300 active:cursor-grabbing'
                                    : 'cursor-not-allowed text-slate-600 opacity-50'
                                }`}
                                title={
                                  useCaseDragEnabled
                                    ? 'Riordina dalla maniglia (stesso livello)'
                                    : wizardSearchSeed
                                      ? 'Riordino disattivato durante la ricerca'
                                      : 'Riordino disattivato durante operazioni in corso'
                                }
                                onClick={(e) => e.stopPropagation()}
                              >
                                <GripVertical size={14} aria-hidden />
                              </UseCaseRowDragHandle>
                            </div>
                          </div>
                        )}
                      </UseCaseRowHeader>
                      {creatingChild ? (
                        <div className="border-t border-slate-700/45 px-2 py-2 bg-slate-950/40">
                          <input
                            type="text"
                            value={childDraftLabel}
                            autoFocus
                            disabled={busy}
                            placeholder="Nuovo figlio… (ENTER conferma, ESC annulla)"
                            className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-60"
                            onChange={(e) => setChildDraftLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleCreateChild(u.id);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setCreatingChildParentId(null);
                                setChildDraftLabel('');
                              }
                            }}
                          />
                        </div>
                      ) : null}
                      {showWizardBody ? (
                        <div
                          className={UC_WIZARD_CARD_BODY}
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.stopPropagation()}
                        >
                          {wizardShowScenario ? (
                            <div
                              className={`relative ${UC_WIZARD_SCENARIO_BLOCK}`}
                            >
                              {payoffEditUseCaseId === u.id ? (
                                <div className="flex flex-wrap items-start gap-2">
                                  {scenarioFieldLabel}
                                  <textarea
                                    ref={(el) => {
                                      if (el) payoffTextareaRefsById.current.set(u.id, el);
                                      else payoffTextareaRefsById.current.delete(u.id);
                                    }}
                                    value={payoffEditDraft}
                                    onChange={(e) => {
                                      setPayoffEditDraft(e.target.value);
                                      requestAnimationFrame(() => syncWizardTextareaHeights());
                                    }}
                                    disabled={busy}
                                    rows={2}
                                    autoFocus
                                    placeholder="Descrizione sintetica dello scenario…"
                                    className={`${UC_CLASSIC_TEXTAREA_SCENARIO} min-h-[52px]`}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') {
                                        e.preventDefault();
                                        cancelPayoffEdit();
                                      }
                                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                        e.preventDefault();
                                        commitPayoffEdit();
                                      }
                                    }}
                                  />
                                  <div className="flex shrink-0 items-center gap-0.5 self-start pt-0.5">
                                    {onPolishUseCaseScenario ? (
                                      <button
                                        type="button"
                                        title={
                                          polishScenarioPendingUseCaseId === u.id
                                            ? LABEL_POLISH_USE_CASE_SCENARIO_PENDING
                                            : TOOLTIP_POLISH_USE_CASE_SCENARIO
                                        }
                                        aria-label={LABEL_POLISH_USE_CASE_SCENARIO}
                                        disabled={
                                          busy ||
                                          polishScenarioPendingUseCaseId === u.id ||
                                          payoffEditDraft.trim().length < 8
                                        }
                                        className="rounded p-0.5 text-sky-300 hover:bg-slate-800/90 disabled:opacity-40"
                                        onClick={() => void invokePolishUseCaseScenario(u.id)}
                                      >
                                        {polishScenarioPendingUseCaseId === u.id ? (
                                          <Loader2
                                            size={14}
                                            className="animate-spin"
                                            aria-hidden
                                          />
                                        ) : (
                                          <Wand2 size={14} aria-hidden />
                                        )}
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      title="Conferma"
                                      disabled={busy}
                                      className="rounded p-0.5 text-emerald-400 hover:bg-slate-800/90 disabled:opacity-40"
                                      onClick={() => commitPayoffEdit()}
                                    >
                                      <Check size={14} aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      title="Annulla"
                                      disabled={busy}
                                      className="rounded p-0.5 text-slate-400 hover:bg-slate-800/90 disabled:opacity-40"
                                      onClick={() => cancelPayoffEdit()}
                                    >
                                      <X size={14} aria-hidden />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <UseCaseWizardScenarioDisplay
                                  useCase={u}
                                  busy={busy}
                                  scenarioFieldLabel={scenarioFieldLabel}
                                  textClassName=""
                                  onDoubleClickEdit={() =>
                                    beginPayoffEdit(u.id, getScenarioText(u))
                                  }
                                  onVote={(choice) =>
                                    toggleDesignerFieldVote(u.id, 'payoff', choice)
                                  }
                                  onEditClick={() =>
                                    beginPayoffEdit(u.id, getScenarioText(u))
                                  }
                                  onPolishClick={
                                    onPolishUseCaseScenario
                                      ? () => void invokePolishUseCaseScenario(u.id)
                                      : undefined
                                  }
                                  polishPending={polishScenarioPendingUseCaseId === u.id}
                                  polishDisabled={
                                    resolveScenarioTextForPolish(u.id).length < 8
                                  }
                                />
                              )}
                            </div>
                          ) : null}
                          {wizardShowMessage ? (
                            <div className={UC_WIZARD_AGENT_MESSAGE_PANEL}>
                              {rowAssistant ? (
                                <UseCaseResponseEditor
                                  useCase={u}
                                  onPatchResponseTasks={patchUseCaseResponseTasks}
                                  onPatchUseCase={(updater) =>
                                    setUseCases((prev) =>
                                      prev.map((x) => (x.id === u.id ? updater(x) : x))
                                    )
                                  }
                                  onSeedUseCase={seedUseCaseResponse}
                                  onAgentMessageVote={(choice) =>
                                    toggleDesignerFieldVote(u.id, 'agentMessage', choice)
                                  }
                                  onMessageCommitted={() => {
                                    clearNewHighlightOnDesignerAction(u.id);
                                    commitCardExpansion(u.id, false, 'programmatic');
                                    listToolbarCtx?.notifyCardToggle();
                                  }}
                                  onAssistantPhraseDraftChange={onAssistantPhraseDraftChange}
                                  parametricCartesianFeedback={
                                    parametricCartesianErrorById[u.id] ?? null
                                  }
                                  busy={busy}
                                  searchSeed={wizardSearchSeed}
                                  showTokenizedAgentMessage={showTokenizedAgentMessage}
                                  tokenizedByUseCaseId={tokenizedByUseCaseId}
                                />
                              ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-xs text-slate-500">
                                    Nessun turno assistente. Aggiungi un messaggio vuoto per iniziare.
                                  </p>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => ensureAssistantTurnFor(u.id)}
                                    className="text-xs text-emerald-300 underline disabled:opacity-50"
                                  >
                                    Aggiungi messaggio agente (vuoto)
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      </UseCaseRowDnDWrapper>
                    </li>
                    {showSiblingGapSentinel && nextInFiltered ? (
                      <li className="list-none p-0" aria-hidden>
                        <UseCaseDropSentinel
                          mode="insertBeforeNext"
                          insertBeforeId={nextInFiltered.id}
                          parentId={nextInFiltered.parent_id ?? null}
                          enabled={useCaseDragEnabled}
                          onReorder={commitUseCaseSiblingReorder}
                        />
                      </li>
                    ) : null}
                    {showTailSentinelAfterRow ? (
                      <li className="list-none p-0" aria-hidden>
                        <UseCaseDropSentinel
                          mode="insertAfterAnchor"
                          insertAfterId={u.id}
                          parentId={u.parent_id ?? null}
                          enabled={useCaseDragEnabled}
                          onReorder={commitUseCaseSiblingReorder}
                        />
                      </li>
                    ) : null}
                    </React.Fragment>
                  );
                })}
              </ul>
              </UseCaseListDndShell>
              </div>
              </>
              )}
          </div>
        </div>

      </div>
    </div>
  );
}
