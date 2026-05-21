/**
 * Provider minimi per il composer Omnia nel portale review: niente ProjectDataProvider
 * (evita GET /conditions, /meta, catalogo progetto — non servono per editare la review).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { AIProviderProvider } from '@context/AIProviderContext';
import {
  ProjectTranslationsContext,
  type ProjectTranslationsContextType,
} from '@context/projectTranslationsContextInstance';

const noopAsync = async (): Promise<void> => {};

function ReviewPortalTranslationsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [flowTranslationRevision, setFlowTranslationRevision] = useState(0);

  const addTranslation = useCallback((guid: string, text: string) => {
    if (!guid) return;
    setTranslations((prev) => (prev[guid] === text ? prev : { ...prev, [guid]: text }));
    setFlowTranslationRevision((n) => n + 1);
  }, []);

  const addTranslations = useCallback((batch: Record<string, string>) => {
    setTranslations((prev) => ({ ...prev, ...batch }));
    setFlowTranslationRevision((n) => n + 1);
  }, []);

  const getTranslation = useCallback(
    (guid: string) => translations[guid],
    [translations]
  );

  const setCurrentTemplateId = useCallback((_templateId: string | null) => {}, []);

  const value = useMemo<ProjectTranslationsContextType>(
    () => ({
      translations,
      compiledTranslations: translations,
      flowTranslationRevision,
      addTranslation,
      addTranslations,
      getTranslation,
      loadAllTranslations: noopAsync,
      saveAllTranslations: noopAsync,
      isDirty: false,
      isLoading: false,
      isReady: true,
      setCurrentTemplateId,
    }),
    [
      translations,
      flowTranslationRevision,
      addTranslation,
      addTranslations,
      getTranslation,
      setCurrentTemplateId,
    ]
  );

  return (
    <ProjectTranslationsContext.Provider value={value}>
      {children}
    </ProjectTranslationsContext.Provider>
  );
}

export interface ReviewOmniaProvidersProps {
  children: React.ReactNode;
}

export function ReviewOmniaProviders({ children }: ReviewOmniaProvidersProps): React.ReactElement {
  return (
    <DndProvider backend={HTML5Backend}>
      <ReviewPortalTranslationsProvider>
        <AIProviderProvider>{children}</AIProviderProvider>
      </ReviewPortalTranslationsProvider>
    </DndProvider>
  );
}
