/**
 * Tab Dockview "Backends": catalogo manuale (accordion URL → descrizione → editor).
 * ElevenLabs: checkbox «Tool» per `convaiBackendToolTaskIds`; Fix SEND espande lo stesso accordion.
 */

import React from 'react';
import type { IDockviewPanelProps } from 'dockview';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  GitBranchPlus,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { runBackendCallReadApiForTask } from '@services/runBackendCallReadApiForTask';
import { taskRepository } from '@services/TaskRepository';
import { useProjectData, useProjectDataUpdate } from '@context/ProjectDataContext';
import {
  deriveBackendLabelFromUrl,
  type ManualBackendCreationMode,
  type ManualCatalogEntry,
} from '@domain/backendCatalog';
import type { BackendCallSpecMeta } from '@domain/backendCatalog/catalogTypes';
import { collectReachableBackendCallTaskIdsFromFlow } from '@domain/iaAgentTools/collectReachableBackendCallTaskIdsFromFlow';
import { deriveBackendToolDefinition } from '@domain/iaAgentTools/backendToolDerivation';
import { appendAuditEntry } from '../../../../../application/backendCatalog/appendOnlyAuditLog';
import { generateSafeGuid } from '@utils/idGenerator';
import type { ProjectData } from '@types/project';
import type { Task } from '@types/taskTypes';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import { getVisibleFields } from '@utils/iaAgentRuntime/platformHelpers';
import { useOptionalAIAgentEditorDock } from './AIAgentEditorDockContext';
import { EmbeddedBackendCallEditor } from './EmbeddedBackendCallEditor';
import { ensureManualCatalogBackendTask } from './ensureManualCatalogBackendTask';
import { ConnectPortalModal } from '@components/portalAuth/ConnectPortalModal';
import type { PortalConnectionMeta } from '@domain/portalAuth/portalConnectionTypes';
import { upsertProjectPortalConnection } from '@domain/portalAuth/projectPortalConnections';
import { normalizePortalOrigin } from '@domain/portalAuth/normalizePortalOrigin';
import { resolvePortalConnectionForUrl } from '@domain/portalAuth/resolvePortalConnectionId';
import { PORTAL_AUTH_REQUIRED_CODE } from '@domain/portalAuth/portalConnectionTypes';

/** Canvas del flow per «Aggiungi da canvas» (stesso contratto della vecchia BackendToolsSection). */
type ConvaiBackendToolsDiscoveryContext = {
  aiAgentTaskId: string;
  flow: { nodes: unknown[]; edges: unknown[] };
};

function normalizeMethod(m: string | undefined): string {
  return (m || 'GET').toUpperCase();
}

/** Import: Nome/Descrizione solo dopo Recupera; emulate: subito. */
function showBackendIdentityFields(entry: ManualCatalogEntry): boolean {
  const mode = entry.creationMode ?? 'import';
  if (mode === 'emulate') return true;
  return Boolean(entry.importSpecRevealed || entry.frozenMeta?.importState === 'ok');
}

