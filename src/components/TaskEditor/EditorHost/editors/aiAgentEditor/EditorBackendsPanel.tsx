/**
 * Tab Dockview "Backends": voci manuali catalogo; espansione = stesso editor Response ({@link EmbeddedBackendCallEditor}).
 * L’elenco «Dal grafo e dagli agent» è nel pannello Dati.
 */

import React from 'react';
import type { IDockviewPanelProps } from 'dockview';
import { BookOpen, ChevronDown, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { runBackendCallReadApiForTask } from '@services/runBackendCallReadApiForTask';
import { taskRepository } from '@services/TaskRepository';
import { useProjectData, useProjectDataUpdate } from '@context/ProjectDataContext';
import { deriveBackendLabelFromUrl, type ManualCatalogEntry } from '@domain/backendCatalog';
import { appendAuditEntry } from '../../../../../application/backendCatalog/appendOnlyAuditLog';
import { generateSafeGuid } from '@utils/idGenerator';
import type { ProjectData } from '@types/project';
import { useOptionalAIAgentEditorDock } from './AIAgentEditorDockContext';
import { EmbeddedBackendCallEditor } from './EmbeddedBackendCallEditor';
import { ensureManualCatalogBackendTask } from './ensureManualCatalogBackendTask';

function normalizeMethod(m: string | undefined): string {
  return (m || 'GET').toUpperCase();
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

function ManualBackendAccordion({
  entry,
  expanded,
  projectId,
  onToggle,
  onPatch,
  onRemove,
  onExpandEntry,
}: {
  entry: ManualCatalogEntry;
  expanded: boolean;
  projectId: string | undefined;
  onToggle: () => void;
  onPatch: (id: string, patch: Partial<ManualCatalogEntry>) => void;
  onRemove: (id: string) => void;
  onExpandEntry: (id: string) => void;
}) {
  const [endpointRev, setEndpointRev] = React.useState(0);
  const [readBusy, setReadBusy] = React.useState(false);

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

  const runReadApiCollapsed = React.useCallback(async () => {
    const url = entry.endpointUrl.trim();
    if (!url || expanded) return;
    setReadBusy(true);
    try {
      ensureManualCatalogBackendTask(entry, projectId);
      const method = normalizeMethod(entry.method);
      const res = await runBackendCallReadApiForTask(entry.id, projectId, url, method);
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      setEndpointRev((r) => r + 1);
      onExpandEntry(entry.id);
    } finally {
      setReadBusy(false);
    }
  }, [entry, expanded, onExpandEntry, projectId]);

  /** Progetti salvati con URL ma senza label: applica il default derivato dall’URL una volta in persistenza. */
  React.useEffect(() => {
    const url = entry.endpointUrl.trim();
    if (!url || entry.label.trim() !== '') return;
    onPatch(entry.id, { endpointUrl: entry.endpointUrl });
  }, [entry.endpointUrl, entry.id, entry.label, onPatch]);

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
    <div className="rounded-lg border border-slate-700/90 bg-slate-900/60 overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 bg-slate-950/70 border-b border-slate-800/80">
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-800"
          onClick={onToggle}
          aria-expanded={expanded}
          title={expanded ? 'Comprimi' : 'Espandi'}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <input
          className="min-w-[5rem] w-[7.5rem] sm:w-[9rem] shrink-0 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[11px] text-slate-100"
          value={entry.label}
          onChange={(e) => onPatch(entry.id, { label: e.target.value })}
          placeholder="Nome (default = ultimo segmento URL)"
          title="Nome nel catalogo; se vuoto con URL impostato, si usa l’ultimo segmento del path."
        />
        <input
          type="text"
          className="min-w-[8rem] flex-1 basis-[12rem] rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[10px] font-mono text-slate-200"
          value={entry.endpointUrl}
          onChange={(e) => applyHeaderEndpoint(e.target.value, entry.method || 'GET')}
          placeholder="https://… o …/v3/api-docs"
          title="URL endpoint (stesso dato del Backend Call sotto)"
        />
        <select
          className="shrink-0 rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[10px] text-slate-200"
          value={normalizeMethod(entry.method)}
          onChange={(e) => applyHeaderEndpoint(entry.endpointUrl, e.target.value)}
          title="Metodo HTTP"
        >
          {HTTP_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {!expanded && entry.endpointUrl.trim() ? (
          <button
            type="button"
            disabled={readBusy}
            onClick={() => void runReadApiCollapsed()}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-violet-600/80 bg-violet-950/50 px-2 py-0.5 text-[10px] text-violet-100 hover:bg-violet-900/60 disabled:opacity-45"
            title="Recupera descrizione OpenAPI (poi si espande il pannello)"
          >
            {readBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
            ) : (
              <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            <span>Recupera</span>
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
        <div className="px-0 pt-1 pb-0 border-t border-slate-800/50 min-h-0">
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

  const addEmptyBackend = React.useCallback(() => {
    const id = generateSafeGuid();
    const now = new Date().toISOString();
    const entry: ManualCatalogEntry = {
      id,
      label: '',
      method: 'GET',
      endpointUrl: '',
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
  }, [data?.backendCatalog, data?.id, mergeProject]);

  React.useEffect(() => {
    if (!dockCtx) return;
    dockCtx.registerBackendsAddManualHandler(addEmptyBackend);
    return () => dockCtx.registerBackendsAddManualHandler(null);
  }, [dockCtx, addEmptyBackend]);

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
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5">
        {manualEntries.length === 0 ? (
          <p className="text-[11px] text-slate-600">
            Nessun backend manuale. Usa «Aggiungi» nella scheda Backends sopra.
          </p>
        ) : (
          manualEntries.map((e) => (
            <ManualBackendAccordion
              key={e.id}
              entry={e}
              expanded={expandedIds.has(e.id)}
              projectId={projectId}
              onToggle={() => toggleExpanded(e.id)}
              onPatch={patchManual}
              onRemove={removeManual}
              onExpandEntry={(id) => setExpandedIds((s) => new Set(s).add(id))}
            />
          ))
        )}
      </div>
    </div>
  );
}
