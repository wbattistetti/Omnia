/**
 * Flow Interface panel: Input/Output mapping (meta.flowInterface), dockable on four edges.
 * Thin resize strips + bidirectional cursors; dock position persisted (flowInterfaceDockStorage).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp, GripVertical, Layers } from 'lucide-react';
import { useFlowActions, useFlowWorkspace } from '@flows/FlowStore';
import { InterfaceMappingEditor } from '../FlowMappingPanel/InterfaceMappingEditor';
import {
  computeInterfaceEntryLabels,
  ensureFlowVariableBindingForInterfaceRow,
  shouldSkipInterfaceDuplicate,
} from '../FlowMappingPanel/interfaceMappingLabels';
import {
  FLOW_INTERFACE_ROW_POINTER_DROP,
  type FlowInterfaceRowPointerDropDetail,
} from '../FlowMappingPanel/flowInterfaceDragTypes';
import { createMappingEntry, type MappingEntry } from '../FlowMappingPanel/mappingTypes';
import { insertInterfaceEntryAt } from '../FlowMappingPanel/mappingTreeUtils';
import {
  readDockRegion,
  writeDockRegion,
  readPanelHeight,
  writePanelHeight,
  readPanelWidth,
  writePanelWidth,
  clampHeight,
  clampWidth,
  MIN_H,
  MIN_W,
  type FlowInterfaceDockRegion,
} from './flowInterfaceDockStorage';
import { FlowInterfaceDockPreviewOverlay } from './FlowInterfaceDockPreviewOverlay';
import { useFlowInterfaceDockDrag } from './useFlowInterfaceDockDrag';

export interface FlowInterfaceBottomPanelProps {
  flowId: string;
  projectId?: string;
}

const EDGE_INSET = '2.5rem'; /* clears Flow tab bar / bottom chrome (bottom-10) */

const shellClass =
  'z-[42] flex pointer-events-none border-violet-700/45 bg-[#0a0c10]/96 backdrop-blur-md shadow-[0_-6px_28px_rgba(0,0,0,0.45)]';

function thinSplitterHorizontal(edge: 'top' | 'bottom'): string {
  const border = edge === 'top' ? 'border-b' : 'border-t';
  return `pointer-events-auto shrink-0 ${edge === 'top' ? 'order-first' : 'order-last'} h-1.5 min-h-[6px] cursor-ns-resize touch-none select-none bg-transparent hover:bg-violet-500/20 ${border} border-transparent hover:border-violet-500/35 transition-colors`;
}

const thinSplitterVertical = (edge: 'left' | 'right'): string => {
  const border = edge === 'left' ? 'border-r' : 'border-l';
  return `pointer-events-auto shrink-0 ${edge === 'left' ? 'order-first' : 'order-last'} w-1.5 min-w-[6px] cursor-ew-resize touch-none select-none bg-transparent hover:bg-violet-500/20 ${border} border-transparent hover:border-violet-500/35 transition-colors`;
};

