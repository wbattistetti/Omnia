/**
 * Stato condiviso tra ViewSkaGenerator (toolbar sotto lo stepper) e AIAgentUseCaseComposer
 * (accordion lista use case in modalità wizard).
 */

import React from 'react';

export type WizardBulkFoldState = 'expanded' | 'collapsed' | 'mixed';

export type UseCaseWizardListHandlers = {
  expandAll: () => void;
  collapseAll: () => void;
};

export interface UseCaseWizardListToolbarContextValue {
  showScenario: boolean;
  showMessage: boolean;
  toggleScenario: () => void;
  toggleMessage: () => void;
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
}

const UseCaseWizardListToolbarContext =
  React.createContext<UseCaseWizardListToolbarContextValue | null>(null);

export function UseCaseWizardListToolbarProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [showScenario, setShowScenario] = React.useState(true);
  /** Triplet UX: scenario + messaggio agente visibili subito dopo generazione IA. */
  const [showMessage, setShowMessage] = React.useState(true);
  const [bulkFold, setBulkFold] = React.useState<WizardBulkFoldState>('expanded');
  /** Seed search committato (commit esplicito su Enter / clear) — vedi JSDoc del context. */
  const [searchSeed, setSearchSeedRaw] = React.useState<string>('');
  const handlersRef = React.useRef<UseCaseWizardListHandlers | null>(null);

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

  const toggleScenario = React.useCallback(() => {
    setShowScenario((v) => !v);
  }, []);

  const toggleMessage = React.useCallback(() => {
    setShowMessage((v) => !v);
  }, []);

  /**
   * Trim difensivo: spazi accidentali in coda non devono cambiare il match (l'utente
   * percepirebbe "non funziona" pur avendo digitato la parola giusta). Il valore
   * vuoto resta sentinella di "nessun highlight".
   */
  const setSearchSeed = React.useCallback((next: string) => {
    setSearchSeedRaw(typeof next === 'string' ? next.trim() : '');
  }, []);

  const value = React.useMemo<UseCaseWizardListToolbarContextValue>(
    () => ({
      showScenario,
      showMessage,
      toggleScenario,
      toggleMessage,
      bulkFold,
      setBulkFold,
      registerHandlers,
      triggerExpandAll,
      triggerCollapseAll,
      notifyCardToggle,
      searchSeed,
      setSearchSeed,
    }),
    [
      showScenario,
      showMessage,
      toggleScenario,
      toggleMessage,
      bulkFold,
      registerHandlers,
      triggerExpandAll,
      triggerCollapseAll,
      notifyCardToggle,
      searchSeed,
      setSearchSeed,
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
