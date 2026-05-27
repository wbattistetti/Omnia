/**
 * Stato condiviso tra ViewSkaGenerator (toolbar sotto lo stepper) e AIAgentUseCaseComposer
 * (accordion lista use case in modalità wizard).
 */

import React from 'react';
import type { UseCaseTestQuestionStats } from '@domain/aiAgentUseCase/useCaseTestQuestions';

/** Filtro cruscotto domande di test (solo OK/KO; Validate è solo KPI). */
export type TestQuestionLens = 'ok' | 'ko';

export type WizardBulkFoldState = 'expanded' | 'collapsed' | 'mixed';

/** Intestazione riga use case nell'accordion: etichetta UC oppure testo messaggio agente. */
export type WizardAccordionHeaderMode = 'label' | 'message';

export type CorrectionPreviewRow = {
  readonly useCaseId: string;
  readonly useCaseLabel: string;
  readonly current: string;
  readonly proposed: string;
};

/** Stato anteprima «Completa correzione» nel pannello DX; `null` = niente anteprima attiva. */
export type CorrectionPreviewState = {
  readonly loading: boolean;
  readonly error: string | null;
  readonly synthesis: string;
  readonly rows: readonly CorrectionPreviewRow[];
};

export type UseCaseWizardListHandlers = {
  expandAll: () => void;
  collapseAll: () => void;
};

export interface UseCaseWizardListToolbarContextValue {
  /** Radio: cosa mostrare nell'intestazione di ogni riga UC (non il corpo espanso). */
  listAccordionHeaderMode: WizardAccordionHeaderMode;
  selectListAccordionHeaderMode: (mode: WizardAccordionHeaderMode) => void;
  /** Pill Scenario: corpo espanso — blocco scenario visibile. */
  showScenario: boolean;
  /** Pill Messaggio: corpo espanso — blocco messaggio visibile. */
  showMessage: boolean;
  /** Right aside: actions palette for use case response (replaces tutorial when on). */
  showActionsPanel: boolean;
  /** Right aside: Slot Mapping (sostituisce tutorial). */
  showSlotMappingPanel: boolean;
  toggleScenario: () => void;
  toggleMessage: () => void;
  toggleActionsPanel: () => void;
  /** Apre il pannello azioni; se già aperto non fa nulla (no toggle). */
  openActionsPanel: () => void;
  toggleSlotMappingPanel: () => void;
  bulkFold: WizardBulkFoldState;
  setBulkFold: React.Dispatch<React.SetStateAction<WizardBulkFoldState>>;
  registerHandlers: (handlers: UseCaseWizardListHandlers | null) => void;
  triggerExpandAll: () => void;
  triggerCollapseAll: () => void;
  notifyCardToggle: () => void;
  /**
   * Seed di ricerca **committato** dalla search box della toolbar (premuto Enter o
   * pulito via X). Stringa vuota = nessun match attivo. Il composer la legge per
   * evidenziare con `<mark>` giallo le occorrenze nei messaggi agente; il commit è
   * volutamente esplicito (non on-change) per non re-renderizzare l'intera lista a
   * ogni tasto premuto durante la digitazione.
   */
  searchSeed: string;
  setSearchSeed: (next: string) => void;
  /** Surface lessico con lente attiva (toggle filtro da Slot Mapping). */
  lensActiveSurface: string | null;
  setLensActiveSurface: (next: string | null) => void;
  /** Azzera filtro ricerca e lente (chip X / clear). */
  clearSearchFilter: () => void;
  /**
   * Numero di **campi** (scenario / messaggio agente) sostanzialmente modificati dall'utente
   * rispetto all'ultima baseline IA (≥ 3 parole cambiate per campo, vedi
   * `useCaseSubstantialEdits.ts`). Pubblicato dal composer; usato dal callout DX
   * «Completa correzione» per la visibilità quando supera la soglia visiva.
   */
  pendingCorrectionsCount: number;
  setPendingCorrectionsCount: (next: number) => void;
  /**
   * Handler registrato dal composer per "consolidare" le correzioni: il draft corrente
   * di ogni campo modificato diventa la nuova baseline IA, azzerando il count. È `null`
   * finché il composer non si è ancora montato (la toolbar in quel caso non chiama).
   *
   * **Async**: l'handler ritorna una `Promise<void>` che si risolve a operazione AI
   * completata (o fallita). Il `triggerConsolidateCorrections` del context wrappa la
   * chiamata e gestisce lo stato `correctionsBusy` automaticamente — l'UI non deve
   * più tracciare il busy a parte.
   */
  registerConsolidateCorrectionsHandler: (handler: (() => Promise<void>) | null) => void;
  triggerConsolidateCorrections: () => Promise<void>;
  /**
   * `true` mentre il servizio AI di propagazione stile è in volo (entrato in
   * `triggerConsolidateCorrections` e non ancora settled). Usato dal callout per
   * sostituire il pulsante «Correggi» con uno spinner non interrompibile.
   */
  correctionsBusy: boolean;
  /**
   * `true` quando l'utente ha cliccato «Procedo io manualmente» nel callout: il
   * callout resta nascosto finché il `pendingCorrectionsCount` non scende sotto soglia
   * e poi risale (rearm automatico — vedi `useEffect` interno). Non persistito: vive
   * solo nella sessione del provider (cioè finché il pannello use case è montato).
   */
  correctionsDismissed: boolean;
  /** Nasconde il callout (manual dismiss). Riarmo automatico al prossimo ciclo soglia. */
  dismissCorrections: () => void;

