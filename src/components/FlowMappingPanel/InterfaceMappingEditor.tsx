/**
 * Controlled mapping UI: backend SEND/RECEIVE or subflow INPUT/OUTPUT tree blocks.
 * Used by UnifiedFlowMappingPanel (demo) and BackendCallEditor (persisted task rows).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brackets } from 'lucide-react';
import { MappingBlock } from './MappingBlock';
import { FlowMappingTree, DND_NEW_BACKEND_PARAM, DND_TYPE } from './FlowMappingTree';
import {
  FLOW_BACKEND_MAPPING_POINTER_DROP,
  type FlowBackendMappingPointerDropDetail,
  type FlowInterfaceDropPayload,
} from './flowInterfaceDragTypes';
import { mergeBackendMappingVariableDrop } from './backendMappingVariableDrop';
import type { FlowMappingVariant } from './types';
import { createMappingEntry, type MappingEntry } from './mappingTypes';
import {
  computeInterfaceEntryLabels,
  ensureFlowVariableBindingForInterfaceRow,
  shouldSkipInterfaceDuplicate,
} from './interfaceMappingLabels';
import { useContainerWidth } from './useContainerWidth';

/** Draggable chip in SEND/RECEIVE headers: drop on tree to insert a new parameter. */
export function BackendParameterDragChip() {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_NEW_BACKEND_PARAM, 'new');
        e.dataTransfer.effectAllowed = 'copy';
      }}
      title="Trascina nel tree per aggiungere un parametro"
      className="flex items-center gap-1 rounded-md border border-slate-950/35 bg-black/25 px-2 py-0.5 text-[10px] font-bold tracking-tight text-slate-900 cursor-grab active:cursor-grabbing select-none hover:bg-black/35"
    >
      <Brackets className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
      <span>Parameter</span>
    </div>
  );
}

/** A–B toggle (left) + Parameter chip: alphabetical view vs construction order (stored array unchanged). */
function BackendMappingHeaderToolbar({
  sortAlphabetical,
  onSortAlphabeticalChange,
}: {
  sortAlphabetical: boolean;
  onSortAlphabeticalChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        aria-pressed={sortAlphabetical}
        title={
          sortAlphabetical
            ? 'Ordine per nome interno (A–Z) — clic per ordine di inserimento (trascina per riordinare)'
            : 'Ordine di inserimento — trascina le righe per riordinare; clic per ordinare per nome interno (A–Z)'
        }
        onClick={() => onSortAlphabeticalChange(!sortAlphabetical)}
        className={`rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold tracking-tight select-none transition-colors ${
          sortAlphabetical
            ? 'border-amber-400/85 bg-amber-500/30 text-amber-100 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.4)]'
            : 'border-slate-950/45 bg-black/25 text-slate-500 hover:bg-black/40 hover:text-slate-300'
        }`}
      >
        A–B
      </button>
      <BackendParameterDragChip />
    </div>
  );
}

