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
import { catalogEntryHasSubstantiveAnalysis } from '@domain/backendAnalysis/mergeCatalogEntryAnalysis';
import { realignBackendParametersFromOpenApiTask } from '@domain/backendAnalysis/realignBackendParametersFromOpenApiTask';
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
  persistDocument: (
    next: BackendAnalysisDocumentV2,
    options?: { sectionBaselines?: Record<string, string> }
  ) => void;
  /** Dopo Read API: allinea parametri analisi alla firma OpenAPI sul task. */
  syncAfterOpenApiRefresh: (catalogEntryId: string) => void;
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

  const catalogRef = React.useRef(backendCatalog);
  catalogRef.current = backendCatalog;

  const buildDocumentFromBundle = React.useCallback((): BackendAnalysisDocumentV2 => {
    const tasks = taskRepository.getAllTasks();
    const bundleNow = readAgentBackendAnalysisBundle(catalogRef.current, agentTaskId);
    let raw: ReturnType<typeof ensureCatalogBackendsOnDocument>;
    if (bundleNow.analysisDocument && Object.keys(bundleNow.analysisDocument.backends).length > 0) {
      raw = ensureCatalogBackendsOnDocument(bundleNow.analysisDocument, manualEntries, tasks);
    } else if (bundleNow.analysisMarkdown.trim()) {
      raw = markdownToBackendAnalysisV2(bundleNow.analysisMarkdown, manualEntries, tasks);
    } else {
      raw = ensureCatalogBackendsOnDocument(bundleNow.analysisDocument, manualEntries, tasks);
    }
    const sourceMarkdown =
      bundleNow.analysisMarkdown.trim() || bundleNow.agentAnalysisBaselineMarkdown.trim();
    return normalizeBackendAnalysisUxDocument(raw, { sourceMarkdown });
  }, [agentTaskId, manualEntries]);

  const bundle = React.useMemo(
    () => readAgentBackendAnalysisBundle(backendCatalog, agentTaskId),
    [backendCatalog, agentTaskId]
  );

  const [tasksIoRevision, setTasksIoRevision] = React.useState(0);

  const document = React.useMemo(() => {
    void tasksIoRevision;
    return buildDocumentFromBundle();
  }, [buildDocumentFromBundle, bundle, tasksIoRevision]);

  const analysisLaunched = Boolean(bundle.agentAnalysisBaselineMarkdown.trim());
  const analysisMarkdown =
    bundle.analysisMarkdown.trim() || exportBackendAnalysisV2Markdown(document);

  const persistDocument = React.useCallback(
    (
      next: BackendAnalysisDocumentV2,
      options?: { sectionBaselines?: Record<string, string> }
    ) => {
      const tasks = taskRepository.getAllTasks();
      const aligned = ensureCatalogBackendsOnDocument(next, manualEntries, tasks);
      const md = exportBackendAnalysisV2Markdown(aligned);
      const normalized = normalizeBackendAnalysisUxDocument(aligned, { sourceMarkdown: md });
      const bundleNow = readAgentBackendAnalysisBundle(catalogRef.current, agentTaskId);
      const bootstrapBaseline =
        !bundleNow.agentAnalysisBaselineMarkdown.trim() && md.trim()
          ? { agentAnalysisBaselineMarkdown: md }
          : {};
      onPersistCatalog(
        patchAgentBackendAnalysisBundle(catalogRef.current, agentTaskId, {
          analysisDocument: normalized,
          analysisMarkdown: md,
          ...bootstrapBaseline,
          ...(options?.sectionBaselines
            ? { sectionBaselines: options.sectionBaselines }
            : {}),
        })
      );
    },
    [agentTaskId, manualEntries, onPersistCatalog]
  );

  const syncAfterOpenApiRefresh = React.useCallback(
    (catalogEntryId: string) => {
      const task = taskRepository.getTask(catalogEntryId);
      if (!task) return;
      const entry = manualEntries.find((e) => e.id === catalogEntryId);
      const baseDoc = buildDocumentFromBundle();
      const realigned = realignBackendParametersFromOpenApiTask(
        baseDoc,
        catalogEntryId,
        task,
        entry?.label?.trim()
      );
      const prevBackend = baseDoc.backends[catalogEntryId];
      const invalidateAnalysisHash =
        prevBackend && catalogEntryHasSubstantiveAnalysis(prevBackend);
      const nextBackend = realigned.backends[catalogEntryId];
      const docToPersist =
        invalidateAnalysisHash && nextBackend
          ? {
              ...realigned,
              backends: {
                ...realigned.backends,
                [catalogEntryId]: {
                  ...nextBackend,
                  analysisOpenApiContentHash: null,
                },
              },
            }
          : realigned;
      persistDocument(docToPersist);
      setTasksIoRevision((r) => r + 1);
    },
    [buildDocumentFromBundle, manualEntries, persistDocument]
  );

  React.useEffect(() => {
    const onComplete = (ev: Event) => {
      const taskId = (ev as CustomEvent<{ taskId?: string }>).detail?.taskId?.trim();
      if (!taskId || !manualEntries.some((e) => e.id === taskId)) return;
      syncAfterOpenApiRefresh(taskId);
    };
    window.addEventListener('omnia:backend-read-api-complete', onComplete);
    return () => window.removeEventListener('omnia:backend-read-api-complete', onComplete);
  }, [manualEntries, syncAfterOpenApiRefresh]);

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
      syncAfterOpenApiRefresh,
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
      syncAfterOpenApiRefresh,
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
