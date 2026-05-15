/**
 * Use Case Composer: tree of scenarios, metadata fields, dialogue via chat preview bridge.
 */

import React from 'react';
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
  X,
} from 'lucide-react';
import {
  newAgentUseCaseTurnId,
  isUseCaseIncludedInConversations,
  type AIAgentLogicalStep,
  type AIAgentUseCase,
} from '@types/aiAgentUseCases';
import {
  AI_AGENT_DEFAULT_PREVIEW_STYLE_ID,
} from '@types/aiAgentPreview';
import { orderUseCasesWithDepth } from './useCaseTreeOrder';
import { applySiblingReorderForPersist } from './useCaseHierarchy';
import {
  AI_AGENT_GLOBAL_USE_CASE_STYLES,
  LABEL_AGENT_MSG_STRIP_TOKENS,
  LABEL_AGENT_MSG_WRAP_TOKEN,
  LABEL_GENERATE_USE_CASES,
  LABEL_GENERALIZE_USE_CASE_META_CONFIRM,
  LABEL_GENERALIZE_USE_CASE_META_PENDING,
  LABEL_REGENERATE_AGENT_EXAMPLE,
  LABEL_REGENERATE_USE_CASE_FOR_SCENARIO,
} from './constants';
import {
  normalizeRootUseCaseDraftDisplay,
  parseRootUseCaseDraftSegments,
  ROOT_USE_CASE_BATCH_MAX,
} from './parseRootUseCaseDraft';
import { logUseCaseRootBatch } from './useCaseRootBatchDebug';
import {
  computeAgentTokenSelectionPopoverAction,
  messageHasSlotBrackets,
  stripAgentMessageSlotBrackets,
  unwrapBracketTokenContainingSelection,
  buildBracketWrapForSelection,
} from './agentMessageTokenHelpers';
import { AgentMessageSelectionTokenPopover } from './AgentMessageSelectionTokenPopover';
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
  UC_WIZARD_SCENARIO_BLOCK,
  fieldTextClass,
  useCaseHeaderBgClass,
} from './useCaseComposerPresentation';
import {
  applyDesignerFieldVoteToggle,
  applyUseCaseHeaderVoteToggle,
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
import { mergeUseCaseGlobalStyleContract } from './mergeUseCaseGlobalStyleContract';
import {
  UseCaseDropSentinel,
  UseCaseListDndShell,
  UseCaseRowDnDWrapper,
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
  }) => Promise<string>;
  onRegenerateUseCase: (useCaseId: string) => void | Promise<void | AIAgentUseCase | null>;
  /** Generalizza titolo e scenario (payoff) via LLM; assente = nessun pulsante. */
  onGeneralizeUseCaseMeta?: (useCaseId: string) => void | Promise<void | AIAgentUseCase | null>;
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
  /**
   * Generazione lista nel view wizard: nessun pulsante «Genera use case» nel pannello sinistro;
   * messaggio empty state punta al Tutorial destro.
   */
  primaryGenerateOnRightOnly?: boolean;
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
   * Selezione richiesta dall'esterno (es. frecce ◀ ▶ del pannello DX «Mostra JSON»).
   * Quando cambia ed è un id valido nel catalogo corrente, l'internal state del composer si
   * adegua. Pattern «request-based»: serve solo quando il consumer vuole forzare un cambio
   * di selezione; per la selezione default basta `onSelectionChange`. Idempotente.
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
  onRegenerateUseCase,
  onGeneralizeUseCaseMeta,
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
  primaryGenerateOnRightOnly = false,
  highlightIds = [],
  onClearUseCaseHighlight,
  assistantPhraseStyleNewIds = [],
  onAssistantPhraseDraftChange,
  onCompleteCorrection,
  onSelectionChange,
  controlledSelectionId,
  showTokenizedAgentMessage = false,
  tokenizedByUseCaseId,
}: AIAgentUseCaseComposerProps) {
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
  const listToolbarCtx = useUseCaseWizardListToolbarOptional();
  const dock = useOptionalAIAgentEditorDock();
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
   * (`primaryGenerateOnRightOnly`) usiamo **icone-only** colorate con il **colore del font**
   * usato in `UC_PILL_SCENARIO` (violetto) e `UC_PILL_AGENT_MSG` (emerald), così le righe
   * dello use case respirano e l'identità del campo resta riconoscibile a colpo d'occhio.
   * In modalità classica restano le pill testuali (più spazio orizzontale disponibile).
   */
  const scenarioFieldLabel: React.ReactNode = primaryGenerateOnRightOnly ? (
    <span
      title="Scenario"
      aria-label="Scenario"
      className="shrink-0 inline-flex h-5 w-5 items-center justify-center text-violet-300"
    >
      <BookOpen size={13} aria-hidden />
    </span>
  ) : (
    <span className={UC_PILL_SCENARIO}>Scenario</span>
  );
  const agentMsgFieldLabel: React.ReactNode = primaryGenerateOnRightOnly ? (
    <span
      title="Messaggio agente"
      aria-label="Messaggio agente"
      className="shrink-0 inline-flex h-5 w-5 items-center justify-center text-emerald-300"
    >
      <MessageSquareText size={13} aria-hidden />
    </span>
  ) : (
    <span className={UC_PILL_AGENT_MSG}>Messaggio agente</span>
  );
  const wizardShowScenario =
    primaryGenerateOnRightOnly && listToolbarCtx ? listToolbarCtx.showScenario : true;
  const wizardShowMessage =
    primaryGenerateOnRightOnly && listToolbarCtx ? listToolbarCtx.showMessage : true;
  /**
   * Seed di ricerca dalla toolbar wizard. Gli highlight col chip giallo sui messaggi
   * agente sono attivi solo nella vista wizard (`primaryGenerateOnRightOnly`) — è
   * lì che vive la search box, e fuori dalla wizard non ha senso evidenziare nulla.
   */
  const wizardSearchSeed =
    primaryGenerateOnRightOnly && listToolbarCtx ? listToolbarCtx.searchSeed : '';

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

  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
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
  }, [editorTaskInstanceId, useCases]);

  /**
   * Sincronizza la selezione interna quando il consumer richiede esplicitamente di selezionare
   * un altro use case (es. frecce ◀ ▶ del pannello DX «Mostra JSON»). No-op se l'id richiesto
   * coincide con quello già selezionato, così non innesca rerender inutili.
   */
  React.useEffect(() => {
    if (!controlledSelectionId) return;
    if (controlledSelectionId === selectedId) return;
    if (!useCases.some((u) => u.id === controlledSelectionId)) return;
    setSelectedId(controlledSelectionId);
  }, [controlledSelectionId, selectedId, useCases]);

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
  const [rootDraftLabel, setRootDraftLabel] = React.useState('');
  const [creatingChildParentId, setCreatingChildParentId] = React.useState<string | null>(null);
  const [childDraftLabel, setChildDraftLabel] = React.useState('');
  /** Valori triplet (etichetta, scenario, messaggio) all’ingresso in lista o dopo rigenera IA. */
  const [fieldBaselineByUseCaseId, setFieldBaselineByUseCaseId] = React.useState<
    Record<string, AiTripletFieldBaseline>
  >({});
  /** Wizard only: corpo card espanso per id (default true quando compare un nuovo use case). */
  const [cardExpandedById, setCardExpandedById] = React.useState<Record<string, boolean>>({});
  const [rootBatchWarning, setRootBatchWarning] = React.useState<string | null>(null);
  const rootDraftRef = React.useRef<HTMLTextAreaElement>(null);
  /** Selection range in assistant message textarea (for Token wrap UX). */
  const [agentMsgSelection, setAgentMsgSelection] = React.useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  /** Viewport anchor (caret fine selezione) per toolbar Tokenizza `position: fixed`. */
  const [agentMsgTokenAnchor, setAgentMsgTokenAnchor] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
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

  React.useEffect(() => {
    setEditingTitleId(null);
  }, [effectiveSelectedId]);

  /**
   * Lift-up della selezione lista verso il parent (es. wizard right-panel «Mostra JSON»).
   * Notifichiamo SOLO quando l'id effettivo cambia: usare `effectiveSelectedId` (che è
   * `selectedId` reso stabile rispetto al primo elemento ordinato) evita di emettere un
   * `null` transitorio durante l'effetto di pre-popolamento. Idempotente — il consumer
   * deve gestire chiamate ripetute con lo stesso id (no-op tipico).
   */
  React.useEffect(() => {
    onSelectionChange?.(effectiveSelectedId);
  }, [effectiveSelectedId, onSelectionChange]);

  React.useEffect(() => {
    if (!primaryGenerateOnRightOnly) {
      setPayoffEditUseCaseId(null);
      setAgentMsgEditUseCaseId(null);
    }
  }, [effectiveSelectedId, primaryGenerateOnRightOnly]);

  useUseCaseFieldBaselineSync(ordered, useCases, setFieldBaselineByUseCaseId);

  /**
   * Pubblica al `UseCaseWizardListToolbarContext` quante correzioni sostanziali
   * (≥ 3 parole cambiate per campo, vedi `useCaseSubstantialEdits.ts`) sono pendenti
   * rispetto all'ultima baseline IA. Include **bozze** aperte nelle textarea (scenario /
   * messaggio agente): finché l'utente non preme ✓ il `useCases` resta al valore
   * committato e il conteggio sarebbe zero — il callout DX non comparirebbe mai durante
   * l'edit. Solo nella vista wizard (`primaryGenerateOnRightOnly`): fuori wizard no-op.
   */
  React.useEffect(() => {
    if (!primaryGenerateOnRightOnly || !listToolbarCtx) return;
    const items = ordered.map((u) => {
      const ast = u.dialogue.find((t) => t.role === 'assistant');
      const committedAgent = ast?.content ?? '';
      const agentMessage =
        agentMsgEditUseCaseId === u.id ? agentMsgEditDraft : committedAgent;
      const scenario =
        payoffEditUseCaseId === u.id ? payoffEditDraft : (u.payoff ?? '');
      return {
        id: u.id,
        current: { scenario, agentMessage },
        baseline: fieldBaselineByUseCaseId[u.id],
      };
    });
    listToolbarCtx.setPendingCorrectionsCount(countSubstantialEditsAcrossUseCases(items));
  }, [
    primaryGenerateOnRightOnly,
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
    if (!primaryGenerateOnRightOnly || !listToolbarCtx) return;
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
    primaryGenerateOnRightOnly,
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
    if (!primaryGenerateOnRightOnly || !setCorrectionPreviewState) return;

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
    primaryGenerateOnRightOnly,
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
     * (default = espanso) e rimuove orfane. **Idempotente**: se non ci sono variazioni
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
        next[u.id] = u.id in prev ? prev[u.id] : true;
      }
      return next;
    });
  }, [ordered]);

  const expandAllWizardCards = React.useCallback(() => {
    setCardExpandedById((prev) => {
      const next = { ...prev };
      for (const u of ordered) next[u.id] = true;
      return next;
    });
  }, [ordered]);

  const collapseAllWizardCards = React.useCallback(() => {
    setCardExpandedById((prev) => {
      const next = { ...prev };
      for (const u of ordered) next[u.id] = false;
      return next;
    });
  }, [ordered]);

  React.useEffect(() => {
    if (!primaryGenerateOnRightOnly || !listToolbarCtx) return;
    listToolbarCtx.registerHandlers({
      expandAll: expandAllWizardCards,
      collapseAll: collapseAllWizardCards,
    });
    return () => listToolbarCtx.registerHandlers(null);
  }, [
    primaryGenerateOnRightOnly,
    listToolbarCtx,
    expandAllWizardCards,
    collapseAllWizardCards,
  ]);

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
      onClearUseCaseHighlight?.(useCaseId);
      setEditingTitleId(null);
    },
    [draftTitle, setUseCases, onClearUseCaseHighlight]
  );

  const createUseCase = React.useCallback(
    async (params: {
      label: string;
      parentId: string | null;
      creationScope?: 'single' | 'batch';
    }) => {
      const label = String(params.label || '').trim();
      if (!label) {
        logUseCaseRootBatch('createUseCase_skip_empty_label', { parentId: params.parentId });
        return;
      }
      logUseCaseRootBatch('createUseCase_call', {
        labelPreview: label.slice(0, 120),
        labelLen: label.length,
        parentId: params.parentId,
        creationScope: params.creationScope ?? 'single',
      });
      const createdId = await onCreateUseCase({
        label,
        parentId: params.parentId,
        creationScope: params.creationScope,
      });
      logUseCaseRootBatch('createUseCase_done', { createdId });
      setSelectedId(createdId);
    },
    [onCreateUseCase]
  );

  const handleCreateRoot = React.useCallback(async () => {
    logUseCaseRootBatch('handleCreateRoot_start', {
      busy,
      rawLen: rootDraftLabel.length,
      rawPreview: rootDraftLabel.slice(0, 200),
    });
    if (busy) {
      logUseCaseRootBatch('handleCreateRoot_abort_busy');
      return;
    }
    const parts = parseRootUseCaseDraftSegments(rootDraftLabel);
    logUseCaseRootBatch('handleCreateRoot_parsed', { segmentCount: parts.length, partsPreview: parts.map((p) => p.slice(0, 80)) });
    if (parts.length === 0) {
      logUseCaseRootBatch('handleCreateRoot_abort_no_segments');
      return;
    }
    if (parts.length > ROOT_USE_CASE_BATCH_MAX) {
      setRootBatchWarning(`Massimo ${ROOT_USE_CASE_BATCH_MAX} use case per invio. Riduci il batch.`);
      logUseCaseRootBatch('handleCreateRoot_abort_over_cap', { cap: ROOT_USE_CASE_BATCH_MAX });
      return;
    }
    setRootBatchWarning(null);
    const batchScope = parts.length > 1 ? 'batch' : 'single';
    try {
      for (let i = 0; i < parts.length; i++) {
        const label = parts[i];
        logUseCaseRootBatch('batch_segment_start', { index: i, total: parts.length });
        await createUseCase({ label, parentId: null, creationScope: batchScope });
        logUseCaseRootBatch('batch_segment_ok', { index: i, total: parts.length });
      }
      logUseCaseRootBatch('handleCreateRoot_batch_complete');
    } catch (e) {
      logUseCaseRootBatch('handleCreateRoot_batch_error', {
        message: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
    setRootDraftLabel('');
    logUseCaseRootBatch('handleCreateRoot_cleared_textarea');
  }, [busy, rootDraftLabel, createUseCase]);

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
              ? {
                  ...u,
                  dialogue: u.dialogue.map((turn) =>
                    turn.turn_id === turnId ? { ...turn, content, userEdited: true } : turn
                  ),
                }
              : u
          )
        );
        return;
      }
      setUseCases((prev) =>
        prev.map((u) =>
          u.id === useCaseId
            ? {
                ...u,
                designer_edit_confirmed: true as const,
                designer_agent_message_vote: 'up' as const,
                designer_label_vote: 'up' as const,
                included_in_conversations: true,
                dialogue: u.dialogue.map((turn) =>
                  turn.turn_id === turnId ? { ...turn, content, userEdited: true } : turn
                ),
              }
            : u
        )
      );
      onClearUseCaseHighlight?.(useCaseId);
      if (primaryGenerateOnRightOnly) {
        setCardExpandedById((prev) => ({ ...prev, [useCaseId]: false }));
        listToolbarCtx?.notifyCardToggle();
      }
    },
    [setUseCases, onClearUseCaseHighlight, primaryGenerateOnRightOnly, listToolbarCtx]
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
    if (!primaryGenerateOnRightOnly) {
      return agentTextareaRef.current;
    }
    return agentTextareaRefsById.current.get(agentMsgEditUseCaseId) ?? null;
  }, [agentMsgEditUseCaseId, primaryGenerateOnRightOnly]);
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
                ...u,
                payoff: value,
                designer_edit_confirmed: true as const,
                designer_payoff_vote: 'up' as const,
              }
            : u
        )
      );
      onClearUseCaseHighlight?.(useCaseId);
    },
    [setUseCases, onClearUseCaseHighlight]
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
   *  - resta invece SEMPRE visibile in lista (con dim + badge "Escluso") e continua ad essere
   *    passato come `existingUseCases` a tutti i contesti dove l'IA propone nuovi use case
   *    (no duplicati).
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
    (useCaseId: string, field: DesignerVoteField, choice: 'up' | 'down') => {
      setUseCases((prev) => applyDesignerFieldVoteToggle(prev, useCaseId, field, choice));
      onClearUseCaseHighlight?.(useCaseId);
    },
    [setUseCases, onClearUseCaseHighlight]
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
    (useCaseId: string, choice: 'up' | 'down') => {
      setUseCases((prev) => applyUseCaseHeaderVoteToggle(prev, useCaseId, choice));
      onClearUseCaseHighlight?.(useCaseId);
      if (primaryGenerateOnRightOnly) {
        setCardExpandedById((prev) => ({ ...prev, [useCaseId]: false }));
        listToolbarCtx?.notifyCardToggle();
      }
    },
    [setUseCases, onClearUseCaseHighlight, primaryGenerateOnRightOnly, listToolbarCtx]
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
    return (selected.payoff ?? '') !== b.payoff;
  }, [selected, selected?.payoff, fieldBaselineByUseCaseId]);

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
    const topBelowCaret = pt.top + lineHeightPx + 6;
    setAgentMsgTokenAnchor((prev) => {
      if (prev && prev.top === topBelowCaret && prev.left === pt.left) return prev;
      return { top: topBelowCaret, left: pt.left };
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

  const canWrapAgentToken = React.useMemo(() => {
    if (busy || !agentMsgEditUseCaseId || agentMsgPointerSelecting) return false;
    const { start, end } = agentMsgSelection;
    if (start === end) return false;
    return agentMsgTokenPopoverAction === 'tokenize';
  }, [busy, agentMsgEditUseCaseId, agentMsgPointerSelecting, agentMsgSelection, agentMsgTokenPopoverAction]);

  const canStripAgentTokens = React.useMemo(
    () => Boolean(agentMsgEditUseCaseId && !busy && messageHasSlotBrackets(agentMsgEditDraft)),
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
    const { next, selStart, selEnd } = result;
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

  const handleStripAgentTokens = React.useCallback(() => {
    if (!agentMsgEditUseCaseId || busy) return;
    const turnId = agentMsgEditTurnIdRef.current;
    if (!turnId) return;
    const content = agentMsgEditDraft;
    if (!messageHasSlotBrackets(content)) return;
    const next = stripAgentMessageSlotBrackets(content);
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
    if (!primaryGenerateOnRightOnly) return;
    syncWizardTextareaHeights();
  }, [
    primaryGenerateOnRightOnly,
    syncWizardTextareaHeights,
    useCases,
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
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {!primaryGenerateOnRightOnly && showStyleLearningNotesPanel ? (
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
      ) : !primaryGenerateOnRightOnly ? (
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
      {!primaryGenerateOnRightOnly ? (
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

      {ordered.length > 0 && !primaryGenerateOnRightOnly ? (
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

      {creationMessage ? (
        <div className="rounded-lg border border-violet-800/70 bg-violet-950/40 px-3 py-2 text-sm text-violet-100 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin shrink-0" aria-hidden />
          <span>{creationMessage}</span>
        </div>
      ) : null}

      {error ? (
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
            ordered.length === 0 || primaryGenerateOnRightOnly
              ? 'w-full'
              : 'w-full sm:w-[44%]'
          } flex min-h-0 min-w-0 flex-1 flex-col self-stretch overflow-hidden min-h-[240px] ${USE_CASE_PANEL_SHELL}`}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-slate-700/50 px-2 pt-2 pb-1 space-y-1">
                <textarea
                  ref={rootDraftRef}
                  rows={1}
                  value={rootDraftLabel}
                  onChange={(e) => {
                    setRootBatchWarning(null);
                    setRootDraftLabel(e.target.value);
                  }}
                  onBlur={() => {
                    setRootDraftLabel((prev) => normalizeRootUseCaseDraftDisplay(prev));
                  }}
                  onPaste={(e) => {
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
                  disabled={busy}
                  placeholder="Uno o più use case: una riga per scenario, oppure separa con ; o ,. INVIO crea tutti in sequenza."
                  className="w-full resize-none overflow-hidden rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-60 min-h-[36px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleCreateRoot();
                    } else if (e.key === 'Escape') {
                      setRootDraftLabel('');
                      setRootBatchWarning(null);
                    }
                  }}
                />
                {rootBatchWarning ? (
                  <p className="text-[11px] text-amber-300/95">{rootBatchWarning}</p>
                ) : null}
              </div>
              {ordered.length === 0 ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center">
                  <p className="text-sm text-slate-500 max-w-md">
                    {onGenerateUseCaseBundle
                      ? 'Nessuno scenario ancora. Puoi generarli con IA usando il pulsante qui sotto.'
                      : primaryGenerateOnRightOnly
                        ? (
                          <>
                            Nessuno use case ancora.
                            <br />
                            <br />
                            1) Se hai gia un insieme di usecase definiti incollali nella text box sopra e premi enter
                            <br />
                            2) altrimenti clicca sul pulsante in basso nel pannello di destra "genera use case"
                          </>
                        )
                        : 'Nessuno scenario. Genera con IA o crea il design agent prima.'}
                  </p>
                  {onGenerateUseCaseBundle ? (
                    <button
                      type="button"
                      disabled={busy || generating}
                      onClick={() => void onGenerateUseCaseBundle()}
                      className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
                    >
                      {busy ? (
                        <Loader2 className="animate-spin" size={16} aria-hidden />
                      ) : (
                        <Sparkles size={16} aria-hidden />
                      )}
                      {busy ? 'Generazione scenari…' : LABEL_GENERATE_USE_CASES}
                    </button>
                  ) : null}
                </div>
              ) : (
              <>
              {/*
                Contenitore scroll: block layout (non flex) perché in un flex-col i figli
                hanno flex-shrink:1 e si restringono invece di traboccare → scrollbar inattiva.
                Con block i <li> crescono liberamente e la scrollbar si attiva.
              */}
              <UseCaseListDndShell
                reorderEnabled={useCaseDragEnabled}
                onReorder={commitUseCaseSiblingReorder}
              >
              <ul
                className={`min-h-0 flex-1 overflow-x-hidden p-1 pb-2 ${UC_USE_CASE_LIST_SCROLL}`}
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
                {filteredOrdered.map((u, rowIndex) => {
                  const rowBaseline = fieldBaselineByUseCaseId[u.id];
                  const active = u.id === effectiveSelectedId;
                  const editingTitle = editingTitleId === u.id;
                  const creatingChild = creatingChildParentId === u.id;
                  const descriptionTooltip = String(u.notes?.behavior || '').trim();
                  const rowAssistant = u.dialogue.find((t) => t.role === 'assistant');
                  const cardExpanded =
                    !primaryGenerateOnRightOnly || cardExpandedById[u.id] !== false;
                  const showWizardBody =
                    primaryGenerateOnRightOnly &&
                    cardExpanded &&
                    (wizardShowScenario || wizardShowMessage);
                  /**
                   * Quando il use case \u00e8 escluso dalle conversazioni: dim sull'intera card
                   * (opacity-50) per segnalare visivamente lo stato. La card resta interattiva
                   * (puoi rimettere la spunta) e l'header non viene compresso \u2014 \u00e8 ben
                   * differenziato da disabled (cursor-not-allowed) o hidden (display:none).
                   */
                  const includedInConv = isUseCaseIncludedInConversations(u);
                  const dimWhenExcludedClass = includedInConv ? '' : ' opacity-50';
                  const searchHighlight = highlightIdSet.has(u.id);
                  const zebraRow = primaryGenerateOnRightOnly
                    ? rowIndex % 2 === 0
                      ? UC_LIST_ZEBRA_WIZARD_EVEN
                      : UC_LIST_ZEBRA_WIZARD_ODD
                    : rowIndex % 2 === 0
                      ? UC_LIST_ZEBRA_CLASSIC_EVEN
                      : UC_LIST_ZEBRA_CLASSIC_ODD;
                  const liSurface = searchHighlight
                    ? 'overflow-hidden rounded-md border border-amber-500/55 bg-amber-50/90 ring-2 ring-amber-300/50 dark:bg-amber-950/20 dark:ring-amber-400/40'
                    : `rounded-md ${zebraRow}`;
                  const nextInFiltered = filteredOrdered[rowIndex + 1];
                  const showSiblingGapSentinel =
                    nextInFiltered != null &&
                    (u.parent_id ?? null) === (nextInFiltered.parent_id ?? null);
                  const showTailSentinelAfterRow =
                    !nextInFiltered ||
                    (u.parent_id ?? null) !== (nextInFiltered.parent_id ?? null);
                  return (
                    <React.Fragment key={u.id}>
                    <li data-uc-row-id={u.id} className={`group/uc-row ${liSurface}${dimWhenExcludedClass}`}>
                      <UseCaseRowDnDWrapper
                        useCaseId={u.id}
                        parentId={u.parent_id ?? null}
                        enabled={useCaseDragEnabled && !editingTitle}
                        onReorder={commitUseCaseSiblingReorder}
                      >
                      <UseCaseRowHeader
                        onDoubleClick={(e) => {
                          if (!primaryGenerateOnRightOnly || busy) return;
                          const el = e.target as HTMLElement;
                          if (el.closest('input')) return;
                          if (el.closest('[data-uc-chevron]')) return;
                          if (el.closest('[data-uc-head-toolbar]')) return;
                          e.preventDefault();
                          e.stopPropagation();
                          setCardExpandedById((prev) => {
                            const isOpen = prev[u.id] !== false;
                            return { ...prev, [u.id]: !isOpen };
                          });
                          listToolbarCtx?.notifyCardToggle();
                        }}
                        onClick={() => {
                          if (u.id !== effectiveSelectedId) setSelectedId(u.id);
                        }}
                        className={`group/uc-head flex cursor-pointer items-start gap-1 pl-1.5 pr-2 py-1 ${useCaseHeaderBgClass(
                          u.designer_label_vote,
                          active
                        )}`}
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
                        {primaryGenerateOnRightOnly ? (
                          <button
                            type="button"
                            data-uc-chevron
                            className="mt-[1px] shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-800/90 hover:text-slate-100"
                            title={cardExpanded ? 'Collassa' : 'Espandi'}
                            aria-expanded={cardExpanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardExpandedById((prev) => {
                                const isOpen = prev[u.id] !== false;
                                return { ...prev, [u.id]: !isOpen };
                              });
                              listToolbarCtx?.notifyCardToggle();
                            }}
                          >
                            {cardExpanded ? (
                              <ChevronDown size={14} aria-hidden />
                            ) : (
                              <ChevronRight size={14} aria-hidden />
                            )}
                          </button>
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
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-0.5">
                            <button
                              type="button"
                              title={descriptionTooltip || undefined}
                              className={`min-w-0 max-w-full text-left text-sm leading-snug ${fieldTextClass(
                                u.designer_label_vote,
                                u.label ?? '',
                                fieldBaselineByUseCaseId[u.id]?.label
                              )} ${active ? 'font-semibold' : ''} inline-flex flex-wrap items-center gap-x-1 gap-y-0.5`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (u.id !== effectiveSelectedId) setSelectedId(u.id);
                              }}
                            >
                              <span className="min-w-0 break-words whitespace-normal">{u.label || u.id}</span>
                              {!includedInConv ? (
                                <span
                                  className="ml-1 shrink-0 rounded bg-slate-700/70 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-slate-300"
                                  title="Questo use case non viene usato nelle conversazioni n\u00e9 nel prompt conversazionale finale (resta in lista per non essere ri-proposto come nuovo dall'IA)"
                                >
                                  Escluso
                                </span>
                              ) : null}
                              {primaryGenerateOnRightOnly && phraseStyleNewSet.has(u.id) ? (
                                <span
                                  className="ml-1 shrink-0 rounded bg-emerald-600/40 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-emerald-100"
                                  title="Messaggio esempio aggiornato con il nuovo stile"
                                >
                                  NEW
                                </span>
                              ) : null}
                            </button>
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
                              {!primaryGenerateOnRightOnly ? (
                                <button
                                  type="button"
                                  title="Aggiungi figlio"
                                  className="shrink-0 rounded p-0.5 text-slate-400 hover:text-violet-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedId(u.id);
                                    setCreatingChildParentId(u.id);
                                    setChildDraftLabel('');
                                  }}
                                >
                                  <Plus size={12} aria-hidden />
                                </button>
                              ) : null}
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
                              <span
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
                                    ? 'Riordina trascinando la riga (stesso livello)'
                                    : wizardSearchSeed
                                      ? 'Riordino disattivato durante la ricerca'
                                      : 'Riordino disattivato durante operazioni in corso'
                                }
                              >
                                <GripVertical size={14} aria-hidden />
                              </span>
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
                        >
                          {wizardShowScenario ? (
                            <div className={`relative ${UC_WIZARD_SCENARIO_BLOCK}`}>
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
                                <div
                                  className="group/payoff-row flex w-full min-w-0 cursor-pointer rounded px-0.5 py-0"
                                  onDoubleClick={(e) => {
                                    if (busy) return;
                                    if ((e.target as HTMLElement).closest('button')) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    beginPayoffEdit(u.id, u.payoff ?? '');
                                  }}
                                >
                                  <div className="flex min-w-0 flex-wrap items-end gap-x-1 gap-y-1">
                                    {scenarioFieldLabel}
                                    <div className="min-w-0 flex-1 text-sm leading-snug">
                                      <span
                                        className={`inline whitespace-pre-wrap align-baseline ${UC_SCENARIO_BODY_TEXT} ${fieldTextClass(
                                          u.designer_payoff_vote,
                                          (u.payoff ?? '').trim() ? (u.payoff ?? '') : '',
                                          rowBaseline?.payoff
                                        )}`}
                                      >
                                        {(u.payoff ?? '').trim() ? (
                                          u.payoff
                                        ) : (
                                          <span className="text-slate-500">
                                            — passa il mouse e usa la matita a destra
                                          </span>
                                        )}
                                      </span>
                                      <span className="ms-1 inline-flex shrink-0 items-center gap-0.5 align-baseline">
                                        <VoteThumbPair
                                          vote={u.designer_payoff_vote}
                                          disabled={busy}
                                          outerBtnClass={UC_SCENARIO_VOTE_BTN}
                                          onVote={(choice) => toggleDesignerFieldVote(u.id, 'payoff', choice)}
                                        />
                                        <button
                                          type="button"
                                          disabled={busy}
                                          title="Modifica scenario"
                                          className={UC_SCENARIO_ROW_EDIT_BTN}
                                          onClick={() => beginPayoffEdit(u.id, u.payoff ?? '')}
                                        >
                                          <Pencil size={12} aria-hidden />
                                        </button>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : null}
                          {wizardShowMessage ? (
                            <div className="rounded-md ring-1 ring-emerald-600/35 bg-emerald-950/20 px-2 py-1">
                              {rowAssistant ? (
                                (() => {
                                  /**
                                   * «Mostra Tokens» (Passo 1/3) sostituisce la frase canonica con la
                                   * versione tokenizzata in giallo, e in tale modalità la riga è
                                   * read-only: la matita di edit è nascosta. Se non c'è una versione
                                   * tokenizzata per questo use case (`assistant_example_tokenized`
                                   * vuoto), si torna al rendering canonico anche col toggle ON —
                                   * altrimenti il designer si ritroverebbe con una bubble vuota.
                                   */
                                  const tokenizedForRow =
                                    showTokenizedAgentMessage && tokenizedByUseCaseId
                                      ? tokenizedByUseCaseId[u.id] ?? ''
                                      : '';
                                  if (tokenizedForRow.trim().length > 0) {
                                    return (
                                      <div className="flex w-full min-w-0 rounded px-0.5 py-0">
                                        <div className="flex min-w-0 flex-wrap items-end gap-x-1 gap-y-1">
                                          {agentMsgFieldLabel}
                                          <div className="min-w-0 flex-1 font-mono text-sm leading-snug text-current">
                                            <TokenizedHighlightedText
                                              text={tokenizedForRow}
                                              inlineFlow
                                              className="inline min-w-0 whitespace-pre-wrap align-baseline"
                                            />
                                            <span className="ms-1 inline-flex shrink-0 items-center gap-0.5 align-baseline">
                                              <VoteThumbPair
                                                vote={u.designer_agent_message_vote}
                                                disabled={busy}
                                                outerBtnClass={UC_AGENT_VOTE_BTN}
                                                onVote={(choice) =>
                                                  toggleDesignerFieldVote(u.id, 'agentMessage', choice)
                                                }
                                              />
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return (
                                <>
                                  {agentMsgEditUseCaseId === u.id ? (
                                    <div className="flex flex-wrap items-start gap-2">
                                      {agentMsgFieldLabel}
                                      <div className="flex min-w-0 flex-1 flex-col">
                                        <BracketTokenHighlightedTextarea
                                        ref={(el) => {
                                          if (el) agentTextareaRefsById.current.set(u.id, el);
                                          else agentTextareaRefsById.current.delete(u.id);
                                        }}
                                        value={agentMsgEditDraft}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setAgentMsgEditDraft(v);
                                          liveAgentContentByIdRef.current[u.id] = v;
                                          onAssistantPhraseDraftChange?.(u.id, v);
                                          requestAnimationFrame(() => {
                                            syncWizardTextareaHeights();
                                            syncAgentMsgSelection();
                                          });
                                        }}
                                        disabled={busy}
                                        rows={2}
                                        autoFocus
                                        spellCheck={false}
                                        aria-label="Messaggio agente"
                                        placeholder="Testo esempio per il messaggio agente…"
                                        containerClassName={`${UC_CLASSIC_TEXTAREA_AGENT} min-h-[52px]`}
                                        onMouseDown={markAgentMsgPointerSelectingMouse}
                                        onTouchStart={markAgentMsgPointerSelectingTouch}
                                        onMouseUp={syncAgentMsgSelection}
                                        onSelect={syncAgentMsgSelection}
                                        onKeyUp={syncAgentMsgSelection}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Escape') {
                                            e.preventDefault();
                                            cancelAgentMsgEdit();
                                          }
                                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                            e.preventDefault();
                                            commitAgentMsgEdit();
                                          }
                                        }}
                                        onScroll={queueRecalcAgentMsgTokenAnchor}
                                      />
                                        {agentMsgTokenPopoverActionVisible !== 'none' && !busy ? (
                                          <AgentMessageSelectionTokenPopover
                                            action={agentMsgTokenPopoverActionVisible}
                                            disabled={busy}
                                            onTokenize={handleWrapAgentToken}
                                            onUntokenize={handleUnwrapAgentTokenAtSelection}
                                            fixedAnchor={agentMsgTokenAnchor}
                                          />
                                        ) : null}
                                      </div>
                                      <div className="flex shrink-0 items-center gap-0.5 self-start pt-0.5">
                                        <button
                                          type="button"
                                          title="Conferma"
                                          disabled={busy}
                                          className="rounded p-0.5 text-emerald-400 hover:bg-slate-800/90 disabled:opacity-40"
                                          onClick={() => commitAgentMsgEdit()}
                                        >
                                          <Check size={14} aria-hidden />
                                        </button>
                                        <button
                                          type="button"
                                          title="Annulla"
                                          disabled={busy}
                                          className="rounded p-0.5 text-slate-400 hover:bg-slate-800/90 disabled:opacity-40"
                                          onClick={() => cancelAgentMsgEdit()}
                                        >
                                          <X size={14} aria-hidden />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      className="group/agentmsg-row flex w-full min-w-0 cursor-pointer rounded px-0.5 py-0"
                                      onDoubleClick={(e) => {
                                        if (busy || !rowAssistant) return;
                                        if ((e.target as HTMLElement).closest('button')) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        beginAgentMsgEdit(
                                          u.id,
                                          rowAssistant.turn_id,
                                          rowAssistant.content
                                        );
                                      }}
                                    >
                                      <div className="flex min-w-0 flex-wrap items-end gap-x-1 gap-y-1">
                                        {agentMsgFieldLabel}
                                        <div
                                          className={`min-w-0 flex-1 font-mono text-sm leading-snug ${fieldTextClass(
                                            u.designer_agent_message_vote,
                                            rowAssistant.content,
                                            rowBaseline?.assistantContent
                                          )}`}
                                        >
                                          {rowAssistant.content.trim() ? (
                                            wizardSearchSeed.trim() ? (
                                              <span className="inline min-w-0 whitespace-pre-wrap align-baseline">
                                                <SeedHighlightedText
                                                  text={rowAssistant.content}
                                                  seed={wizardSearchSeed}
                                                />
                                              </span>
                                            ) : (
                                              <BracketTokenHighlightedText
                                                text={rowAssistant.content}
                                                className="inline min-w-0 whitespace-pre-wrap align-baseline"
                                              />
                                            )
                                          ) : (
                                            <span className="inline whitespace-pre-wrap text-slate-500">
                                              — passa il mouse e usa la matita a destra
                                            </span>
                                          )}
                                          <span className="ms-1 inline-flex shrink-0 items-center gap-0.5 align-baseline">
                                            <VoteThumbPair
                                              vote={u.designer_agent_message_vote}
                                              disabled={busy}
                                              outerBtnClass={UC_AGENT_VOTE_BTN}
                                              onVote={(choice) =>
                                                toggleDesignerFieldVote(u.id, 'agentMessage', choice)
                                              }
                                            />
                                            <button
                                              type="button"
                                              disabled={busy}
                                              title="Modifica messaggio"
                                              className={UC_AGENT_ROW_EDIT_BTN}
                                              onClick={() =>
                                                beginAgentMsgEdit(u.id, rowAssistant.turn_id, rowAssistant.content)
                                              }
                                            >
                                              <Pencil size={12} aria-hidden />
                                            </button>
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </>
                                  );
                                })()
                              ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  {agentMsgFieldLabel}
                                  <div className="min-w-0 flex-1 space-y-2">
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
              </>
              )}
          </div>
        </div>

        {ordered.length > 0 && !primaryGenerateOnRightOnly ? (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden self-stretch">
              {selected ? (
                <div className="flex flex-1 min-h-0 flex-col overflow-auto gap-3 px-0.5 py-1 min-h-0">
                  <div className={`relative rounded-lg ${UC_SCENARIO_PANEL_SURFACE}`}>
                    {payoffEditUseCaseId === selected.id ? (
                      <div className="flex flex-wrap items-start gap-2">
                        {scenarioFieldLabel}
                        <textarea
                          ref={payoffTextareaRef}
                          value={payoffEditDraft}
                          onChange={(e) => {
                            setPayoffEditDraft(e.target.value);
                            requestAnimationFrame(() => syncDetailTextareaHeights());
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
                      <div
                        className="group/payoff-row flex w-full min-w-0 cursor-pointer"
                        onDoubleClick={(e) => {
                          if (busy) return;
                          if ((e.target as HTMLElement).closest('button')) return;
                          e.preventDefault();
                          e.stopPropagation();
                          beginPayoffEdit(selected.id, selected.payoff ?? '');
                        }}
                      >
                        <div className="flex min-w-0 flex-wrap items-end gap-x-1 gap-y-1">
                          {scenarioFieldLabel}
                          <div
                            className={`min-w-0 flex-1 text-sm leading-snug ${UC_SCENARIO_BODY_TEXT} ${fieldTextClass(
                              selected.designer_payoff_vote,
                              selected.payoff ?? '',
                              fieldBaselineByUseCaseId[selected.id]?.payoff
                            )}`}
                          >
                            <span className="inline whitespace-pre-wrap align-baseline">
                              {(selected.payoff ?? '').trim() ? (
                                selected.payoff
                              ) : (
                                <span className="text-slate-500">
                                  — passa il mouse sulla riga e usa la matita a destra
                                </span>
                              )}
                            </span>
                            <span className="ms-1 inline-flex shrink-0 items-center gap-0.5 align-baseline">
                              <VoteThumbPair
                                vote={selected.designer_payoff_vote}
                                disabled={busy}
                                outerBtnClass={UC_SCENARIO_VOTE_BTN}
                                onVote={(choice) => toggleDesignerFieldVote(selected.id, 'payoff', choice)}
                              />
                              <button
                                type="button"
                                disabled={busy}
                                title="Modifica scenario"
                                className={UC_SCENARIO_ROW_EDIT_BTN}
                                onClick={() => beginPayoffEdit(selected.id, selected.payoff ?? '')}
                              >
                                <Pencil size={12} aria-hidden />
                              </button>
                            </span>
                          </div>
                          {scenarioDirty ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleScenarioRegenerateClick()}
                              title={LABEL_REGENERATE_USE_CASE_FOR_SCENARIO}
                              className="inline-flex shrink-0 items-center gap-1 self-start rounded-md border border-violet-500/50 bg-violet-900/40 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-violet-100 hover:bg-violet-800/50 disabled:opacity-40"
                            >
                              {busy ? (
                                <Loader2 className="animate-spin shrink-0" size={12} aria-hidden />
                              ) : (
                                <RefreshCw size={12} className="shrink-0" aria-hidden />
                              )}
                              {LABEL_REGENERATE_USE_CASE_FOR_SCENARIO}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg ring-1 ring-emerald-600/40 bg-emerald-950/20 px-2 py-1">
                    {assistantTurn ? (
                      agentMsgEditUseCaseId === selected.id ? (
                        <div className="flex flex-wrap items-start gap-2">
                          {agentMsgFieldLabel}
                          <div className="flex min-w-0 flex-1 flex-col">
                          <BracketTokenHighlightedTextarea
                            ref={agentTextareaRef}
                            value={agentMsgEditDraft}
                            onChange={(e) => {
                              const v = e.target.value;
                              liveAgentContentRef.current = v;
                              setAgentMsgEditDraft(v);
                              onAssistantPhraseDraftChange?.(selected.id, v);
                              requestAnimationFrame(() => {
                                syncDetailTextareaHeights();
                                syncAgentMsgSelection();
                              });
                            }}
                            onMouseDown={markAgentMsgPointerSelectingMouse}
                            onTouchStart={markAgentMsgPointerSelectingTouch}
                            onMouseUp={syncAgentMsgSelection}
                            onSelect={syncAgentMsgSelection}
                            onKeyUp={syncAgentMsgSelection}
                            disabled={busy}
                            rows={2}
                            autoFocus
                            spellCheck={false}
                            aria-label="Messaggio agente"
                            placeholder="Seleziona testo: al rilascio del mouse compare Tokenizza o Rimuovi token; oppure usa i pulsanti Token / Senza quadre."
                            containerClassName={`${UC_CLASSIC_TEXTAREA_AGENT} min-h-[52px]`}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelAgentMsgEdit();
                              }
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                commitAgentMsgEdit();
                              }
                            }}
                            onScroll={queueRecalcAgentMsgTokenAnchor}
                          />
                            {agentMsgTokenPopoverActionVisible !== 'none' && !busy ? (
                              <AgentMessageSelectionTokenPopover
                                action={agentMsgTokenPopoverActionVisible}
                                disabled={busy}
                                onTokenize={handleWrapAgentToken}
                                onUntokenize={handleUnwrapAgentTokenAtSelection}
                                fixedAnchor={agentMsgTokenAnchor}
                              />
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5 self-start pt-0.5">
                            <button
                              type="button"
                              title="Conferma"
                              disabled={busy}
                              className="rounded p-0.5 text-emerald-400 hover:bg-slate-800/90 disabled:opacity-40"
                              onClick={() => commitAgentMsgEdit()}
                            >
                              <Check size={14} aria-hidden />
                            </button>
                            <button
                              type="button"
                              title="Annulla"
                              disabled={busy}
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-800/90 disabled:opacity-40"
                              onClick={() => cancelAgentMsgEdit()}
                            >
                              <X size={14} aria-hidden />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="group/agentmsg-row flex w-full min-w-0 cursor-pointer"
                          onDoubleClick={(e) => {
                            if (busy) return;
                            if ((e.target as HTMLElement).closest('button')) return;
                            e.preventDefault();
                            e.stopPropagation();
                            beginAgentMsgEdit(
                              selected.id,
                              assistantTurn.turn_id,
                              assistantTurn.content
                            );
                          }}
                        >
                          <div className="flex min-w-0 flex-wrap items-end gap-x-1 gap-y-1">
                            {agentMsgFieldLabel}
                            <div
                              className={`min-w-0 flex-1 font-mono text-sm leading-snug ${fieldTextClass(
                                selected.designer_agent_message_vote,
                                assistantTurn.content,
                                fieldBaselineByUseCaseId[selected.id]?.assistantContent
                              )}`}
                            >
                              {assistantTurn.content.trim() ? (
                                <BracketTokenHighlightedText
                                  text={assistantTurn.content}
                                  className="inline min-w-0 whitespace-pre-wrap align-baseline"
                                />
                              ) : (
                                <span className="inline whitespace-pre-wrap text-slate-500">
                                  — passa il mouse sulla riga e usa la matita a destra
                                </span>
                              )}
                              <span className="ms-1 inline-flex shrink-0 items-center gap-0.5 align-baseline">
                                <VoteThumbPair
                                  vote={selected.designer_agent_message_vote}
                                  disabled={busy}
                                  outerBtnClass={UC_AGENT_VOTE_BTN}
                                  onVote={(choice) =>
                                    toggleDesignerFieldVote(selected.id, 'agentMessage', choice)
                                  }
                                />
                                <button
                                  type="button"
                                  disabled={busy}
                                  title="Modifica messaggio"
                                  className={UC_AGENT_ROW_EDIT_BTN}
                                  onClick={() =>
                                    beginAgentMsgEdit(selected.id, assistantTurn.turn_id, assistantTurn.content)
                                  }
                                >
                                  <Pencil size={12} aria-hidden />
                                </button>
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                        {agentMsgFieldLabel}
                        <div className="min-w-0 flex-1 space-y-2 py-0.5">
                          <p className="text-xs text-slate-500">
                            Nessun turno assistente. Rigenera per crearne uno con l&apos;IA oppure aggiungi manualmente un
                            turno vuoto.
                          </p>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => ensureAssistantTurn()}
                            className="text-xs text-emerald-300 underline disabled:opacity-50"
                          >
                            Aggiungi messaggio agente (vuoto)
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-emerald-800/40 pt-1.5">
                      {assistantTurn && !agentMessageEmpty ? (
                        <>
                          <button
                            type="button"
                            disabled={
                              busy ||
                              !canWrapAgentToken ||
                              (Boolean(selected) && agentMsgEditUseCaseId !== selected.id)
                            }
                            title={
                              selected && agentMsgEditUseCaseId !== selected.id
                                ? 'Apri la modifica con la matita per selezionare il testo e usare Token'
                                : 'Avvolge il testo selezionato tra quadre [ ] come slot runtime'
                            }
                            onClick={() => handleWrapAgentToken()}
                            className="inline-flex items-center gap-0.5 rounded-md border border-emerald-600/50 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-emerald-50 hover:bg-emerald-900/70 disabled:opacity-40"
                          >
                            <Brackets size={12} className="shrink-0 opacity-90" aria-hidden />
                            {LABEL_AGENT_MSG_WRAP_TOKEN}
                          </button>
                          <button
                            type="button"
                            disabled={
                              busy ||
                              !canStripAgentTokens ||
                              (Boolean(selected) && agentMsgEditUseCaseId !== selected.id)
                            }
                            onClick={() => handleStripAgentTokens()}
                            title={
                              selected && agentMsgEditUseCaseId !== selected.id
                                ? 'Apri la modifica con la matita per usare questa azione sul testo'
                                : 'Rimuove tutte le quadre [ ], lasciando solo il testo interno'
                            }
                            className="inline-flex items-center gap-0.5 rounded-md border border-emerald-600/45 bg-emerald-950/45 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-emerald-100/95 hover:bg-emerald-900/55 disabled:opacity-40"
                          >
                            {LABEL_AGENT_MSG_STRIP_TOKENS}
                          </button>
                        </>
                      ) : null}
                      {agentMessageEmpty ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            void (async () => {
                              const next = await onRegenerateAgentMessage(selected.id);
                              if (typeof next === 'string') {
                                setFieldBaselineByUseCaseId((prev) => {
                                  const cur = prev[selected.id];
                                  if (!cur) return prev;
                                  return {
                                    ...prev,
                                    [selected.id]: { ...cur, assistantContent: next },
                                  };
                                });
                              }
                            })();
                          }}
                          title={LABEL_REGENERATE_AGENT_EXAMPLE}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-600/50 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-emerald-50 hover:bg-emerald-900/70 disabled:opacity-40"
                        >
                          {busy ? (
                            <Loader2 className="animate-spin shrink-0" size={12} aria-hidden />
                          ) : (
                            <RefreshCw size={12} className="shrink-0" aria-hidden />
                          )}
                          {LABEL_REGENERATE_AGENT_EXAMPLE}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
        ) : null}
      </div>
    </div>
  );
}
