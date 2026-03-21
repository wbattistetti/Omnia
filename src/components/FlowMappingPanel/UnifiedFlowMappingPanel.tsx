/**
 * Unified mapping UI: treeview for dot paths, pencil on label hover (leaf rows),
 * SEND/RECEIVE (backend) or INPUT/OUTPUT (interface), drag variables for interface.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Brackets } from 'lucide-react';
import { MappingBlock } from './MappingBlock';
import { FlowMappingTree, DND_NEW_BACKEND_PARAM, DND_TYPE } from './FlowMappingTree';
import type { FlowMappingVariant } from './types';
import { createMappingEntry, type MappingEntry } from './mappingTypes';
import { useContainerWidth } from './useContainerWidth';

const MOCK_API_FIELDS = ['ticketId', 'status', 'birth', 'day', 'month', 'year', 'validationOk'];
const MOCK_VARIABLES = ['Numero', 'stato ticket', 'data di nascita', 'data di nascita.giorno', 'esito.validazione'];

const MOCK_DRAG_LABELS = [
  'data di nascita',
  'data di nascita.giorno',
  'data di nascita.mese',
  'data di nascita.anno',
  'stato ticket',
  'Numero',
  'esito.validazione',
];

function seedBackendSend(): MappingEntry[] {
  return [
    createMappingEntry({
      internalPath: 'Numero',
      apiField: 'ticketId',
      linkedVariable: 'Numero',
      externalName: 'Numero',
    }),
  ];
}

function seedBackendReceive(): MappingEntry[] {
  return [
    createMappingEntry({
      internalPath: 'stato',
      apiField: 'status',
      linkedVariable: 'stato ticket',
      externalName: 'stato',
    }),
    createMappingEntry({
      internalPath: 'data di nascita',
      apiField: 'birth',
      linkedVariable: 'data di nascita',
      externalName: 'data di nascita',
    }),
    createMappingEntry({
      internalPath: 'data di nascita.giorno',
      apiField: 'day',
      linkedVariable: 'data di nascita.giorno',
      externalName: 'data di nascita.giorno',
    }),
    createMappingEntry({
      internalPath: 'data di nascita.mese',
      apiField: 'month',
      linkedVariable: '',
      externalName: 'data di nascita.mese',
    }),
    createMappingEntry({
      internalPath: 'data di nascita.anno',
      apiField: 'year',
      linkedVariable: '',
      externalName: 'data di nascita.anno',
    }),
  ];
}

/** Draggable chip in SEND/RECEIVE headers: drop on tree to insert a new parameter. */
function BackendParameterDragChip() {
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

function InterfacePalette() {
  return (
    <div className="mt-2 rounded-lg border border-slate-700/80 bg-slate-950/50 p-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Variabili (demo drag)</p>
      <div className="flex flex-wrap gap-1.5">
        {MOCK_DRAG_LABELS.map((label) => (
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
  );
}

export interface UnifiedFlowMappingPanelProps {
  initialVariant?: FlowMappingVariant;
  title?: string;
}

export function UnifiedFlowMappingPanel({
  initialVariant = 'backend',
  title = 'Mapping',
}: UnifiedFlowMappingPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { layout } = useContainerWidth(containerRef);

  const [variant, setVariant] = useState<FlowMappingVariant>(initialVariant);
  const [endpoint, setEndpoint] = useState('https://api.example.com/endpoint');

  const [backendSend, setBackendSend] = useState<MappingEntry[]>(seedBackendSend);
  const [backendReceive, setBackendReceive] = useState<MappingEntry[]>(seedBackendReceive);
  const [interfaceInput, setInterfaceInput] = useState<MappingEntry[]>([]);
  const [interfaceOutput, setInterfaceOutput] = useState<MappingEntry[]>([]);

  const addInterfaceUnique = useCallback((setter: React.Dispatch<React.SetStateAction<MappingEntry[]>>, path: string) => {
    setter((prev) => {
      if (prev.some((e) => e.internalPath === path)) return prev;
      return [...prev, createMappingEntry({ internalPath: path, externalName: path })];
    });
  }, []);

  const blocksClass = useMemo(
    () =>
      layout === 'stacked'
        ? 'flex flex-col gap-3 flex-1 min-h-0'
        : 'flex flex-row gap-3 flex-1 min-h-0 items-start',
    [layout]
  );

  /** Side-by-side: share width; stacked: full width. Height follows content per block. */
  const mappingBlockRootClass = layout === 'stacked' ? 'w-full' : 'flex-1 min-w-0';

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full min-h-0 w-full bg-[#0c0f14] text-slate-100"
    >
      <header className="shrink-0 border-b border-amber-900/30 px-3 py-2 flex flex-wrap items-center gap-2 bg-slate-950/80">
        <span className="text-amber-200/90 text-sm font-medium truncate">{title}</span>
        <div className="ml-auto flex rounded-lg border border-slate-600/80 bg-slate-900/50 p-0.5 text-[11px]">
          <button
            type="button"
            className={`px-2 py-1 rounded-md ${variant === 'backend' ? 'bg-teal-800/80 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => setVariant('backend')}
          >
            Backend
          </button>
          <button
            type="button"
            className={`px-2 py-1 rounded-md ${variant === 'interface' ? 'bg-violet-800/80 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => setVariant('interface')}
          >
            Interface
          </button>
        </div>
      </header>

      {variant === 'backend' && (
        <div className="shrink-0 px-3 py-2 border-b border-slate-700/60">
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Endpoint</label>
          <input
            className="w-full rounded-md border border-amber-600/50 bg-slate-950/60 px-2 py-1.5 text-xs text-amber-100/95 placeholder:text-slate-600"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://..."
          />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col">
        <p className="text-[10px] text-slate-500 mb-2">
          {layout === 'stacked' ? 'Layout impilato' : 'Layout affiancato'} · Matita solo su label (foglia) al hover ·{' '}
          <span className="text-slate-600">Doppio click sulla label per edit rapido</span>
        </p>

        {variant === 'backend' && (
          <div className={blocksClass}>
            <MappingBlock
              accent="send"
              rootClassName={mappingBlockRootClass}
              headerExtra={<BackendParameterDragChip />}
            >
              <FlowMappingTree
                variant="backend"
                entries={backendSend}
                onEntriesChange={setBackendSend}
                apiOptions={MOCK_API_FIELDS}
                variableOptions={MOCK_VARIABLES}
                listIdPrefix="send"
                enableBackendParamDrop
              />
            </MappingBlock>
            <MappingBlock
              accent="receive"
              rootClassName={mappingBlockRootClass}
              headerExtra={<BackendParameterDragChip />}
            >
              <FlowMappingTree
                variant="backend"
                entries={backendReceive}
                onEntriesChange={setBackendReceive}
                apiOptions={MOCK_API_FIELDS}
                variableOptions={MOCK_VARIABLES}
                listIdPrefix="recv"
                enableBackendParamDrop
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
                  onEntriesChange={setInterfaceInput}
                  apiOptions={[]}
                  variableOptions={[]}
                  listIdPrefix="ifaceIn"
                  showDropZone
                  onDropVariable={(path) => addInterfaceUnique(setInterfaceInput, path)}
                />
              </MappingBlock>
              <MappingBlock accent="output" rootClassName={mappingBlockRootClass}>
                <FlowMappingTree
                  variant="interface"
                  entries={interfaceOutput}
                  onEntriesChange={setInterfaceOutput}
                  apiOptions={[]}
                  variableOptions={[]}
                  listIdPrefix="ifaceOut"
                  showDropZone
                  onDropVariable={(path) => addInterfaceUnique(setInterfaceOutput, path)}
                />
              </MappingBlock>
            </div>
            <InterfacePalette />
          </>
        )}
      </div>
    </div>
  );
}