function ManualBackendAccordion({
  entry,
  expanded,
  projectId,
  projectData,
  onToggle,
  onPatch,
  onRemove,
  onExpandEntry,
  convaiToolToggle,
  onPortalAuthRequired,
  onSyncPortalConnection,
  autoFetchAfterPortalEntryId,
  onAutoFetchConsumed,
  creationMode,
  wizardUi,
  focusName,
  onNameFocused,
}: {
  entry: ManualCatalogEntry;
  expanded: boolean;
  projectId: string | undefined;
  projectData: ProjectData | null | undefined;
  onToggle: () => void;
  onPatch: (id: string, patch: Partial<ManualCatalogEntry>) => void;
  onRemove: (id: string) => void;
  onExpandEntry: (id: string) => void;
  /** ElevenLabs: includi questo backend nei tool ConvAI dell’agente. */
  convaiToolToggle?: { checked: boolean; onChange: (checked: boolean) => void };
  onPortalAuthRequired: (origin: string, entryId: string) => void;
  onSyncPortalConnection: (meta: PortalConnectionMeta) => void;
  /** Dopo OAuth: ritenta Recupera specifiche una volta. */
  autoFetchAfterPortalEntryId: string | null;
  onAutoFetchConsumed: () => void;
  creationMode: ManualBackendCreationMode;
  /** Wizard passo Backend: tipografia più leggibile (text-sm). */
  wizardUi?: boolean;
  focusName?: boolean;
  onNameFocused?: () => void;
}) {
  const [endpointRev, setEndpointRev] = React.useState(0);
  const [readBusy, setReadBusy] = React.useState(false);
  const [headerToolDescription, setHeaderToolDescription] = React.useState('');
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const showIdentity = showBackendIdentityFields(entry);
  const fieldCls = wizardUi
    ? 'text-sm'
    : 'text-[11px]';
  const fieldPad = wizardUi ? 'px-2 py-1' : 'px-1.5 py-0.5';
  const monoCls = wizardUi ? 'text-sm font-mono' : 'text-[10px] font-mono';

  const editorTask = React.useMemo(() => {
    if (!expanded) return null;
    return ensureManualCatalogBackendTask(entry, projectId);
  }, [expanded, entry, projectId]);

  const applyHeaderEndpoint = React.useCallback(
    (url: string, method: string) => {
      const methodNorm = normalizeMethod(method);
      const trimmed = url.trim();
      onPatch(entry.id, {
        endpointUrl: trimmed,
        method: methodNorm,
        lastStructuralEditAt: new Date().toISOString(),
      });
      ensureManualCatalogBackendTask(
        { ...entry, endpointUrl: trimmed, method: methodNorm },
        projectId
      );
      setEndpointRev((r) => r + 1);
    },
    [entry, onPatch, projectId]
  );

  const applyHeaderToolDescription = React.useCallback(
    (text: string) => {
      setHeaderToolDescription(text);
      ensureManualCatalogBackendTask(entry, projectId);
      taskRepository.updateTask(entry.id, { backendToolDescription: text } as Partial<Task>, projectId);
    },
    [entry, projectId]
  );

  React.useEffect(() => {
    ensureManualCatalogBackendTask(entry, projectId);
    const t = taskRepository.getTask(entry.id);
    setHeaderToolDescription(String((t as Task)?.backendToolDescription ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- usiamo `entry` solo al run; dipendenze strette per non resettare la descrizione a ogni rerender del parent
  }, [entry.id, endpointRev, projectId]);

  React.useEffect(() => {
    if (!focusName || !nameInputRef.current) return;
    nameInputRef.current.focus();
    onNameFocused?.();
  }, [focusName, onNameFocused]);

  const wasExpandedRef = React.useRef(false);
  React.useEffect(() => {
    if (expanded && !wasExpandedRef.current) {
      ensureManualCatalogBackendTask(entry, projectId);
      const t = taskRepository.getTask(entry.id);
      setHeaderToolDescription(String((t as Task)?.backendToolDescription ?? ''));
    }
    wasExpandedRef.current = expanded;
  }, [expanded, entry, projectId]);

  const runReadApiCollapsed = React.useCallback(async () => {
    const url = entry.endpointUrl.trim();
    if (!url || expanded) return;
    setReadBusy(true);
    try {
      ensureManualCatalogBackendTask(entry, projectId);
      const method = normalizeMethod(entry.method);
      const t = taskRepository.getTask(entry.id);
      const spec =
        t && typeof (t as { openapiSpecUrl?: string }).openapiSpecUrl === 'string'
          ? String((t as { openapiSpecUrl: string }).openapiSpecUrl).trim()
          : '';
      const portalMeta = await resolvePortalConnectionForUrl(projectData, projectId, url, entry);
      const portalConnectionId = portalMeta?.id;
      if (portalMeta) {
        onSyncPortalConnection(portalMeta);
        if (portalConnectionId && portalConnectionId !== entry.portalConnectionId) {
          onPatch(entry.id, { portalConnectionId });
          taskRepository.updateTask(
            entry.id,
            { portalConnectionId } as Partial<Task>,
            projectId
          );
        }
      }
      const res = await runBackendCallReadApiForTask(entry.id, projectId, url, method, {
        openapiSpecUrl: spec || undefined,
        portalConnectionId,
      });
      if (!res.ok) {
        if (
          !portalConnectionId &&
          (res.portalAuth?.code === PORTAL_AUTH_REQUIRED_CODE || res.portalAuth?.code)
        ) {
          let authOrigin = (res.portalAuth.origin || '').trim();
          if (!authOrigin) {
            try {
              authOrigin = normalizePortalOrigin(url);
            } catch {
              /* ignore */
            }
          }
          if (authOrigin) {
            onPortalAuthRequired(authOrigin, entry.id);
            return;
          }
        }
        window.alert(res.error);
        return;
      }
      if (portalConnectionId && portalConnectionId !== entry.portalConnectionId) {
        onPatch(entry.id, { portalConnectionId });
        taskRepository.updateTask(
          entry.id,
          { portalConnectionId } as Partial<Task>,
          projectId
        );
      }
      const tAfter = taskRepository.getTask(entry.id);
      const derivedLabel =
        entry.label.trim() || deriveBackendLabelFromUrl(url);
      const toolDesc = String((tAfter as Task)?.backendToolDescription ?? '').trim();
      onPatch(entry.id, {
        importSpecRevealed: true,
        label: derivedLabel,
        frozenMeta: {
          ...entry.frozenMeta,
          importState: 'ok',
          lastImportedAt: new Date().toISOString(),
        },
      });
      if (toolDesc) setHeaderToolDescription(toolDesc);
      setEndpointRev((r) => r + 1);
      onExpandEntry(entry.id);
    } finally {
      setReadBusy(false);
    }
  }, [
    entry,
    expanded,
    onExpandEntry,
    onPatch,
    onPortalAuthRequired,
    onSyncPortalConnection,
    projectData,
    projectId,
  ]);

  const portalAutoFetchGuardRef = React.useRef(false);
  React.useEffect(() => {
    if (autoFetchAfterPortalEntryId !== entry.id) return;
    if (portalAutoFetchGuardRef.current) return;
    if (!entry.endpointUrl.trim()) {
      onAutoFetchConsumed();
      return;
    }
    portalAutoFetchGuardRef.current = true;
    void runReadApiCollapsed().finally(() => {
      portalAutoFetchGuardRef.current = false;
      onAutoFetchConsumed();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo dopo OAuth (autoFetchAfterPortalEntryId)
  }, [autoFetchAfterPortalEntryId, entry.id]);

  /** Dopo reveal: label default dall’URL se ancora vuota. */
  React.useEffect(() => {
    if (!showIdentity) return;
    const url = entry.endpointUrl.trim();
    if (!url || entry.label.trim() !== '') return;
    onPatch(entry.id, { label: deriveBackendLabelFromUrl(url) });
  }, [entry.endpointUrl, entry.id, entry.label, onPatch, showIdentity]);

  const httpMethodOpenApiUi = React.useMemo(() => {
    void endpointRev;
    const t = taskRepository.getTask(entry.id);
    const meta = (t as Task & { backendCallSpecMeta?: BackendCallSpecMeta })?.backendCallSpecMeta;
    const urlTrim = entry.endpointUrl.trim();
    const locked =
      Boolean(meta?.openApiMethodLocked && meta.importState === 'ok') &&
      (meta.openApiMethodLockUrlSnapshot ?? '').trim() === urlTrim;
    const ep = (t as Task & { endpoint?: { method?: string } })?.endpoint;
    const methodNorm = normalizeMethod(ep?.method ?? entry.method);
    const display = locked && meta?.openApiLockedHttpMethod ? normalizeMethod(meta.openApiLockedHttpMethod) : methodNorm;
    return { locked, display };
  }, [entry.endpointUrl, entry.id, entry.method, endpointRev]);

  React.useEffect(() => {
    const h = (ev: Event) => {
      const id = String((ev as CustomEvent<{ taskId?: string }>).detail?.taskId ?? '').trim();
      if (id && id === entry.id) setEndpointRev((r) => r + 1);
    };
    window.addEventListener('omnia:backend-read-api-complete', h as EventListener);
    return () => window.removeEventListener('omnia:backend-read-api-complete', h as EventListener);
  }, [entry.id]);

  /** Normalizza verbi legacy quando il metodo è libero (solo GET/POST). */
  React.useEffect(() => {
    if (httpMethodOpenApiUi.locked) return;
    const m = normalizeMethod(entry.method);
    if (m === 'GET' || m === 'POST') return;
    onPatch(entry.id, { method: 'GET', lastStructuralEditAt: new Date().toISOString() });
  }, [entry.id, entry.method, httpMethodOpenApiUi.locked, onPatch]);

  /** Keep catalog URL/method aligned with task edits (editor persists on task). */
  React.useEffect(() => {
    const id = entry.id;
    const sync = () => {
      const t = taskRepository.getTask(id);
      if (!t) return;
      const ep = (t as { endpoint?: { url?: string; method?: string } }).endpoint;
      const url =
        ep && typeof ep === 'object' && typeof ep.url === 'string' ? ep.url.trim() : '';
      const method =
        ep && typeof ep === 'object' && typeof ep.method === 'string'
          ? normalizeMethod(ep.method)
          : 'GET';
      const catUrl = entry.endpointUrl.trim();
      const catMethod = normalizeMethod(entry.method);
      if (url !== catUrl || method !== catMethod) {
        onPatch(id, {
          endpointUrl: url,
          method,
          lastStructuralEditAt: new Date().toISOString(),
        });
      }
    };
    const h = window.setInterval(sync, 1200);
    sync();
    return () => clearInterval(h);
  }, [entry.endpointUrl, entry.id, entry.method, onPatch]);

  return (
    <div
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-700/90 bg-slate-900/60"
      data-convai-tool-backend-id={entry.id}
    >
      <div
        className={`flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800/80 bg-slate-950/70 ${wizardUi ? 'px-3 py-2' : 'px-2 py-1.5'}`}
      >
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-800"
          onClick={onToggle}
          aria-expanded={expanded}
          title={expanded ? 'Comprimi' : 'Espandi'}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {convaiToolToggle ? (
          <label
            className={`inline-flex shrink-0 cursor-pointer items-center gap-0.5 text-slate-400 ${wizardUi ? 'text-xs' : 'text-[9px]'}`}
          >
            <input
              type="checkbox"
              className="mt-0"
              checked={convaiToolToggle.checked}
              onChange={(e) => convaiToolToggle.onChange(e.target.checked)}
              title="Includi come tool ConvAI (function calling) per questo agente"
            />
            <span>Tool</span>
          </label>
        ) : null}
        {showIdentity ? (
          <input
            ref={nameInputRef}
            className={`min-w-[5rem] w-[7.5rem] sm:w-[9rem] shrink-0 rounded border border-slate-700 bg-slate-950 ${fieldPad} ${fieldCls} text-slate-100`}
            value={entry.label}
            onChange={(e) => onPatch(entry.id, { label: e.target.value })}
            placeholder="Nome"
            title="Nome nel catalogo backend"
          />
        ) : null}
        {showIdentity ? (
          <input
            type="text"
            className={`min-w-[10rem] flex-1 basis-[14rem] rounded border border-slate-700 bg-slate-950 ${fieldPad} ${fieldCls} text-slate-100`}
            value={headerToolDescription}
            onChange={(e) => applyHeaderToolDescription(e.target.value)}
            placeholder="Descrizione (ConvAI / tool)…"
            title="Quando il modello deve chiamare questa API"
          />
        ) : null}
        <input
          type="text"
          className={`min-w-[10rem] flex-1 basis-[14rem] rounded border border-slate-700 bg-slate-950 ${fieldPad} ${monoCls} text-slate-200`}
          value={entry.endpointUrl}
          onChange={(e) => applyHeaderEndpoint(e.target.value, entry.method || 'GET')}
          placeholder={
            creationMode === 'import' && !showIdentity
              ? 'Inserisci URL del backend'
              : 'https://… o …/v3/api-docs'
          }
          title={
            creationMode === 'import' && !showIdentity
              ? 'URL del documento OpenAPI o dell’API da importare'
              : 'URL swagger o endpoint OpenAPI'
          }
        />
        {showIdentity ? (
          httpMethodOpenApiUi.locked ? (
            <span
              className={`shrink-0 rounded border border-slate-700 bg-slate-900/90 ${fieldPad} font-semibold text-slate-200 select-none cursor-default ${fieldCls}`}
              title="Metodo HTTP definito dallo Swagger/OpenAPI"
            >
              {httpMethodOpenApiUi.display}
            </span>
          ) : (
            <select
              className={`shrink-0 rounded border border-slate-700 bg-slate-950 ${fieldPad} ${fieldCls} text-slate-200`}
              value={normalizeMethod(entry.method) === 'POST' ? 'POST' : 'GET'}
              onChange={(e) => applyHeaderEndpoint(entry.endpointUrl, e.target.value)}
              title="Metodo HTTP"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          )
        ) : null}
        {creationMode === 'import' && !expanded && !showIdentity ? (
          <button
            type="button"
            disabled={readBusy || !entry.endpointUrl.trim()}
            onClick={() => void runReadApiCollapsed()}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded border border-violet-600/80 bg-violet-950/50 font-semibold text-violet-100 hover:bg-violet-900/60 disabled:opacity-45 ${wizardUi ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-[10px]'}`}
            title="Scarica swagger e compila SEND/RECEIVE"
          >
            {readBusy ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
            ) : (
              <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>Recupera specifiche</span>
          </button>
        ) : null}
        {showIdentity && !expanded && entry.endpointUrl.trim() ? (
          <button
            type="button"
            disabled={readBusy}
            onClick={() => void runReadApiCollapsed()}
            className={`inline-flex shrink-0 items-center gap-1 rounded border border-violet-600/80 bg-violet-950/50 text-violet-100 hover:bg-violet-900/60 disabled:opacity-45 ${wizardUi ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-[10px]'}`}
            title="Aggiorna da OpenAPI"
          >
            {readBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
            ) : (
              <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            <span>Recupera specifiche</span>
          </button>
        ) : null}
        <button
          type="button"
          className="shrink-0 rounded p-1 text-red-400 hover:bg-slate-800"
          title="Rimuovi"
          onClick={() => onRemove(entry.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {expanded && editorTask ? (
        <div className="flex h-[min(65vh,520px)] min-h-[240px] flex-col overflow-hidden border-t border-slate-800/50 pt-1">
          <EmbeddedBackendCallEditor
            key={editorTask.id}
            task={editorTask}
            endpointExternalRevision={endpointRev}
          />
        </div>
      ) : null}
    </div>
  );
}

export function EditorBackendsPanel(_props: IDockviewPanelProps) {
  void _props;
  const dockCtx = useOptionalAIAgentEditorDock();
  const { data } = useProjectData();

  const convaiBackendToolsDiscoveryContext = React.useMemo((): ConvaiBackendToolsDiscoveryContext | null => {
    const tid = String(dockCtx?.instanceId ?? '').trim();
    if (!tid) return null;
    const agentTask = taskRepository.getTask(tid);
    const fid = String((agentTask as { authoringFlowCanvasId?: string } | null)?.authoringFlowCanvasId ?? '').trim();
    const flows = data?.flows as Record<string, { nodes?: unknown[]; edges?: unknown[] }> | undefined;
    const flowDoc = fid && flows ? flows[fid] : undefined;
    const nodes = Array.isArray(flowDoc?.nodes) ? flowDoc.nodes : [];
    const edges = Array.isArray(flowDoc?.edges) ? flowDoc.edges : [];
    if (!fid || nodes.length === 0) return null;
    return { aiAgentTaskId: tid, flow: { nodes, edges } };
  }, [dockCtx?.instanceId, data?.flows]);

  const elevenLabsBackendToolsVisible = React.useMemo(() => {
    if (!dockCtx) return false;
    if (dockCtx.iaRuntimeConfig.platform !== 'elevenlabs') return false;
    return getVisibleFields(dockCtx.iaRuntimeConfig.platform).tools;
  }, [dockCtx]);

  const onIaRuntimeFromBackends = React.useCallback(
    (next: IAAgentConfig) => {
      if (!dockCtx) return;
      dockCtx.setIaRuntimeConfig(next);
      dockCtx.persistIaRuntimeOverrideSnapshot(next);
    },
    [dockCtx]
  );
  const pdUpdate = useProjectDataUpdate();
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => new Set());

  const manualEntries = data?.backendCatalog?.manualEntries ?? [];
  const projectId = pdUpdate?.getCurrentProjectId() || undefined;

  const mergeProject = React.useCallback(
    (patch: Partial<NonNullable<ProjectData['backendCatalog']>>) => {
      if (!data || !pdUpdate?.updateDataDirectly) return;
      const prev = data.backendCatalog ?? {
        schemaVersion: 1 as const,
        manualEntries: [],
        auditLog: [],
        catalogVersion: 0,
      };
      pdUpdate.updateDataDirectly({ ...data, backendCatalog: { ...prev, ...patch } });
    },
    [data, pdUpdate]
  );

  const [portalModal, setPortalModal] = React.useState<{ open: boolean; origin: string }>({
    open: false,
    origin: '',
  });
  const pendingPortalEntryRef = React.useRef<string | null>(null);
  const [autoFetchAfterPortalEntryId, setAutoFetchAfterPortalEntryId] = React.useState<string | null>(
    null
  );

  const mergePortalConnections = React.useCallback(
    (meta: PortalConnectionMeta) => {
      if (!data || !pdUpdate?.updateDataDirectly) return;
      const blob = upsertProjectPortalConnection(data, meta);
      pdUpdate.updateDataDirectly({ ...data, portalConnections: blob });
    },
    [data, pdUpdate]
  );

  const handlePortalAuthRequired = React.useCallback((origin: string, entryId: string) => {
    pendingPortalEntryRef.current = entryId;
    setPortalModal({ open: true, origin });
  }, []);

  const handlePortalConnected = React.useCallback(
    (meta: PortalConnectionMeta) => {
      mergePortalConnections(meta);
      const eid = pendingPortalEntryRef.current;
      if (eid) {
        const prev = data?.backendCatalog?.manualEntries ?? [];
        const next = prev.map((e) =>
          e.id === eid ? { ...e, portalConnectionId: meta.id } : e
        );
        mergeProject({
          manualEntries: next,
          catalogVersion: (data?.backendCatalog?.catalogVersion ?? 0) + 1,
        });
        taskRepository.updateTask(eid, { portalConnectionId: meta.id } as Partial<Task>, projectId);
        setAutoFetchAfterPortalEntryId(eid);
      }
      pendingPortalEntryRef.current = null;
      setPortalModal({ open: false, origin: '' });
    },
    [data?.backendCatalog, mergePortalConnections, mergeProject, projectId]
  );

  const patchManual = React.useCallback(
    (id: string, patch: Partial<ManualCatalogEntry>) => {
      const prev = data?.backendCatalog?.manualEntries ?? [];
      const next = prev.map((e) => {
        if (e.id !== id) return e;
        const merged: ManualCatalogEntry = { ...e, ...patch };
        if (patch.frozenMeta) {
          merged.frozenMeta = { ...e.frozenMeta, ...patch.frozenMeta };
        }
        const urlAfter = merged.endpointUrl.trim();
        if (urlAfter.length > 0 && merged.label.trim() === '') {
          merged.label = deriveBackendLabelFromUrl(urlAfter);
        }
        return merged;
      });
      mergeProject({
        manualEntries: next,
        catalogVersion: (data?.backendCatalog?.catalogVersion ?? 0) + 1,
      });
    },
    [data?.backendCatalog?.catalogVersion, data?.backendCatalog?.manualEntries, mergeProject]
  );

  const removeManual = (id: string) => {
    if (!data?.backendCatalog) return;
    void taskRepository.deleteTask(id, projectId);
    const manualEntriesNext = (data.backendCatalog.manualEntries ?? []).filter((e) => e.id !== id);
    const auditLog = appendAuditEntry(data.backendCatalog.auditLog ?? [], {
      projectId: data.id ?? '',
      kind: 'manual_catalog_crud',
      payload: { op: 'delete', entryId: id },
    });
    mergeProject({
      manualEntries: manualEntriesNext,
      auditLog,
      catalogVersion: (data.backendCatalog.catalogVersion ?? 0) + 1,
    });
    setExpandedIds((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  };

  const [focusNameEntryId, setFocusNameEntryId] = React.useState<string | null>(null);
  const wizardUi = Boolean(dockCtx?.hideBackendsPanelInlineAddButton);

  const addManualBackend = React.useCallback(
    (mode: ManualBackendCreationMode) => {
    const id = generateSafeGuid();
    const now = new Date().toISOString();
    const entry: ManualCatalogEntry = {
      id,
      label: '',
      method: 'GET',
      endpointUrl: '',
      creationMode: mode,
      importSpecRevealed: mode === 'emulate',
      frozenMeta: {
        lastImportedAt: null,
        specSourceUrl: null,
        contentHash: null,
        importState: 'none',
      },
      lastStructuralEditAt: now,
    };
    const prev = data?.backendCatalog ?? {
      schemaVersion: 1 as const,
      manualEntries: [],
      auditLog: [],
      catalogVersion: 0,
    };
    const auditLog = appendAuditEntry(prev.auditLog ?? [], {
      projectId: data?.id ?? '',
      kind: 'manual_catalog_crud',
      payload: { op: 'create', entryId: id },
    });
    mergeProject({
      manualEntries: [...(prev.manualEntries ?? []), entry],
      auditLog,
      catalogVersion: (prev.catalogVersion ?? 0) + 1,
    });
    if (mode === 'emulate') setFocusNameEntryId(id);
    },
    [data?.backendCatalog, data?.id, mergeProject]
  );

  React.useEffect(() => {
    if (!dockCtx) return;
    dockCtx.registerBackendsAddManualHandler(addManualBackend);
    return () => dockCtx.registerBackendsAddManualHandler(null);
  }, [dockCtx, addManualBackend]);

  /** Espandi accordion catalogo quando Fix richiede il backend (prima dell’highlight SEND). */
  React.useEffect(() => {
    const h = (ev: Event) => {
      const id = String((ev as CustomEvent<{ taskInstanceId?: string }>).detail?.taskInstanceId || '').trim();
      if (!id) return;
      setExpandedIds((s) => {
        const manual = data?.backendCatalog?.manualEntries ?? [];
        if (!manual.some((e) => e.id === id)) return s;
        const n = new Set(s);
        n.add(id);
        return n;
      });
    };
    document.addEventListener('omnia:expand-catalog-backend-for-task', h as EventListener);
    return () => document.removeEventListener('omnia:expand-catalog-backend-for-task', h as EventListener);
  }, [data?.backendCatalog?.manualEntries]);

  /** Fix SEND incompleto: espandi accordion catalogo e scroll alla riga (editor già dentro l’accordion). */
  React.useEffect(() => {
    const scope = String(dockCtx?.instanceId ?? '').trim();
    if (!scope) return undefined;
    const h = (ev: Event) => {
      const d = (ev as CustomEvent<{ agentTaskId?: string; backendTaskId?: string }>).detail;
      if (String(d?.agentTaskId || '').trim() !== scope) return;
      const bid = String(d?.backendTaskId || '').trim();
      if (!bid) return;
      setExpandedIds((s) => {
        const manual = data?.backendCatalog?.manualEntries ?? [];
        if (!manual.some((e) => e.id === bid)) return s;
        return new Set(s).add(bid);
      });
      window.setTimeout(() => {
        document
          .querySelector(`[data-convai-tool-backend-id="${bid}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    };
    document.addEventListener('omnia:convai-fix-backend-send', h as EventListener);
    return () => document.removeEventListener('omnia:convai-fix-backend-send', h as EventListener);
  }, [dockCtx?.instanceId, data?.backendCatalog?.manualEntries]);

  const mergeBackendsFromDownstreamFlow = React.useCallback(() => {
    const ctx = convaiBackendToolsDiscoveryContext;
    const cfg = dockCtx?.iaRuntimeConfig;
    if (!ctx?.flow?.nodes?.length || !String(ctx.aiAgentTaskId || '').trim() || !cfg) {
      window.alert(
        'Canvas del flow non disponibile: salva il progetto e apri il task su un canvas dove il nodo contiene questo agente.'
      );
      return;
    }
    const discovered = collectReachableBackendCallTaskIdsFromFlow(ctx.flow, ctx.aiAgentTaskId);
    if (discovered.length === 0) {
      window.alert(
        'Nessun Backend Call trovato a valle (archi uscenti) dal nodo che contiene questo agente.'
      );
      return;
    }
    const nextSet = new Set(cfg.convaiBackendToolTaskIds ?? []);
    const added: string[] = [];
    const skipped: string[] = [];
    for (const id of discovered) {
      if (nextSet.has(id)) continue;
      const t = taskRepository.getTask(id);
      const dr = t
        ? deriveBackendToolDefinition(t)
        : ({ ok: false as const, code: 'missing_task' as const, error: 'Task assente' });
      if (dr.ok) {
        nextSet.add(id);
        added.push(id);
      } else {
        const label = t ? String((t as Task).label ?? '').trim() : '';
        skipped.push(`${label || `${id.slice(0, 8)}…`} — ${dr.error}`);
      }
    }
    onIaRuntimeFromBackends({ ...cfg, convaiBackendToolTaskIds: [...nextSet] });
    const lines = [
      added.length ? `Aggiunti all’elenco tool: ${added.length}.` : 'Nessun nuovo backend idoneo.',
      skipped.length
        ? `Esclusi (manca descrizione ConvAI, label, tipo, ecc.): ${skipped.length}\n${skipped.slice(0, 6).join('\n')}${skipped.length > 6 ? '\n…' : ''}`
        : '',
    ].filter(Boolean);
    window.alert(lines.join('\n\n'));
  }, [convaiBackendToolsDiscoveryContext, dockCtx?.iaRuntimeConfig, onIaRuntimeFromBackends]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-slate-950/50 p-2">
      {/*
        Header in-panel: pulsante «Aggiungi backend» (wizard passo Backend: nascosto — stesso
        controllo nello shell header). Coerente in modalità editor libero (tab Backends).
      */}
      {!dockCtx?.hideBackendsPanelInlineAddButton ? (
        <div className="mb-1.5 flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => addManualBackend('import')}
            aria-label="Aggiungi backend manuale"
            title="Aggiungi una riga backend manuale in fondo all\u2019elenco"
            className={`inline-flex shrink-0 items-center gap-1 rounded border border-violet-600/70 bg-violet-950/40 font-semibold text-violet-100 hover:bg-violet-900/55 ${wizardUi ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-[11px]'}`}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Aggiungi backend
          </button>
          {manualEntries.length > 0 ? (
            <span className="text-[10px] tabular-nums text-slate-500">
              {manualEntries.length} backend manual{manualEntries.length === 1 ? 'e' : 'i'}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5"
        data-ia-runtime-focus="tools"
      >
        {elevenLabsBackendToolsVisible && convaiBackendToolsDiscoveryContext ? (
          <button
            type="button"
            onClick={() => mergeBackendsFromDownstreamFlow()}
            className="inline-flex w-fit max-w-full shrink-0 items-center gap-1 rounded border border-violet-600/70 bg-violet-950/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-100 hover:bg-violet-900/55"
            title="Aggiunge agli id tool ConvAI i Backend Call raggiungibili a valle sul grafo (archi uscenti)."
          >
            <GitBranchPlus className="h-3 w-3 shrink-0" aria-hidden />
            Aggiungi da canvas (a valle)
          </button>
        ) : null}
        {manualEntries.length === 0 ? null : (
          manualEntries.map((e) => {
            const cfg = dockCtx?.iaRuntimeConfig;
            const convaiToolToggle =
              elevenLabsBackendToolsVisible && dockCtx && cfg
                ? {
                    checked: new Set(cfg.convaiBackendToolTaskIds ?? []).has(e.id),
                    onChange: (checked: boolean) => {
                      const next = new Set(cfg.convaiBackendToolTaskIds ?? []);
                      if (checked) next.add(e.id);
                      else next.delete(e.id);
                      onIaRuntimeFromBackends({ ...cfg, convaiBackendToolTaskIds: [...next] });
                    },
                  }
                : undefined;
            return (
              <ManualBackendAccordion
                key={e.id}
                entry={e}
                expanded={expandedIds.has(e.id)}
                projectId={projectId}
                projectData={data}
                creationMode={e.creationMode ?? 'import'}
                wizardUi={wizardUi}
                focusName={focusNameEntryId === e.id}
                onNameFocused={() => setFocusNameEntryId(null)}
                onToggle={() => toggleExpanded(e.id)}
                onPatch={patchManual}
                onRemove={removeManual}
                onExpandEntry={(id) => setExpandedIds((s) => new Set(s).add(id))}
                convaiToolToggle={convaiToolToggle}
                onPortalAuthRequired={handlePortalAuthRequired}
                onSyncPortalConnection={mergePortalConnections}
                autoFetchAfterPortalEntryId={autoFetchAfterPortalEntryId}
                onAutoFetchConsumed={() => setAutoFetchAfterPortalEntryId(null)}
              />
            );
          })
        )}
      </div>
      {projectId ? (
        <ConnectPortalModal
          open={portalModal.open}
          origin={portalModal.origin}
          projectId={projectId}
          onClose={() => {
            pendingPortalEntryRef.current = null;
            setPortalModal({ open: false, origin: '' });
          }}
          onConnected={handlePortalConnected}
        />
      ) : null}
    </div>
  );
}