export function FlowInterfaceBottomPanel({ flowId, projectId }: FlowInterfaceBottomPanelProps) {
  const { flows } = useFlowWorkspace();
  const flowsRef = useRef(flows);
  flowsRef.current = flows;
  const { updateFlowMeta } = useFlowActions();
  const [open, setOpen] = useState(false);
  const [dockRegion, setDockRegion] = useState<FlowInterfaceDockRegion>(() => readDockRegion());
  const [panelHeightPx, setPanelHeightPx] = useState(() => readPanelHeight());
  const [panelWidthPx, setPanelWidthPx] = useState(() => readPanelWidth());
  const [resizing, setResizing] = useState(false);
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const flow = flows[flowId];
  const iface = flow?.meta?.flowInterface ?? { input: [] as MappingEntry[], output: [] as MappingEntry[] };
  const flowTitle = (flow?.title && String(flow.title).trim()) || flowId;

  const listIdPrefix = useMemo(() => `flow-iface-${flowId.replace(/[^a-zA-Z0-9_-]/g, '_')}`, [flowId]);

  const setInput = useCallback(
    (next: MappingEntry[]) => {
      const out = flows[flowId]?.meta?.flowInterface?.output ?? [];
      updateFlowMeta(flowId, { flowInterface: { input: next, output: out } });
    },
    [flowId, flows, updateFlowMeta]
  );

  const setOutput = useCallback(
    (next: MappingEntry[]) => {
      const inn = flows[flowId]?.meta?.flowInterface?.input ?? [];
      updateFlowMeta(flowId, { flowInterface: { input: inn, output: next } });
    },
    [flowId, flows, updateFlowMeta]
  );

  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<FlowInterfaceRowPointerDropDetail>;
      const d = e.detail;
      if (!d || d.flowId !== flowId) return;
      const path = d.internalPath.trim();
      if (!path) return;

      const rowText = (d.rowLabel ?? '').trim();
      ensureFlowVariableBindingForInterfaceRow(projectId, flowId, d.variableRefId, rowText, path);
      const { externalName, linkedVariable } = computeInterfaceEntryLabels(
        projectId,
        d.variableRefId,
        rowText,
        path
      );
      const entry = createMappingEntry({
        internalPath: path,
        externalName,
        variableRefId: d.variableRefId,
        linkedVariable,
      });

      const iface = flowsRef.current[flowId]?.meta?.flowInterface ?? {
        input: [] as MappingEntry[],
        output: [] as MappingEntry[],
      };
      if (d.zone !== 'output') return;
      if (shouldSkipInterfaceDuplicate(iface.output, entry)) return;
      const insertTarget = d.insertTargetPathKey ?? null;
      const insertPlacement = d.insertPlacement ?? 'append';
      const nextOut = insertInterfaceEntryAt(iface.output, entry, insertTarget, insertPlacement);
      updateFlowMeta(flowId, {
        flowInterface: { input: iface.input, output: nextOut },
      });
    };
    window.addEventListener(FLOW_INTERFACE_ROW_POINTER_DROP, handler as EventListener);
    return () => window.removeEventListener(FLOW_INTERFACE_ROW_POINTER_DROP, handler as EventListener);
  }, [flowId, projectId, updateFlowMeta]);

  useEffect(() => {
    const onResize = () => {
      setPanelHeightPx((h) => clampHeight(h));
      setPanelWidthPx((w) => clampWidth(w));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onDockChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value as FlowInterfaceDockRegion;
    if (v === 'bottom' || v === 'top' || v === 'left' || v === 'right') {
      setDockRegion(v);
      writeDockRegion(v);
    }
  }, []);

  const commitDockRegion = useCallback((r: FlowInterfaceDockRegion) => {
    setDockRegion(r);
    writeDockRegion(r);
  }, []);

  const { dockDragPreview, dockDragHandlers } = useFlowInterfaceDockDrag(commitDockRegion);

  const onPointerDownHorizontalBottom = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      resizeStartRef.current = { x: e.clientX, y: e.clientY, w: panelWidthPx, h: panelHeightPx };
      setResizing(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [panelHeightPx, panelWidthPx]
  );

  const onPointerMoveHorizontalBottom = useCallback((e: React.PointerEvent) => {
    const start = resizeStartRef.current;
    if (!start) return;
    const next = clampHeight(start.h + (start.y - e.clientY));
    setPanelHeightPx(next);
  }, []);

  const onPointerDownHorizontalTop = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      resizeStartRef.current = { x: e.clientX, y: e.clientY, w: panelWidthPx, h: panelHeightPx };
      setResizing(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [panelHeightPx, panelWidthPx]
  );

  const onPointerMoveHorizontalTop = useCallback((e: React.PointerEvent) => {
    const start = resizeStartRef.current;
    if (!start) return;
    const next = clampHeight(start.h + (e.clientY - start.y));
    setPanelHeightPx(next);
  }, []);

  const onPointerDownVerticalLeft = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      resizeStartRef.current = { x: e.clientX, y: e.clientY, w: panelWidthPx, h: panelHeightPx };
      setResizing(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [panelHeightPx, panelWidthPx]
  );

  const onPointerMoveVerticalLeft = useCallback((e: React.PointerEvent) => {
    const start = resizeStartRef.current;
    if (!start) return;
    const next = clampWidth(start.w + (e.clientX - start.x));
    setPanelWidthPx(next);
  }, []);

  const onPointerDownVerticalRight = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      resizeStartRef.current = { x: e.clientX, y: e.clientY, w: panelWidthPx, h: panelHeightPx };
      setResizing(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [panelHeightPx, panelWidthPx]
  );

  const onPointerMoveVerticalRight = useCallback((e: React.PointerEvent) => {
    const start = resizeStartRef.current;
    if (!start) return;
    const next = clampWidth(start.w + (start.x - e.clientX));
    setPanelWidthPx(next);
  }, []);

  const onSplitterPointerUp = useCallback(
    (e: React.PointerEvent, kind: 'height' | 'width') => {
      resizeStartRef.current = null;
      setResizing(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (kind === 'height') {
        setPanelHeightPx((h) => {
          const c = clampHeight(h);
          writePanelHeight(c);
          return c;
        });
      } else {
        setPanelWidthPx((w) => {
          const c = clampWidth(w);
          writePanelWidth(c);
          return c;
        });
      }
    },
    []
  );

  const editor = (
    <div className="pointer-events-auto flex-1 min-h-0 overflow-hidden flex flex-col">
      <InterfaceMappingEditor
        backendSend={[]}
        backendReceive={[]}
        onBackendSendChange={() => {}}
        onBackendReceiveChange={() => {}}
        interfaceInput={iface.input}
        interfaceOutput={iface.output}
        onInterfaceInputChange={setInput}
        onInterfaceOutputChange={setOutput}
        variant="interface"
        showVariantToggle={false}
        apiOptions={[]}
        variableOptions={[]}
        listIdPrefix={listIdPrefix}
        title=""
        interfaceFlowTitle={flowTitle}
        projectId={projectId}
        showEndpoint={false}
        showLayoutHint={false}
        showInterfacePalette={false}
        interfaceDragLabels={[]}
        className="border-0"
        innerClassName="pb-2"
        flowDropTarget={{ flowCanvasId: flowId }}
        interfaceTitleBarDockDragHandlers={dockDragHandlers}
      />
    </div>
  );

  const dockSelect = (
    <label className="pointer-events-auto flex items-center gap-1.5 text-[10px] text-violet-200/90 shrink-0">
      <span className="sr-only">Posizione pannello</span>
      <select
        value={dockRegion}
        onChange={onDockChange}
        className="rounded border border-violet-600/50 bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-medium text-violet-100 cursor-pointer max-w-[7.5rem]"
        title="Dock pannello Interface"
      >
        <option value="bottom">Basso</option>
        <option value="top">Alto</option>
        <option value="left">Sinistra</option>
        <option value="right">Destra</option>
      </select>
    </label>
  );

  const lostCapture = useCallback(() => {
    resizeStartRef.current = null;
    setResizing(false);
  }, []);

  const transitionClass = resizing ? '' : 'transition-transform duration-300 ease-in-out';

  const bottomSplitter = (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-valuenow={panelHeightPx}
      aria-valuemin={MIN_H}
      aria-valuemax={typeof window !== 'undefined' ? clampHeight(9999) : 800}
      className={thinSplitterHorizontal('top')}
      onPointerDown={onPointerDownHorizontalBottom}
      onPointerMove={onPointerMoveHorizontalBottom}
      onPointerUp={(e) => onSplitterPointerUp(e, 'height')}
      onPointerCancel={(e) => onSplitterPointerUp(e, 'height')}
      onLostPointerCapture={lostCapture}
      title="Trascina per ridimensionare"
    />
  );

  const bottomPanel = (
    <div
      className={`fixed left-0 right-0 ${shellClass} flex-col items-stretch border-t ${transitionClass} ${
        open ? 'bottom-10 translate-y-0' : 'bottom-10 translate-y-full'
      }`}
      style={{ height: panelHeightPx }}
      aria-hidden={!open}
    >
      <div className="flex flex-col h-full min-h-0">
        {bottomSplitter}
        {editor}
      </div>
    </div>
  );

  const topPanel = (
    <div
      className={`fixed left-0 right-0 ${shellClass} flex-col items-stretch border-b ${transitionClass} ${
        open ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{ top: EDGE_INSET, height: panelHeightPx }}
      aria-hidden={!open}
    >
      <div className="flex flex-col h-full min-h-0">
        {editor}
        <div
          role="separator"
          aria-orientation="horizontal"
          className={thinSplitterHorizontal('bottom')}
          onPointerDown={onPointerDownHorizontalTop}
          onPointerMove={onPointerMoveHorizontalTop}
          onPointerUp={(e) => onSplitterPointerUp(e, 'height')}
          onPointerCancel={(e) => onSplitterPointerUp(e, 'height')}
          onLostPointerCapture={lostCapture}
          title="Trascina per ridimensionare"
        />
      </div>
    </div>
  );

  const leftPanel = (
    <div
      className={`fixed left-0 ${shellClass} flex-row border-r ${transitionClass} ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{ top: EDGE_INSET, bottom: EDGE_INSET, width: panelWidthPx }}
      aria-hidden={!open}
    >
      <div className="flex flex-row h-full min-h-0 w-full min-w-0">
        {editor}
        <div
          role="separator"
          aria-orientation="vertical"
          className={thinSplitterVertical('right')}
          onPointerDown={onPointerDownVerticalLeft}
          onPointerMove={onPointerMoveVerticalLeft}
          onPointerUp={(e) => onSplitterPointerUp(e, 'width')}
          onPointerCancel={(e) => onSplitterPointerUp(e, 'width')}
          onLostPointerCapture={lostCapture}
          title="Trascina per ridimensionare"
        />
      </div>
    </div>
  );

  const rightPanel = (
    <div
      className={`fixed ${shellClass} flex-row border-l ${transitionClass} ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ top: EDGE_INSET, bottom: EDGE_INSET, right: 0, width: panelWidthPx }}
      aria-hidden={!open}
    >
      <div className="flex flex-row h-full min-h-0 w-full min-w-0 pr-12 box-border">
        <div
          role="separator"
          aria-orientation="vertical"
          className={thinSplitterVertical('left')}
          onPointerDown={onPointerDownVerticalRight}
          onPointerMove={onPointerMoveVerticalRight}
          onPointerUp={(e) => onSplitterPointerUp(e, 'width')}
          onPointerCancel={(e) => onSplitterPointerUp(e, 'width')}
          onLostPointerCapture={lostCapture}
          title="Trascina per ridimensionare"
        />
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">{editor}</div>
      </div>
    </div>
  );

  const toggleShellBase =
    'fixed z-[43] flex items-center gap-1.5 border border-violet-600/55 bg-slate-800/95 hover:bg-slate-700/95 text-violet-100 text-xs font-semibold tracking-wide shadow-lg backdrop-blur-sm transition-colors';
  const toggleStyle: React.CSSProperties = { WebkitBackdropFilter: 'blur(8px)' };

  const dockDragHandle = (
    <div
      {...dockDragHandlers}
      className="pointer-events-auto shrink-0 cursor-grab active:cursor-grabbing rounded p-1 text-violet-300/90 hover:bg-white/10 touch-none select-none"
      title="Trascina verso un bordo dello schermo per spostare il pannello"
      role="presentation"
    >
      <GripVertical className="w-4 h-4" strokeWidth={2} aria-hidden />
    </div>
  );

  const toggleBottom = (
    <div
      className={`${toggleShellBase} bottom-0 left-1/2 -translate-x-1/2 rounded-t-lg border-b-0 px-2 py-2 min-w-[10rem]`}
      style={toggleStyle}
    >
      {dockDragHandle}
      {dockSelect}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex flex-1 min-w-0 items-center justify-center gap-2 rounded-md bg-transparent border-0 text-inherit cursor-pointer py-1 px-1"
        aria-expanded={open}
        aria-label={open ? 'Chiudi Interface' : 'Apri Interface'}
        title={open ? 'Chiudi Interface' : 'Apri Interface'}
      >
        <Layers className="w-4 h-4 text-violet-400/90 shrink-0" strokeWidth={2} />
        <span className="truncate max-w-[8rem]" title={flowId}>
          Interface · {flowTitle}
        </span>
        <ChevronUp className={`w-4 h-4 shrink-0 opacity-80 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );

  const toggleTop = (
    <div
      className={`${toggleShellBase} left-1/2 -translate-x-1/2 rounded-b-lg border-t-0 px-2 py-2 min-w-[10rem]`}
      style={{ ...toggleStyle, top: EDGE_INSET }}
    >
      {dockDragHandle}
      {dockSelect}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex flex-1 min-w-0 items-center justify-center gap-2 rounded-md bg-transparent border-0 text-inherit cursor-pointer py-1 px-1"
        aria-expanded={open}
        aria-label={open ? 'Chiudi Interface' : 'Apri Interface'}
        title={open ? 'Chiudi Interface' : 'Apri Interface'}
      >
        <Layers className="w-4 h-4 text-violet-400/90 shrink-0" strokeWidth={2} />
        <span className="truncate max-w-[8rem]" title={flowId}>
          Interface · {flowTitle}
        </span>
        <ChevronUp className={`w-4 h-4 shrink-0 opacity-80 transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>
    </div>
  );

  const toggleLeft = (
    <div
      className={`${toggleShellBase} left-0 top-1/2 -translate-y-1/2 rounded-r-lg border-l-0 flex-col py-3 px-2 min-w-0 max-w-[9rem]`}
      style={toggleStyle}
    >
      {dockDragHandle}
      {dockSelect}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col items-center gap-2 rounded-md bg-transparent border-0 text-inherit cursor-pointer py-1 w-full min-w-0"
        aria-expanded={open}
        aria-label={open ? 'Chiudi Interface' : 'Apri Interface'}
        title={open ? 'Chiudi Interface' : 'Apri Interface'}
      >
        <Layers className="w-4 h-4 text-violet-400/90 shrink-0" strokeWidth={2} />
        <span
          className="text-[10px] font-semibold tracking-tight text-center max-w-[7rem] leading-tight"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          title={flowId}
        >
          Interface · {flowTitle}
        </span>
        <ChevronUp className="w-4 h-4 shrink-0 opacity-80 rotate-90" />
      </button>
    </div>
  );

  const toggleRight = (
    <div
      className={`${toggleShellBase} right-12 top-1/2 -translate-y-1/2 rounded-l-lg border-r-0 flex-col py-3 px-2 min-w-0 max-w-[9rem]`}
      style={toggleStyle}
    >
      {dockDragHandle}
      {dockSelect}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col items-center gap-2 rounded-md bg-transparent border-0 text-inherit cursor-pointer py-1 w-full min-w-0"
        aria-expanded={open}
        aria-label={open ? 'Chiudi Interface' : 'Apri Interface'}
        title={open ? 'Chiudi Interface' : 'Apri Interface'}
      >
        <Layers className="w-4 h-4 text-violet-400/90 shrink-0" strokeWidth={2} />
        <span
          className="text-[10px] font-semibold tracking-tight text-center max-w-[7rem] leading-tight"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          title={flowId}
        >
          Interface · {flowTitle}
        </span>
        <ChevronUp className="w-4 h-4 shrink-0 opacity-80 -rotate-90" />
      </button>
    </div>
  );

  return (
    <>
      {dockDragPreview !== null ? (
        <FlowInterfaceDockPreviewOverlay
          preview={dockDragPreview}
          panelHeightPx={panelHeightPx}
          panelWidthPx={panelWidthPx}
        />
      ) : null}
      {dockRegion === 'bottom' ? bottomPanel : null}
      {dockRegion === 'top' ? topPanel : null}
      {dockRegion === 'left' ? leftPanel : null}
      {dockRegion === 'right' ? rightPanel : null}

      {dockRegion === 'bottom' ? toggleBottom : null}
      {dockRegion === 'top' ? toggleTop : null}
      {dockRegion === 'left' ? toggleLeft : null}
      {dockRegion === 'right' ? toggleRight : null}
    </>
  );
}
