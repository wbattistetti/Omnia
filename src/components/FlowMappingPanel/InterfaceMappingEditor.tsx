/**
 * Controlled mapping UI: backend SEND/RECEIVE or subflow INPUT/OUTPUT tree blocks.
 * Used by UnifiedFlowMappingPanel (demo) and BackendCallEditor (persisted task rows).
 */

import React, { useCallback, useMemo, useRef } from 'react';
import { Brackets } from 'lucide-react';
import { MappingBlock } from './MappingBlock';
import { FlowMappingTree, DND_NEW_BACKEND_PARAM, DND_TYPE } from './FlowMappingTree';
import type { FlowMappingVariant } from './types';
import { createMappingEntry, type MappingEntry } from './mappingTypes';
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
  /** Backend: when false, only variable field is shown per row (Hide API). */
  showApiFields?: boolean;
  /** Demo: draggable variable chips below interface blocks. */
  interfaceDragLabels?: string[];
  showInterfacePalette?: boolean;
  showLayoutHint?: boolean;
  className?: string;
  innerClassName?: string;
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
  interfaceDragLabels = [],
  showInterfacePalette = true,
  showLayoutHint = true,
  className = '',
  innerClassName = '',
}: InterfaceMappingEditorProps) {
  const interfaceInput = interfaceInputProp ?? [];
  const interfaceOutput = interfaceOutputProp ?? [];
  const onInterfaceInputChange = onInterfaceInputChangeProp ?? (() => {});
  const onInterfaceOutputChange = onInterfaceOutputChangeProp ?? (() => {});

  const containerRef = useRef<HTMLDivElement>(null);
  const { layout } = useContainerWidth(containerRef);

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
    (path: string) => {
      if (interfaceInput.some((e) => e.internalPath === path)) return;
      onInterfaceInputChange([...interfaceInput, createMappingEntry({ internalPath: path, externalName: path })]);
    },
    [interfaceInput, onInterfaceInputChange]
  );

  const onIfaceOutDrop = useCallback(
    (path: string) => {
      if (interfaceOutput.some((e) => e.internalPath === path)) return;
      onInterfaceOutputChange([...interfaceOutput, createMappingEntry({ internalPath: path, externalName: path })]);
    },
    [interfaceOutput, onInterfaceOutputChange]
  );

  const blocksClass = useMemo(
    () =>
      layout === 'stacked'
        ? 'flex flex-col gap-3 flex-1 min-h-0'
        : 'flex flex-row gap-3 flex-1 min-h-0 items-start',
    [layout]
  );

  const mappingBlockRootClass = layout === 'stacked' ? 'w-full' : 'flex-1 min-w-0';

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

      <div className={`flex-1 min-h-0 overflow-y-auto p-3 flex flex-col ${innerClassName}`}>
        {showLayoutHint ? (
          <p className="text-[10px] text-slate-500 mb-2">
            {layout === 'stacked' ? 'Layout impilato' : 'Layout affiancato'} · Matita solo su label (foglia) al hover ·{' '}
            <span className="text-slate-600">Doppio click sulla label per edit rapido</span>
          </p>
        ) : null}

        {variant === 'backend' && (
          <div className={blocksClass}>
            <MappingBlock accent="send" rootClassName={mappingBlockRootClass} headerExtra={<BackendParameterDragChip />}>
              <FlowMappingTree
                variant="backend"
                entries={backendSend}
                onEntriesChange={onBackendSendChange}
                apiOptions={apiOptions}
                variableOptions={variableOptions}
                listIdPrefix={sendPrefix}
                enableBackendParamDrop
                showApiFields={showApiFields}
              />
            </MappingBlock>
            <MappingBlock accent="receive" rootClassName={mappingBlockRootClass} headerExtra={<BackendParameterDragChip />}>
              <FlowMappingTree
                variant="backend"
                entries={backendReceive}
                onEntriesChange={onBackendReceiveChange}
                apiOptions={apiOptions}
                variableOptions={variableOptions}
                listIdPrefix={recvPrefix}
                enableBackendParamDrop
                showApiFields={showApiFields}
              />
            </MappingBlock>
          </div>
        )}

        {variant === 'interface' && (
          <>
            <div className={blocksClass}>
              <MappingBlock accent="input" rootClassName={mappingBlockRootClass}>
                <FlowMappingTree
                  variant="interface"
                  entries={interfaceInput}
                  onEntriesChange={setInterfaceInputWrapped}
                  apiOptions={[]}
                  variableOptions={[]}
                  listIdPrefix={inPrefix}
                  showDropZone
                  onDropVariable={onIfaceInDrop}
                />
              </MappingBlock>
              <MappingBlock accent="output" rootClassName={mappingBlockRootClass}>
                <FlowMappingTree
                  variant="interface"
                  entries={interfaceOutput}
                  onEntriesChange={setInterfaceOutputWrapped}
                  apiOptions={[]}
                  variableOptions={[]}
                  listIdPrefix={outPrefix}
                  showDropZone
                  onDropVariable={onIfaceOutDrop}
                />
              </MappingBlock>
            </div>
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
