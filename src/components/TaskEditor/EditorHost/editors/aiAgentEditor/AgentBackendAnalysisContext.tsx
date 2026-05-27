/**
 * Contesto condiviso: analisi backend V2 (L1 tab + L2 pannello parametro).
 */

import React from 'react';
import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';
import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import type { BackendAnalysisDocumentV2 } from '@domain/backendAnalysis/backendAnalysisDocumentV2';
import {
  patchAgentBackendAnalysisBundle,
  readAgentBackendAnalysisBundle,
} from '@domain/backendAnalysis/agentBackendAnalysisBundle';
import { exportBackendAnalysisV2Markdown } from '@domain/backendAnalysis/exportBackendAnalysisV2Markdown';
import {
  ensureCatalogBackendsOnDocument,
  markdownToBackendAnalysisV2,
} from '@domain/backendAnalysis/migrateToBackendAnalysisV2';
import { resolveParameterAnalysis } from '@domain/backendAnalysis/parameterAnalysisResolve';
import { normalizeBackendAnalysisUxDocument } from '@domain/backendAnalysis/backendAnalysisUxNormalize';
import { taskRepository } from '@services/TaskRepository';

export type ParameterAnalysisPanelTarget = {
  catalogEntryId: string;
  paramKey: string;
  displayLabel: string;
};

type AgentBackendAnalysisContextValue = {
  agentTaskId: string;
  document: BackendAnalysisDocumentV2;
  analysisMarkdown: string;
  /** Prima analisi completata (baseline agente impostata). */
  analysisLaunched: boolean;
  manualEntries: readonly ManualCatalogEntry[];
  persistDocument: (next: BackendAnalysisDocumentV2) => void;
  parameterPanel: ParameterAnalysisPanelTarget | null;
  openParameterPanel: (target: ParameterAnalysisPanelTarget) => void;
  closeParameterPanel: () => void;
  resolveParam: (catalogEntryId: string, paramKey: string) => ReturnType<typeof resolveParameterAnalysis>;
  /** L1: apre editor dettaglio parametro (modificabile). */
  editingParam: { catalogEntryId: string; paramKey: string } | null;
  setEditingParam: (v: { catalogEntryId: string; paramKey: string } | null) => void;
};

const AgentBackendAnalysisContext = React.createContext<AgentBackendAnalysisContextValue | null>(
  null
);

export function useAgentBackendAnalysis(): AgentBackendAnalysisContextValue {
  const ctx = React.useContext(AgentBackendAnalysisContext);
  if (!ctx) {
    throw new Error('useAgentBackendAnalysis must be used within AgentBackendAnalysisProvider');
  }
  return ctx;
}

export function useOptionalAgentBackendAnalysis(): AgentBackendAnalysisContextValue | null {
  return React.useContext(AgentBackendAnalysisContext);
}

export type AgentBackendAnalysisProviderProps = {
  agentTaskId: string;
  backendCatalog: ProjectBackendCatalogBlob;
  manualEntries: readonly ManualCatalogEntry[];
  onPersistCatalog: (next: ProjectBackendCatalogBlob) => void;
  children: React.ReactNode;
};

export function AgentBackendAnalysisProvider({
  agentTaskId,
  backendCatalog,
  manualEntries,
  onPersistCatalog,
  children,
}: AgentBackendAnalysisProviderProps): React.ReactElement {
  const [parameterPanel, setParameterPanel] = React.useState<ParameterAnalysisPanelTarget | null>(
    null
  );
  const [editingParam, setEditingParam] = React.useState<{
    catalogEntryId: string;
    paramKey: string;
  } | null>(null);

  const bundle = React.useMemo(
    () => readAgentBackendAnalysisBundle(backendCatalog, agentTaskId),
    [backendCatalog, agentTaskId]
  );

  const document = React.useMemo(() => {
    const tasks = taskRepository.getAllTasks();
    let raw: ReturnType<typeof ensureCatalogBackendsOnDocument>;
    if (bundle.analysisDocument && Object.keys(bundle.analysisDocument.backends).length > 0) {
      raw = ensureCatalogBackendsOnDocument(bundle.analysisDocument, manualEntries, tasks);
    } else if (bundle.analysisMarkdown.trim()) {
      raw = markdownToBackendAnalysisV2(bundle.analysisMarkdown, manualEntries, tasks);
    } else {
      raw = ensureCatalogBackendsOnDocument(bundle.analysisDocument, manualEntries, tasks);
    }
    const sourceMarkdown =
      bundle.analysisMarkdown.trim() || bundle.agentAnalysisBaselineMarkdown.trim();
    return normalizeBackendAnalysisUxDocument(raw, { sourceMarkdown });
  }, [bundle, manualEntries]);

  const analysisLaunched = Boolean(bundle.agentAnalysisBaselineMarkdown.trim());
  const analysisMarkdown =
    bundle.analysisMarkdown.trim() || exportBackendAnalysisV2Markdown(document);

  const persistDocument = React.useCallback(
    (next: BackendAnalysisDocumentV2) => {
      const tasks = taskRepository.getAllTasks();
      const aligned = ensureCatalogBackendsOnDocument(next, manualEntries, tasks);
      const md = exportBackendAnalysisV2Markdown(aligned);
      const normalized = normalizeBackendAnalysisUxDocument(aligned, { sourceMarkdown: md });
      onPersistCatalog(
        patchAgentBackendAnalysisBundle(backendCatalog, agentTaskId, {
          analysisDocument: normalized,
          analysisMarkdown: md,
        })
      );
    },
    [backendCatalog, agentTaskId, manualEntries, onPersistCatalog]
  );

  const openParameterPanel = React.useCallback((target: ParameterAnalysisPanelTarget) => {
    setParameterPanel(target);
  }, []);

  const closeParameterPanel = React.useCallback(() => {
    setParameterPanel(null);
  }, []);

  const resolveParam = React.useCallback(
    (catalogEntryId: string, paramKey: string) =>
      resolveParameterAnalysis(backendCatalog, agentTaskId, catalogEntryId, paramKey),
    [backendCatalog, agentTaskId]
  );

  const value = React.useMemo(
    (): AgentBackendAnalysisContextValue => ({
      agentTaskId,
      document,
      analysisMarkdown,
      analysisLaunched,
      manualEntries,
      persistDocument,
      parameterPanel,
      openParameterPanel,
      closeParameterPanel,
      resolveParam,
      editingParam,
      setEditingParam,
    }),
    [
      agentTaskId,
      document,
      analysisMarkdown,
      analysisLaunched,
      manualEntries,
      persistDocument,
      parameterPanel,
      openParameterPanel,
      closeParameterPanel,
      resolveParam,
      editingParam,
    ]
  );

  return (
    <AgentBackendAnalysisContext.Provider value={value}>
      {children}
    </AgentBackendAnalysisContext.Provider>
  );
}