  correctionPreviewState: CorrectionPreviewState | null;
  setCorrectionPreviewState: React.Dispatch<
    React.SetStateAction<CorrectionPreviewState | null>
  >;

  /** Use case selezionato in lista (per generazione domande di test). */
  toolbarSelectedUseCaseId: string | null;
  setToolbarSelectedUseCaseId: (id: string | null) => void;
  /** KPI aggregate domande di test (cruscotto). */
  testQuestionStats: UseCaseTestQuestionStats;
  setTestQuestionStats: (stats: UseCaseTestQuestionStats) => void;
  /** Lente OK/KO: espande ed evidenzia; secondo click = toggle off. */
  testQuestionLens: TestQuestionLens | null;
  toggleTestQuestionLens: (lens: TestQuestionLens) => void;
  clearTestQuestionLens: () => void;
  registerGenerateTestQuestionsHandler: (handler: (() => Promise<void>) | null) => void;
  triggerGenerateTestQuestions: () => Promise<void>;
  generateTestQuestionsBusy: boolean;
  testQuestionsNotice: string | null;
  setTestQuestionsNotice: (message: string | null) => void;
}

const UseCaseWizardListToolbarContext =
  React.createContext<UseCaseWizardListToolbarContextValue | null>(null);

export function UseCaseWizardListToolbarProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [listAccordionHeaderMode, setListAccordionHeaderMode] =
    React.useState<WizardAccordionHeaderMode>('label');
  const [showScenarioVisible, setShowScenarioVisible] = React.useState(true);
  const [showMessageVisible, setShowMessageVisible] = React.useState(true);
  const [showActionsPanel, setShowActionsPanel] = React.useState(false);
  const [showSlotMappingPanel, setShowSlotMappingPanel] = React.useState(false);
  const [bulkFold, setBulkFold] = React.useState<WizardBulkFoldState>('expanded');
  /** Seed search committato (Enter, lente, chip X). */
  const [searchSeed, setSearchSeedRaw] = React.useState<string>('');
  const [lensActiveSurface, setLensActiveSurfaceRaw] = React.useState<string | null>(null);
  /**
   * Conteggio "campi sostanzialmente modificati" pubblicato dal composer. Il callout
   * «Completa correzione» nel pannello DX lo legge per la visibilità.
   */
  const [pendingCorrectionsCount, setPendingCorrectionsCountRaw] = React.useState<number>(0);
  const [correctionsBusy, setCorrectionsBusy] = React.useState<boolean>(false);
  /**
   * Dismissal "soft" del callout: se l'utente clicca «Procedo io manualmente» il
   * callout si nasconde, ma deve poter riapparire se l'utente continua a fare
   * correzioni sostanziali. Strategia di rearm: ogni volta che `pendingCorrectionsCount`
   * passa da `< THRESHOLD` a `>= THRESHOLD` resetto il flag a `false` (vedi
   * `useEffect` sotto). Threshold qui è cablato a `1` per essere conservativo:
   * il callout vero usa `COMPLETE_CORRECTION_VISIBILITY_THRESHOLD` come soglia di
   * **visibilità**, ma il rearm conta come "transizione 0 → ≥1" perché ogni nuova
   * tornata di edit parte da zero (post-consolidamento o post-edit ricorrente).
   */
  const [correctionsDismissed, setCorrectionsDismissed] = React.useState<boolean>(false);
  const [correctionPreviewState, setCorrectionPreviewState] =
    React.useState<CorrectionPreviewState | null>(null);
  const handlersRef = React.useRef<UseCaseWizardListHandlers | null>(null);
  const consolidateHandlerRef = React.useRef<(() => Promise<void>) | null>(null);
  const generateTestQuestionsHandlerRef = React.useRef<(() => Promise<void>) | null>(null);
  const wasOverThresholdRef = React.useRef<boolean>(false);
  const [toolbarSelectedUseCaseId, setToolbarSelectedUseCaseId] = React.useState<string | null>(
    null
  );
  const [testQuestionStats, setTestQuestionStatsRaw] =
    React.useState<UseCaseTestQuestionStats>({
      total: 0,
      pending: 0,
      ok: 0,
      ko: 0,
      reviewedPct: 0,
      okPct: 0,
      koPct: 0,
    });
  const [testQuestionLens, setTestQuestionLens] = React.useState<TestQuestionLens | null>(null);
  const [generateTestQuestionsBusy, setGenerateTestQuestionsBusy] = React.useState(false);
  const [testQuestionsNotice, setTestQuestionsNotice] = React.useState<string | null>(null);

  /**
   * Rearm automatico del dismissal: appena il count torna a 0 (consolidamento
   * andato a buon fine, o l'utente ha annullato edit) resetto `correctionsDismissed`
   * così al prossimo superamento di soglia il callout ricompare. NB: il setter è
   * stable; questo `useEffect` non scatena loop.
   */
  React.useEffect(() => {
    const isOver = pendingCorrectionsCount > 0;
    if (!isOver && wasOverThresholdRef.current) {
      setCorrectionsDismissed(false);
    }
    wasOverThresholdRef.current = isOver;
  }, [pendingCorrectionsCount]);

  const registerHandlers = React.useCallback((handlers: UseCaseWizardListHandlers | null) => {
    handlersRef.current = handlers;
  }, []);

  const triggerExpandAll = React.useCallback(() => {
    handlersRef.current?.expandAll();
    setBulkFold('expanded');
  }, []);

  const triggerCollapseAll = React.useCallback(() => {
    handlersRef.current?.collapseAll();
    setBulkFold('collapsed');
  }, []);

  const notifyCardToggle = React.useCallback(() => {
    setBulkFold('mixed');
  }, []);

  const selectListAccordionHeaderMode = React.useCallback((mode: WizardAccordionHeaderMode) => {
    setListAccordionHeaderMode(mode);
  }, []);

  const toggleScenario = React.useCallback(() => {
    setShowScenarioVisible((v) => !v);
  }, []);

  const toggleMessage = React.useCallback(() => {
    setShowMessageVisible((v) => !v);
  }, []);

  const toggleActionsPanel = React.useCallback(() => {
    setShowActionsPanel((v) => {
      const next = !v;
      if (next) setShowSlotMappingPanel(false);
      return next;
    });
  }, []);

  const openActionsPanel = React.useCallback(() => {
    setShowSlotMappingPanel(false);
    setShowActionsPanel(true);
  }, []);

  const toggleSlotMappingPanel = React.useCallback(() => {
    setShowSlotMappingPanel((v) => {
      const next = !v;
      if (next) setShowActionsPanel(false);
      return next;
    });
  }, []);

  const setLensActiveSurface = React.useCallback((next: string | null) => {
    setLensActiveSurfaceRaw(next && next.trim() ? next.trim().toLowerCase() : null);
  }, []);

  const setSearchSeed = React.useCallback((next: string) => {
    const trimmed = typeof next === 'string' ? next.trim() : '';
    setSearchSeedRaw(trimmed);
    if (!trimmed) {
      setLensActiveSurfaceRaw(null);
      return;
    }
    setLensActiveSurfaceRaw((prev) =>
      prev && trimmed.toLowerCase() === prev ? prev : null
    );
  }, []);

  const clearSearchFilter = React.useCallback(() => {
    setSearchSeedRaw('');
    setLensActiveSurfaceRaw(null);
  }, []);

  /**
   * Stable setter del count: ignora valori non finiti / negativi (fail-loud non serve
   * qui — il dato è derivato; basta il clamp difensivo). Identità stabile per evitare
   * loop nel `useEffect` del composer che chiama questo setter ad ogni cambio dati.
   */
  const setPendingCorrectionsCount = React.useCallback((next: number): void => {
    if (!Number.isFinite(next) || next < 0) {
      setPendingCorrectionsCountRaw(0);
      return;
    }
    setPendingCorrectionsCountRaw(Math.floor(next));
  }, []);

  const registerConsolidateCorrectionsHandler = React.useCallback(
    (handler: (() => Promise<void>) | null): void => {
      consolidateHandlerRef.current = handler;
    },
    []
  );

  /**
   * Wrappa la chiamata all'handler async del composer: gestisce il busy flag in modo
   * idempotente con `try/finally` (anche se l'handler rejects, il busy torna `false`).
   * L'errore non viene risollevato: la propagazione errori è già in carico al
   * controller (`useAIAgentEditorController.handleCompleteCorrection` → toast).
   */
  const triggerConsolidateCorrections = React.useCallback(async (): Promise<void> => {
    const fn = consolidateHandlerRef.current;
    if (!fn) return;
    setCorrectionsBusy(true);
    try {
      await fn();
    } finally {
      setCorrectionsBusy(false);
    }
  }, []);

  const dismissCorrections = React.useCallback((): void => {
    setCorrectionsDismissed(true);
  }, []);

  const setTestQuestionStats = React.useCallback((stats: UseCaseTestQuestionStats) => {
    setTestQuestionStatsRaw(stats);
  }, []);

  const toggleTestQuestionLens = React.useCallback((lens: TestQuestionLens) => {
    setTestQuestionLens((prev) => (prev === lens ? null : lens));
  }, []);

  const clearTestQuestionLens = React.useCallback(() => {
    setTestQuestionLens(null);
  }, []);

  const registerGenerateTestQuestionsHandler = React.useCallback(
    (handler: (() => Promise<void>) | null): void => {
      generateTestQuestionsHandlerRef.current = handler;
    },
    []
  );

  const triggerGenerateTestQuestions = React.useCallback(async (): Promise<void> => {
    const fn = generateTestQuestionsHandlerRef.current;
    if (!fn) return;
    setGenerateTestQuestionsBusy(true);
    try {
      await fn();
    } finally {
      setGenerateTestQuestionsBusy(false);
    }
  }, []);

  const value = React.useMemo<UseCaseWizardListToolbarContextValue>(
    () => ({
      listAccordionHeaderMode,
      selectListAccordionHeaderMode,
      showScenario: showScenarioVisible,
      showMessage: showMessageVisible,
      showActionsPanel,
      showSlotMappingPanel,
      toggleScenario,
      toggleMessage,
      toggleActionsPanel,
      openActionsPanel,
      toggleSlotMappingPanel,
      bulkFold,
      setBulkFold,
      registerHandlers,
      triggerExpandAll,
      triggerCollapseAll,
      notifyCardToggle,
      searchSeed,
      setSearchSeed,
      lensActiveSurface,
      setLensActiveSurface,
      clearSearchFilter,
      pendingCorrectionsCount,
      setPendingCorrectionsCount,
      registerConsolidateCorrectionsHandler,
      triggerConsolidateCorrections,
      correctionsBusy,
      correctionsDismissed,
      dismissCorrections,
      correctionPreviewState,
      setCorrectionPreviewState,
      toolbarSelectedUseCaseId,
      setToolbarSelectedUseCaseId,
      testQuestionStats,
      setTestQuestionStats,
      testQuestionLens,
      toggleTestQuestionLens,
      clearTestQuestionLens,
      registerGenerateTestQuestionsHandler,
      triggerGenerateTestQuestions,
      generateTestQuestionsBusy,
      testQuestionsNotice,
      setTestQuestionsNotice,
    }),
    [
      listAccordionHeaderMode,
      selectListAccordionHeaderMode,
      showScenarioVisible,
      showMessageVisible,
      showActionsPanel,
      showSlotMappingPanel,
      toggleScenario,
      toggleMessage,
      toggleActionsPanel,
      openActionsPanel,
      toggleSlotMappingPanel,
      bulkFold,
      registerHandlers,
      triggerExpandAll,
      triggerCollapseAll,
      notifyCardToggle,
      searchSeed,
      setSearchSeed,
      lensActiveSurface,
      setLensActiveSurface,
      clearSearchFilter,
      pendingCorrectionsCount,
      setPendingCorrectionsCount,
      registerConsolidateCorrectionsHandler,
      triggerConsolidateCorrections,
      correctionsBusy,
      correctionsDismissed,
      dismissCorrections,
      correctionPreviewState,
      toolbarSelectedUseCaseId,
      testQuestionStats,
      testQuestionLens,
      toggleTestQuestionLens,
      clearTestQuestionLens,
      registerGenerateTestQuestionsHandler,
      triggerGenerateTestQuestions,
      generateTestQuestionsBusy,
      testQuestionsNotice,
    ]
  );

  return (
    <UseCaseWizardListToolbarContext.Provider value={value}>
      {children}
    </UseCaseWizardListToolbarContext.Provider>
  );
}

export function useUseCaseWizardListToolbarOptional(): UseCaseWizardListToolbarContextValue | null {
  return React.useContext(UseCaseWizardListToolbarContext);
}