export interface InterfaceMappingEditorProps {
  /** Backend: SEND/RECEIVE entries (controlled). */
  backendSend: MappingEntry[];
  backendReceive: MappingEntry[];
  onBackendSendChange: (next: MappingEntry[]) => void;
  onBackendReceiveChange: (next: MappingEntry[]) => void;
  /** Interface mode: INPUT/OUTPUT (ignored when variant is backend-only usage). */
  interfaceInput?: MappingEntry[];
  interfaceOutput?: MappingEntry[];
  onInterfaceInputChange?: (next: MappingEntry[]) => void;
  onInterfaceOutputChange?: (next: MappingEntry[]) => void;
  variant: FlowMappingVariant;
  onVariantChange?: (v: FlowMappingVariant) => void;
  showVariantToggle?: boolean;
  /** Backend: datalist suggestions for API and variable fields. */
  apiOptions: string[];
  variableOptions: string[];
  /** Prefix for datalist ids; must be unique per mounted editor instance. */
  listIdPrefix: string;
  title?: string;
  showEndpoint?: boolean;
  endpointUrl?: string;
  endpointMethod?: string;
  onEndpointUrlChange?: (url: string) => void;
  onEndpointMethodChange?: (method: string) => void;
  /** Backend: when false, only variable field is shown per row (Hide API). Controlled by parent (e.g. dock toolbar). */
  showApiFields?: boolean;
  /** Demo: draggable variable chips below interface blocks. */
  interfaceDragLabels?: string[];
  showInterfacePalette?: boolean;
  showLayoutHint?: boolean;
  className?: string;
  innerClassName?: string;
  /** Enables pointer row-drag from canvas into INPUT/OUTPUT (data-* on MappingBlocks). */
  flowDropTarget?: { flowCanvasId: string };
  /** Subflow: single full-width bar above both columns: "Interface · {name}". */
  interfaceFlowTitle?: string;
  /** Flow workspace: drag the title bar to move the Interface dock to another screen edge. */
  interfaceTitleBarDockDragHandlers?: Pick<
    React.HTMLAttributes<HTMLElement>,
    'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'
  >;
  /** Flow workspace: e.g. close button on the main “Interface · …” header (right). */
  interfaceShellHeaderExtra?: React.ReactNode;
  /** Resolves human variable names for linkedVariable when saving drops. */
  projectId?: string;
  /** Backend RECEIVE: create variable from typed name (Invio). */
  onCreateOutputVariable?: (displayName: string) => { id: string; label: string } | null;
  onOutputVariableCreated?: () => void;
  /** Backend SEND: nome variabile → GUID (persistenza mapping = stesso id della variabile). */
  resolveVariableRefIdFromLabel?: (label: string) => string | undefined;
}

