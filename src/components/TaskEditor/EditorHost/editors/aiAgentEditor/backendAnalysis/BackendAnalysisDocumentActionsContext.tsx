/**
 * Espone azioni analisi documento backend alla barra sotto-tab «Analisi dei backend».
 */

import React from 'react';
import type { KbAnalysisToolbarPresentation } from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';

export type BackendAnalysisDocumentActions = {
  presentation: KbAnalysisToolbarPresentation;
  busy: boolean;
  onExecute: () => void;
};
type RegisterFn = (actions: BackendAnalysisDocumentActions | null) => void;

const BackendAnalysisDocumentActionsContext = React.createContext<RegisterFn | null>(null);

const BackendAnalysisDocumentActionsStateContext =
  React.createContext<BackendAnalysisDocumentActions | null>(null);

export function BackendAnalysisDocumentActionsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [actions, setActions] = React.useState<BackendAnalysisDocumentActions | null>(null);

  const register = React.useCallback<RegisterFn>((next) => {
    setActions(next);
  }, []);

  return (
    <BackendAnalysisDocumentActionsContext.Provider value={register}>
      <BackendAnalysisDocumentActionsStateContext.Provider value={actions}>
        {children}
      </BackendAnalysisDocumentActionsStateContext.Provider>
    </BackendAnalysisDocumentActionsContext.Provider>
  );
}

export function useRegisterBackendAnalysisDocumentActions(): RegisterFn {
  const register = React.useContext(BackendAnalysisDocumentActionsContext);
  if (!register) {
    throw new Error(
      'useRegisterBackendAnalysisDocumentActions must be used within BackendAnalysisDocumentActionsProvider'
    );
  }
  return register;
}

export function useOptionalBackendAnalysisDocumentActions(): BackendAnalysisDocumentActions | null {
  return React.useContext(BackendAnalysisDocumentActionsStateContext);
}
