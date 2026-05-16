/**
 * Tab Dockview "Backends": catalogo manuale (accordion).
 * Header collassato: nome, URL, metodo / Recupera. Espanso: Tool + elimina, descrizione, SEND/RECEIVE allineati alla colonna URL.
 */

import React from 'react';
import type { IDockviewPanelProps } from 'dockview';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  GitBranchPlus,
  Loader2,
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
import { AddBackendDropdown } from './AddBackendDropdown';
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
  /** Dopo un tentativo «Recupera specifiche» fallito: URL in rosso finché l’utente non modifica l’URL. */
  const [urlMarkedUnreachable, setUrlMarkedUnreachable] = React.useState(false);
  const urlInputRef = React.useRef<HTMLInputElement>(null);
  const labelInputRef = React.useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const showIdentity = showBackendIdentityFields(entry);
  /** Import: pannello SEND/RECEIVE solo dopo import validato; emulate: sempre se espanso. */
  const canShowParameterPanel = creationMode === 'emulate' || showIdentity;
  const fieldCls = wizardUi ? 'text-sm' : 'text-xs';
  const fieldPad = wizardUi ? 'px-2 py-1' : 'px-2 py-1';
  const monoCls = wizardUi ? 'text-sm font-mono' : 'text-xs font-mono';
  /** Altezza unica per tutti i controlli della barra accordion (URL, nome, pulsanti). */
  const barH = 'h-9 min-h-[2.25rem]';
  const inputShellBase = `${barH} box-border rounded border bg-slate-950 ${fieldPad} ${monoCls} outline-none transition-colors focus-visible:border-slate-500 focus-visible:ring-1 focus-visible:ring-slate-500/35`;
  /** Campi a larghezza piena (emulate nome, textarea). Non usarlo per i chip in barra import: `w-full` forza un wrap su riga dedicata. */
  const inputShell = `${inputShellBase} w-full min-w-0`;
  /** Nome interno in barra (sola lettura / preview): larghezza contenuta, stesso shell senza `w-full`. */
  const inputShellBarReadonly = `${inputShellBase} w-[min(12rem,32vw)] max-w-[min(18rem,48vw)] shrink-0 cursor-default`;

  const editorTask = React.useMemo(() => {
    if (!expanded || !canShowParameterPanel) return null;
    return ensureManualCatalogBackendTask(entry, projectId);
  }, [expanded, canShowParameterPanel, entry, projectId]);

  const applyHeaderEndpoint = React.useCallback(
    (url: string, method: string) => {
      setUrlMarkedUnreachable(false);
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

  const resizeDescriptionTextarea = React.useCallback(() => {
    const el = descriptionTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const cap = typeof window !== 'undefined' ? Math.floor(window.innerHeight * 0.42) : 360;
    const h = Math.min(Math.max(el.scrollHeight, 40), cap);
    el.style.height = `${h}px`;
  }, []);

  React.useLayoutEffect(() => {
    if (!expanded || !showIdentity) return;
    resizeDescriptionTextarea();
  }, [expanded, headerToolDescription, resizeDescriptionTextarea, showIdentity]);

  React.useEffect(() => {
    if (!focusName) return;
    const el =
      creationMode === 'emulate' ? labelInputRef.current : urlInputRef.current;
    if (!el) return;
    el.focus();
    onNameFocused?.();
  }, [creationMode, focusName, onNameFocused]);

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
    if (!url) return;
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
        setUrlMarkedUnreachable(true);
        return;
      }
      setUrlMarkedUnreachable(false);
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
    } catch {
      setUrlMarkedUnreachable(true);
    } finally {
      setReadBusy(false);
    }
  }, [
    entry,
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

  const backendIdentifierDisplay =
    entry.label.trim() || deriveBackendLabelFromUrl(entry.endpointUrl.trim()) || entry.id;

  const urlPlaceholder =
    creationMode === 'import' && !showIdentity
      ? 'Inserisci URL del backend'
      : 'https://… o …/v3/api-docs';

  const internalPreviewFromUrl = deriveBackendLabelFromUrl(entry.endpointUrl.trim());
  const retrieveBtnCls = `inline-flex ${barH} shrink-0 items-center gap-1.5 rounded border border-violet-600/80 bg-violet-950/50 px-2.5 text-xs font-semibold text-violet-100 hover:bg-violet-900/60 disabled:pointer-events-none disabled:opacity-45`;
  const chevronWrapCls = `flex ${barH} w-9 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-800`;
  const headerPadX = wizardUi ? 'px-3' : 'px-2';
  /** URL: larghezza legata al contenuto dove supportato (field-sizing). */
  const urlSizing = 'min-w-0 [field-sizing:content] w-max max-w-full shrink';

  return (
    <div
      className={`grid min-h-0 grid-cols-1 overflow-hidden rounded-lg border border-slate-700/55 bg-slate-950/35 ${
        expanded ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-rows-[auto_minmax(0,0fr)]'
      }`}
      data-convai-tool-backend-id={entry.id}
    >
      {/* Header: solo chevron + nome + URL + metodo/Recupera (una riga visibile anche da collassato). */}
      <div
        className={`flex shrink-0 items-stretch gap-2 border-b border-slate-800/65 bg-slate-950/50 py-2 ${headerPadX}`}
      >
        <div className="flex w-9 shrink-0 items-center justify-center self-center">
          <button
            type="button"
            className={chevronWrapCls}
            onClick={onToggle}
            aria-expanded={expanded}
            title={expanded ? 'Comprimi' : 'Espandi'}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0">
          <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
            {creationMode === 'emulate' ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <input
                  id={`${entry.id}-internal-name`}
                  ref={labelInputRef}
                  type="text"
                  className={`${inputShell} min-w-0 flex-1 border-slate-600/70 text-amber-100/90 focus:border-sky-600/60 focus:ring-sky-500/35`}
                  value={entry.label}
                  onChange={(e) =>
                    onPatch(entry.id, {
                      label: e.target.value,
                      lastStructuralEditAt: new Date().toISOString(),
                    })
                  }
                  placeholder="Internal name (e.g. bookfromagenda)"
                  title="Internal backend name (manual specs; no OpenAPI URL required)."
                  aria-label="Internal backend name"
                />
                <button
                  type="button"
                  className={`${chevronWrapCls} shrink-0 text-red-400 hover:bg-slate-800/80 hover:text-red-300`}
                  title="Rimuovi backend dal catalogo"
                  aria-label="Rimuovi backend"
                  onClick={() => onRemove(entry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            {creationMode === 'import' && !showIdentity ? (
              <>
                <input
                  ref={urlInputRef}
                  type="text"
                  className={`${inputShellBase} min-w-0 shrink ${urlSizing} ${
                    urlMarkedUnreachable
                      ? 'border-red-700/70 text-red-400 placeholder:text-red-400/60'
                      : 'border-slate-700 text-amber-100/95 placeholder:text-slate-600'
                  }`}
                  value={entry.endpointUrl}
                  onChange={(e) => applyHeaderEndpoint(e.target.value, entry.method || 'GET')}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || e.shiftKey) return;
                    const u = entry.endpointUrl.trim();
                    if (!u || readBusy) return;
                    e.preventDefault();
                    void runReadApiCollapsed();
                  }}
                  placeholder={urlPlaceholder}
                  title="URL del documento OpenAPI o dell’API da importare. Invio: recupera specifiche e apre la firma."
                  aria-label="Backend URL"
                />
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  className={`${inputShellBarReadonly} border-slate-700 bg-slate-900/85 text-amber-100/90`}
                  value={internalPreviewFromUrl}
                  placeholder="—"
                  aria-label="Internal name (preview until import)"
                  title="Preview from URL; becomes fixed after a successful import."
                />
                <button
                  type="button"
                  disabled={readBusy || !entry.endpointUrl.trim()}
                  onClick={() => void runReadApiCollapsed()}
                  className={retrieveBtnCls}
                  title="Scarica swagger e compila SEND/RECEIVE"
                >
                  {readBusy ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  <span className="whitespace-nowrap">Recupera specifiche</span>
                </button>
                <button
                  type="button"
                  className={`${chevronWrapCls} shrink-0 text-red-400 hover:bg-slate-800/80 hover:text-red-300`}
                  title="Rimuovi backend dal catalogo"
                  aria-label="Rimuovi backend"
                  onClick={() => onRemove(entry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : null}
            {creationMode === 'import' && showIdentity ? (
              <>
                <input
                  ref={urlInputRef}
                  type="text"
                  className={`${inputShellBase} min-w-0 shrink ${urlSizing} ${
                    urlMarkedUnreachable
                      ? 'border-red-700/70 text-red-400 placeholder:text-red-400/60'
                      : 'border-slate-700 text-amber-100/95 placeholder:text-slate-600'
                  }`}
                  value={entry.endpointUrl}
                  onChange={(e) => applyHeaderEndpoint(e.target.value, entry.method || 'GET')}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || e.shiftKey) return;
                    const u = entry.endpointUrl.trim();
                    if (!u || readBusy) return;
                    e.preventDefault();
                    void runReadApiCollapsed();
                  }}
                  placeholder={urlPlaceholder}
                  title="Endpoint of the backend service (editable). Turns red if «Recupera specifiche» cannot reach this URL; editing clears the warning."
                  aria-label="Backend URL"
                />
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  className={`${inputShellBarReadonly} border-slate-600/70 bg-slate-900/80 text-amber-100/90`}
                  value={backendIdentifierDisplay}
                  aria-label="Internal backend name"
                  title="Set after successful OpenAPI import"
                />
                {httpMethodOpenApiUi.locked ? (
                  <span
                    className={`inline-flex ${barH} shrink-0 items-center rounded border border-slate-700 bg-slate-900/90 px-2 font-semibold text-slate-200 ${fieldCls}`}
                    title="Metodo HTTP definito dallo Swagger/OpenAPI"
                  >
                    {httpMethodOpenApiUi.display}
                  </span>
                ) : (
                  <select
                    className={`${barH} shrink-0 rounded border border-slate-700 bg-slate-950 px-2 ${fieldCls} text-slate-200 outline-none focus-visible:ring-1 focus-visible:ring-slate-500/40`}
                    value={normalizeMethod(entry.method) === 'POST' ? 'POST' : 'GET'}
                    onChange={(e) => applyHeaderEndpoint(entry.endpointUrl, e.target.value)}
                    title="Metodo HTTP"
                    aria-label="HTTP method"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                )}
                <button
                  type="button"
                  disabled={readBusy || !entry.endpointUrl.trim()}
                  onClick={() => void runReadApiCollapsed()}
                  className={retrieveBtnCls}
                  title="Aggiorna parametri da OpenAPI"
                >
                  {readBusy ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  <span className="whitespace-nowrap">Recupera specifiche</span>
                </button>
                <button
                  type="button"
                  className={`${chevronWrapCls} shrink-0 text-red-400 hover:bg-slate-800/80 hover:text-red-300`}
                  title="Rimuovi backend dal catalogo"
                  aria-label="Rimuovi backend"
                  onClick={() => onRemove(entry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>
          </div>
      </div>

      {expanded ? (
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <div className={`flex min-h-0 min-w-0 flex-1 gap-2 overflow-hidden pt-0 pb-2 ${headerPadX}`}>
            <div className="w-9 shrink-0" aria-hidden />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
              {showIdentity ? (
                <div className="min-w-0 shrink-0">
                  <textarea
                    ref={descriptionTextareaRef}
                    rows={1}
                    spellCheck
                    wrap="soft"
                    aria-label="Descrizione backend (ConvAI / tool)"
                    className={`box-border w-full min-h-0 max-h-[42vh] resize-y overflow-y-auto border-0 bg-transparent px-0 py-0 ${fieldCls} whitespace-pre-wrap break-words text-slate-100 shadow-none outline-none ring-0 transition-[height] duration-75 ease-out placeholder:text-slate-600 focus:ring-0 focus-visible:ring-0`}
                    value={headerToolDescription}
                    onChange={(e) => {
                      applyHeaderToolDescription(e.target.value);
                      requestAnimationFrame(() => resizeDescriptionTextarea());
                    }}
                    placeholder="Descrizione del backend (ConvAI / tool)…"
                    title="Editable description of the backend; expands automatically when text grows."
                  />
                </div>
              ) : null}

              {convaiToolToggle ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      className="mt-0"
                      checked={convaiToolToggle.checked}
                      onChange={(e) => convaiToolToggle.onChange(e.target.checked)}
                      title="Includi come tool ConvAI (function calling) per questo agente"
                    />
                    <span>Tool</span>
                  </label>
                </div>
              ) : null}

              {editorTask ? (
                <div className="flex h-[min(88dvh,920px)] min-h-[240px] flex-1 flex-col overflow-hidden">
                  <EmbeddedBackendCallEditor
                    key={editorTask.id}
                    task={editorTask}
                    endpointExternalRevision={endpointRev}
                    hideEndpointRow={creationMode === 'import'}
                  />
                </div>
              ) : expanded && !canShowParameterPanel ? (
                <p className="shrink-0 text-xs leading-snug text-slate-500">
                  Recupera le specifiche OpenAPI dall&apos;intestazione per configurare SEND e RECEIVE.
                </p>
              ) : null}
            </div>
          </div>
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
    setExpandedIds(() => new Set());
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
          <AddBackendDropdown
            wizardUi={wizardUi}
            onAddExisting={() => addManualBackend('import')}
            onCreateSpecs={() => addManualBackend('emulate')}
          />
          {manualEntries.length > 0 ? (
            <span className="text-xs tabular-nums text-slate-500">
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
            className="inline-flex min-h-[2rem] w-fit max-w-full shrink-0 items-center gap-1.5 rounded border border-violet-600/70 bg-violet-950/40 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-violet-100 hover:bg-violet-900/55"
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