export function InterfaceMappingEditor({
  backendSend,
  backendReceive,
  onBackendSendChange,
  onBackendReceiveChange,
  interfaceInput: interfaceInputProp,
  interfaceOutput: interfaceOutputProp,
  onInterfaceInputChange: onInterfaceInputChangeProp,
  onInterfaceOutputChange: onInterfaceOutputChangeProp,
  variant,
  onVariantChange,
  showVariantToggle = true,
  apiOptions,
  variableOptions,
  listIdPrefix,
  title = 'Mapping',
  showEndpoint = true,
  endpointUrl = '',
  endpointMethod = 'POST',
  onEndpointUrlChange,
  onEndpointMethodChange,
  showApiFields = true,
  onCreateOutputVariable,
  onOutputVariableCreated,
  resolveVariableRefIdFromLabel,
  interfaceDragLabels = [],
  showInterfacePalette = true,
  showLayoutHint = true,
  className = '',
  innerClassName = '',
  flowDropTarget,
  interfaceFlowTitle,
  interfaceTitleBarDockDragHandlers,
  interfaceShellHeaderExtra,
  projectId,
}: InterfaceMappingEditorProps) {
  const interfaceInput = interfaceInputProp ?? [];
  const interfaceOutput = interfaceOutputProp ?? [];
  const onInterfaceInputChange = onInterfaceInputChangeProp ?? (() => {});
  const onInterfaceOutputChange = onInterfaceOutputChangeProp ?? (() => {});

  const containerRef = useRef<HTMLDivElement>(null);
  const { layout } = useContainerWidth(containerRef);

  /** Backend SEND/RECEIVE: default alphabetical by internal path segment (nome interno). */
  const [sortBackendSendAlphabetical, setSortBackendSendAlphabetical] = useState(true);
  const [sortBackendReceiveAlphabetical, setSortBackendReceiveAlphabetical] = useState(true);

  /** Pointer drop da riga nodo (useNodeDragDrop) su SEND/RECEIVE quando il canvas è noto. */
  useEffect(() => {
    if (variant !== 'backend' || !flowDropTarget?.flowCanvasId?.trim()) return;
    const fid = flowDropTarget.flowCanvasId.trim();
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<FlowBackendMappingPointerDropDetail>;
      const d = e.detail;
      if (!d || d.flowCanvasId !== fid) return;
      const payload = { variableRefId: d.variableRefId, rowLabel: d.rowLabel };
      if (d.zone === 'send') {
        onBackendSendChange((prev) => {
          const so = sortBackendSendAlphabetical ? 'alphabetical' : 'construction';
          const r = mergeBackendMappingVariableDrop(prev, payload, projectId, fid, so);
          return r ? r.merged : prev;
        });
      } else {
        onBackendReceiveChange((prev) => {
          const so = sortBackendReceiveAlphabetical ? 'alphabetical' : 'construction';
          const r = mergeBackendMappingVariableDrop(prev, payload, projectId, fid, so);
          return r ? r.merged : prev;
        });
      }
    };
    window.addEventListener(FLOW_BACKEND_MAPPING_POINTER_DROP, handler as EventListener);
    return () => window.removeEventListener(FLOW_BACKEND_MAPPING_POINTER_DROP, handler as EventListener);
  }, [
    variant,
    flowDropTarget?.flowCanvasId,
    projectId,
    sortBackendSendAlphabetical,
    sortBackendReceiveAlphabetical,
    onBackendSendChange,
    onBackendReceiveChange,
  ]);

  const setInterfaceInputWrapped = useCallback(
    (updater: React.SetStateAction<MappingEntry[]>) => {
      const next =
        typeof updater === 'function' ? (updater as (p: MappingEntry[]) => MappingEntry[])(interfaceInput) : updater;
      onInterfaceInputChange(next);
    },
    [interfaceInput, onInterfaceInputChange]
  );

  const setInterfaceOutputWrapped = useCallback(
    (updater: React.SetStateAction<MappingEntry[]>) => {
      const next =
        typeof updater === 'function' ? (updater as (p: MappingEntry[]) => MappingEntry[])(interfaceOutput) : updater;
      onInterfaceOutputChange(next);
    },
    [interfaceOutput, onInterfaceOutputChange]
  );

  const onIfaceInDrop = useCallback(
    (payload: FlowInterfaceDropPayload) => {
      /** Row-acquired HTML5 drag carries variableRefId; pointer row-drop is Output-only. */
      if (payload.variableRefId) return;
      const path = payload.internalPath.trim();
      if (!path) return;
      const rowText = (payload.rowLabel ?? '').trim();
      if (flowDropTarget?.flowCanvasId) {
        ensureFlowVariableBindingForInterfaceRow(
          projectId,
          flowDropTarget.flowCanvasId,
          payload.variableRefId,
          rowText,
          path
        );
      }
      const { externalName, linkedVariable } = computeInterfaceEntryLabels(
        projectId,
        payload.variableRefId,
        rowText,
        path
      );
      const newEntry = createMappingEntry({
        internalPath: path,
        externalName,
        variableRefId: payload.variableRefId,
        linkedVariable,
      });
      if (shouldSkipInterfaceDuplicate(interfaceInput, newEntry)) return;
      onInterfaceInputChange([...interfaceInput, newEntry]);
    },
    [projectId, flowDropTarget, interfaceInput, onInterfaceInputChange]
  );

  const onIfaceOutDrop = useCallback(
    (payload: FlowInterfaceDropPayload) => {
      const path = payload.internalPath.trim();
      if (!path) return;
      const rowText = (payload.rowLabel ?? '').trim();
      if (flowDropTarget?.flowCanvasId) {
        ensureFlowVariableBindingForInterfaceRow(
          projectId,
          flowDropTarget.flowCanvasId,
          payload.variableRefId,
          rowText,
          path
        );
      }
      const { externalName, linkedVariable } = computeInterfaceEntryLabels(
        projectId,
        payload.variableRefId,
        rowText,
        path
      );
      const newEntry = createMappingEntry({
        internalPath: path,
        externalName,
        variableRefId: payload.variableRefId,
        linkedVariable,
      });
      if (shouldSkipInterfaceDuplicate(interfaceOutput, newEntry)) return;
      onInterfaceOutputChange([...interfaceOutput, newEntry]);
    },
    [projectId, flowDropTarget, interfaceOutput, onInterfaceOutputChange]
  );

  const blocksClass = useMemo(
    () =>
      layout === 'stacked'
        ? 'flex flex-col gap-3 flex-1 min-h-0'
        : 'flex flex-row gap-3 flex-1 min-h-0 items-stretch',
    [layout]
  );

  const mappingBlockRootClass = layout === 'stacked' ? 'w-full' : 'flex-1 min-w-0';

  /** Columns inside the Interface shell: equal height (row) or split height (stacked). */
  const ifaceShellColumnClass = useMemo(
    () =>
      layout === 'stacked'
        ? 'w-full flex-1 min-h-0 flex flex-col min-h-0'
        : 'flex-1 min-w-0 flex flex-col min-h-0',
    [layout]
  );

  const sendPrefix = `${listIdPrefix}-send`;
  const recvPrefix = `${listIdPrefix}-recv`;
  const inPrefix = `${listIdPrefix}-ifaceIn`;
  const outPrefix = `${listIdPrefix}-ifaceOut`;

  return (
    <div ref={containerRef} className={`flex flex-col h-full min-h-0 w-full bg-[#0c0f14] text-slate-100 ${className}`}>
      {(title || (showVariantToggle && onVariantChange)) && (
        <header className="shrink-0 border-b border-amber-900/30 px-3 py-2 flex flex-wrap items-center gap-2 bg-slate-950/80">
          {title ? <span className="text-amber-200/90 text-sm font-medium truncate">{title}</span> : null}
          {showVariantToggle && onVariantChange ? (
            <div className={`${title ? 'ml-auto' : ''} flex rounded-lg border border-slate-600/80 bg-slate-900/50 p-0.5 text-[11px]`}>
              <button
                type="button"
                className={`px-2 py-1 rounded-md ${variant === 'backend' ? 'bg-teal-800/80 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => onVariantChange('backend')}
              >
                Backend
              </button>
              <button
                type="button"
                className={`px-2 py-1 rounded-md ${variant === 'interface' ? 'bg-violet-800/80 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => onVariantChange('interface')}
              >
                Interface
              </button>
            </div>
          ) : null}
        </header>
      )}

      {variant === 'backend' && showEndpoint && (onEndpointUrlChange || onEndpointMethodChange) && (
        <div className="shrink-0 px-3 py-2 border-b border-slate-700/60">
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Endpoint</label>
          <div className="flex gap-2 flex-wrap">
            <input
              className="flex-1 min-w-[12rem] rounded-md border border-amber-600/50 bg-slate-950/60 px-2 py-1.5 text-xs text-amber-100/95 placeholder:text-slate-600"
              value={endpointUrl}
              onChange={(e) => onEndpointUrlChange?.(e.target.value)}
              placeholder="https://..."
            />
            {onEndpointMethodChange ? (
              <select
                className="rounded-md border border-amber-600/50 bg-slate-950/60 px-2 py-1.5 text-xs text-amber-100/95"
                value={endpointMethod}
                onChange={(e) => onEndpointMethodChange(e.target.value)}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
            ) : null}
          </div>
        </div>
      )}

      <div
        className={`flex-1 min-h-0 flex flex-col p-3 ${interfaceFlowTitle && variant === 'interface' ? 'overflow-hidden min-h-0' : 'overflow-y-auto'} ${innerClassName}`}
      >
        {showLayoutHint ? (
          <p className="text-[10px] text-slate-500 mb-2">
            {layout === 'stacked' ? 'Layout impilato' : 'Layout affiancato'} · Matita solo su label (foglia) al hover ·{' '}
            <span className="text-slate-600">Doppio click sulla label per edit rapido</span>
          </p>
        ) : null}

        {variant === 'backend' && (
          <div className={blocksClass}>
            <MappingBlock
              accent="send"
              rootClassName={mappingBlockRootClass}
              backendMappingDropTarget={
                flowDropTarget?.flowCanvasId
                  ? { flowCanvasId: flowDropTarget.flowCanvasId, zone: 'send' }
                  : undefined
              }
              headerExtra={
                <BackendMappingHeaderToolbar
                  sortAlphabetical={sortBackendSendAlphabetical}
                  onSortAlphabeticalChange={setSortBackendSendAlphabetical}
                />
              }
            >
              <FlowMappingTree
                variant="backend"
                entries={backendSend}
                onEntriesChange={onBackendSendChange}
                apiOptions={apiOptions}
                variableOptions={variableOptions}
                listIdPrefix={sendPrefix}
                enableBackendParamDrop
                showApiFields={showApiFields}
                projectId={projectId}
                flowCanvasId={flowDropTarget?.flowCanvasId}
                siblingOrder={sortBackendSendAlphabetical ? 'alphabetical' : 'construction'}
                backendColumn="send"
                onCreateOutputVariable={onCreateOutputVariable}
                onOutputVariableCreated={onOutputVariableCreated}
                resolveVariableRefIdFromLabel={resolveVariableRefIdFromLabel}
              />
            </MappingBlock>
            <MappingBlock
              accent="receive"
              rootClassName={mappingBlockRootClass}
              backendMappingDropTarget={
                flowDropTarget?.flowCanvasId
                  ? { flowCanvasId: flowDropTarget.flowCanvasId, zone: 'receive' }
                  : undefined
              }
              headerExtra={
                <BackendMappingHeaderToolbar
                  sortAlphabetical={sortBackendReceiveAlphabetical}
                  onSortAlphabeticalChange={setSortBackendReceiveAlphabetical}
                />
              }
            >
              <FlowMappingTree
                variant="backend"
                entries={backendReceive}
                onEntriesChange={onBackendReceiveChange}
                apiOptions={apiOptions}
                variableOptions={variableOptions}
                listIdPrefix={recvPrefix}
                enableBackendParamDrop
                showApiFields={showApiFields}
                projectId={projectId}
                flowCanvasId={flowDropTarget?.flowCanvasId}
                siblingOrder={sortBackendReceiveAlphabetical ? 'alphabetical' : 'construction'}
                backendColumn="receive"
                onCreateOutputVariable={onCreateOutputVariable}
                onOutputVariableCreated={onOutputVariableCreated}
                resolveVariableRefIdFromLabel={resolveVariableRefIdFromLabel}
              />
            </MappingBlock>
          </div>
        )}

        {variant === 'interface' && (
          <>
            {interfaceFlowTitle ? (
              <div className="flex flex-col flex-1 min-h-0 rounded-xl border-2 border-violet-500/90 bg-[#0a0c10] shadow-inner overflow-hidden">
                <header className="shrink-0 px-2 py-0.5 h-7 min-h-7 box-border bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 border-b border-fuchsia-300/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] flex items-center gap-1.5">
                  <div
                    className={`flex-1 flex items-center justify-center min-w-0 ${
                      interfaceTitleBarDockDragHandlers
                        ? 'cursor-grab active:cursor-grabbing touch-none select-none rounded px-1 py-0.5 ring-1 ring-transparent hover:ring-white/25'
                        : ''
                    }`}
                    title={
                      interfaceTitleBarDockDragHandlers
                        ? 'Trascina verso i bordi del flow per spostare il pannello'
                        : undefined
                    }
                    {...interfaceTitleBarDockDragHandlers}
                  >
                    <span className="text-xs font-semibold text-white tracking-tight select-none text-center truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
                      Interface · {interfaceFlowTitle}
                    </span>
                  </div>
                  {interfaceShellHeaderExtra != null ? (
                    <div className="shrink-0 flex items-center justify-end">{interfaceShellHeaderExtra}</div>
                  ) : null}
                </header>
                <div className={`${blocksClass} p-2 pt-3`}>
                  <MappingBlock
                    accent="input"
                    fillBodyHeight
                    rootClassName={ifaceShellColumnClass}
                    flowDropTarget={
                      flowDropTarget
                        ? { flowCanvasId: flowDropTarget.flowCanvasId, zone: 'input' }
                        : undefined
                    }
                  >
                    <FlowMappingTree
                      variant="interface"
                      entries={interfaceInput}
                      onEntriesChange={setInterfaceInputWrapped}
                      apiOptions={[]}
                      variableOptions={[]}
                      listIdPrefix={inPrefix}
                      showDropZone
                      onDropVariable={onIfaceInDrop}
                      projectId={projectId}
                      flowCanvasId={flowDropTarget?.flowCanvasId}
                      interfaceZone="input"
                    />
                  </MappingBlock>
                  <MappingBlock
                    accent="output"
                    fillBodyHeight
                    rootClassName={ifaceShellColumnClass}
                    flowDropTarget={
                      flowDropTarget
                        ? { flowCanvasId: flowDropTarget.flowCanvasId, zone: 'output' }
                        : undefined
                    }
                  >
                    <FlowMappingTree
                      variant="interface"
                      entries={interfaceOutput}
                      onEntriesChange={setInterfaceOutputWrapped}
                      apiOptions={[]}
                      variableOptions={[]}
                      listIdPrefix={outPrefix}
                      showDropZone
                      onDropVariable={onIfaceOutDrop}
                      projectId={projectId}
                      flowCanvasId={flowDropTarget?.flowCanvasId}
                      interfaceZone="output"
                    />
                  </MappingBlock>
                </div>
              </div>
            ) : (
              <div className={blocksClass}>
                <MappingBlock
                  accent="input"
                  rootClassName={mappingBlockRootClass}
                  flowDropTarget={
                    flowDropTarget
                      ? { flowCanvasId: flowDropTarget.flowCanvasId, zone: 'input' }
                      : undefined
                  }
                >
                  <FlowMappingTree
                    variant="interface"
                    entries={interfaceInput}
                    onEntriesChange={setInterfaceInputWrapped}
                    apiOptions={[]}
                    variableOptions={[]}
                    listIdPrefix={inPrefix}
                    showDropZone
                    onDropVariable={onIfaceInDrop}
                    projectId={projectId}
                    flowCanvasId={flowDropTarget?.flowCanvasId}
                    interfaceZone="input"
                  />
                </MappingBlock>
                <MappingBlock
                  accent="output"
                  rootClassName={mappingBlockRootClass}
                  flowDropTarget={
                    flowDropTarget
                      ? { flowCanvasId: flowDropTarget.flowCanvasId, zone: 'output' }
                      : undefined
                  }
                >
                  <FlowMappingTree
                    variant="interface"
                    entries={interfaceOutput}
                    onEntriesChange={setInterfaceOutputWrapped}
                    apiOptions={[]}
                    variableOptions={[]}
                    listIdPrefix={outPrefix}
                    showDropZone
                    onDropVariable={onIfaceOutDrop}
                    projectId={projectId}
                    flowCanvasId={flowDropTarget?.flowCanvasId}
                    interfaceZone="output"
                  />
                </MappingBlock>
              </div>
            )}
            {showInterfacePalette && interfaceDragLabels.length > 0 ? (
              <div className="mt-2 rounded-lg border border-slate-700/80 bg-slate-950/50 p-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Variabili (demo drag)</p>
                <div className="flex flex-wrap gap-1.5">
                  {interfaceDragLabels.map((label) => (
                    <div
                      key={label}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DND_TYPE, label);
                        e.dataTransfer.setData('text/plain', label);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      className="cursor-grab active:cursor-grabbing rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1 text-[10px] text-slate-200 hover:border-violet-500/50"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
