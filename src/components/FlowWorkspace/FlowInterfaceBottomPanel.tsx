/**
 * Flow Interface panel: Input/Output mapping (meta.flowInterface), dockable on four edges.
 * Thin resize strips; dock position persisted. Linguetta (chiuso) solo per aprire; chiusura con X sull’header “Interface · …”.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp, Layers, X } from 'lucide-react';
import { useInMemoryConditions } from '../../context/InMemoryConditionsContext';
import { useProjectTranslations } from '../../context/ProjectTranslationsContext';
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
import { syncSubflowChildInterfaceToAllParents } from '../../services/subflowProjectSync';
import { invalidateChildFlowInterfaceCache } from '../../services/childFlowInterfaceService';
import {
  validateRemovalOfInterfaceOutputRow,
  type ReferenceLocation,
} from '../../services/subflowVariableReferenceScan';

export interface FlowInterfaceBottomPanelProps {
  flowId: string;
  projectId?: string;
  /** Controlled open state (dock toolbar). Omit for edge linguetta + internal state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When true, hide edge linguetta; open/close comes from parent (e.g. dock tab bar). */
  hideEdgeToggle?: boolean;
}

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

export function FlowInterfaceBottomPanel({
  flowId,
  projectId,
  open: openProp,
  onOpenChange,
  hideEdgeToggle = false,
}: FlowInterfaceBottomPanelProps) {
  const { flows } = useFlowWorkspace();
  const { translations } = useProjectTranslations();
  const { conditions } = useInMemoryConditions();
  const flowsRef = useRef(flows);
  flowsRef.current = flows;
  const { updateFlowMeta } = useFlowActions();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? Boolean(openProp) : internalOpen;
  const setOpen = useCallback(
    (next: boolean | ((p: boolean) => boolean)) => {
      if (isControlled) {
        const resolved = typeof next === 'function' ? next(open) : next;
        onOpenChange?.(resolved);
      } else {
        setInternalOpen((prev) => (typeof next === 'function' ? next(prev) : next));
      }
    },
    [isControlled, onOpenChange, open]
  );
  const [removalBlockRefs, setRemovalBlockRefs] = useState<ReferenceLocation[] | null>(null);
  const [dockRegion, setDockRegion] = useState<FlowInterfaceDockRegion>(() => readDockRegion());
  const [panelHeightPx, setPanelHeightPx] = useState(() => readPanelHeight());
  const [panelWidthPx, setPanelWidthPx] = useState(() => readPanelWidth());
  const [resizing, setResizing] = useState(false);
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const flowShellRef = useRef<HTMLDivElement | null>(null);
  /** Flow canvas bounds (same as `absolute inset-0` shell); used to cap panel size. */
  const layoutSizeRef = useRef({ w: 0, h: 0 });
  const [flowShellSize, setFlowShellSize] = useState({ w: 0, h: 0 });

  const flow = flows[flowId];
  const iface = flow?.meta?.flowInterface ?? { input: [] as MappingEntry[], output: [] as MappingEntry[] };
  const flowTitle = (flow?.title && String(flow.title).trim()) || flowId;

  const listIdPrefix = useMemo(() => `flow-iface-${flowId.replace(/[^a-zA-Z0-9_-]/g, '_')}`, [flowId]);

  const conditionPayloads = useMemo(
    () =>
      conditions.map((c) => ({
        id: c.id,
        label: c.label || c.name || c.id,
        text: JSON.stringify(c),
      })),
    [conditions]
  );

  const setInput = useCallback(
    (next: MappingEntry[]) => {
      const out = flows[flowId]?.meta?.flowInterface?.output ?? [];
      updateFlowMeta(flowId, { flowInterface: { input: next, output: out } });
    },
    [flowId, flows, updateFlowMeta]
  );

  const setOutput = useCallback(
    (next: MappingEntry[]) => {
      const pid = String(projectId || '').trim();
      const prevOut = flowsRef.current[flowId]?.meta?.flowInterface?.output ?? [];
      if (pid) {
        for (const p of prevOut) {
          const pvid = String(p.variableRefId || '').trim();
          if (!pvid) continue;
          const stillExists = next.some((n) => String(n.variableRefId || '').trim() === pvid);
          if (!stillExists) {
            const v = validateRemovalOfInterfaceOutputRow(
              pid,
              flowId,
              pvid,
              flowsRef.current as any,
              translations,
              conditionPayloads
            );
            if (!v.ok) {
              setRemovalBlockRefs(v.references);
              return;
            }
          }
        }
      }
      const inn = flowsRef.current[flowId]?.meta?.flowInterface?.input ?? [];
      updateFlowMeta(flowId, { flowInterface: { input: inn, output: next } });
      const curr = flowsRef.current[flowId];
      const merged = {
        ...flowsRef.current,
        [flowId]: {
          ...curr,
          meta: {
            ...(typeof curr?.meta === 'object' && curr?.meta ? curr.meta : {}),
            flowInterface: { input: inn, output: next },
          },
        },
      } as typeof flowsRef.current;
      if (pid) {
        invalidateChildFlowInterfaceCache(pid, flowId);
        void syncSubflowChildInterfaceToAllParents(pid, flowId, merged as any);
      }
    },
    [flowId, projectId, translations, conditionPayloads, updateFlowMeta]
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
      const pid = String(projectId || '').trim();
      if (pid) {
        const shell = flowsRef.current[flowId];
        const merged = {
          ...flowsRef.current,
          [flowId]: {
            ...shell,
            meta: {
              ...(typeof shell?.meta === 'object' && shell?.meta ? shell.meta : {}),
              flowInterface: { input: iface.input, output: nextOut },
            },
          },
        } as typeof flowsRef.current;
        invalidateChildFlowInterfaceCache(pid, flowId);
        void syncSubflowChildInterfaceToAllParents(pid, flowId, merged as any);
      }
    };
    window.addEventListener(FLOW_INTERFACE_ROW_POINTER_DROP, handler as EventListener);
    return () => window.removeEventListener(FLOW_INTERFACE_ROW_POINTER_DROP, handler as EventListener);
  }, [flowId, projectId, updateFlowMeta]);

  const clampHeightFlow = useCallback((px: number) => {
    const h = layoutSizeRef.current.h;
    return clampHeight(px, h > 0 ? h : undefined);
  }, []);

  const clampWidthFlow = useCallback((px: number) => {
    const w = layoutSizeRef.current.w;
    return clampWidth(px, w > 0 ? w : undefined);
  }, []);

  useEffect(() => {
    const el = flowShellRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      const w = Math.floor(cr.width);
      const h = Math.floor(cr.height);
      layoutSizeRef.current = { w, h };
      setFlowShellSize({ w, h });
      setPanelHeightPx((h0) => clampHeight(h0, h > 0 ? h : undefined));
      setPanelWidthPx((w0) => clampWidth(w0, w > 0 ? w : undefined));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onResize = () => {
      const { h, w } = layoutSizeRef.current;
      setPanelHeightPx((h0) => clampHeight(h0, h > 0 ? h : undefined));
      setPanelWidthPx((w0) => clampWidth(w0, w > 0 ? w : undefined));
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

  const getFlowBounds = useCallback(() => flowShellRef.current?.getBoundingClientRect() ?? null, []);

  const { dockDragPreview, dockDragHandlers } = useFlowInterfaceDockDrag(commitDockRegion, getFlowBounds);

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
    const next = clampHeightFlow(start.h + (start.y - e.clientY));
    setPanelHeightPx(next);
  }, [clampHeightFlow]);

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
    const next = clampHeightFlow(start.h + (e.clientY - start.y));
    setPanelHeightPx(next);
  }, [clampHeightFlow]);

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
    const next = clampWidthFlow(start.w + (e.clientX - start.x));
    setPanelWidthPx(next);
  }, [clampWidthFlow]);

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
    const next = clampWidthFlow(start.w + (start.x - e.clientX));
    setPanelWidthPx(next);
  }, [clampWidthFlow]);

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
          const bound = layoutSizeRef.current.h;
          const c = clampHeight(h, bound > 0 ? bound : undefined);
          writePanelHeight(c);
          return c;
        });
      } else {
        setPanelWidthPx((w) => {
          const bound = layoutSizeRef.current.w;
          const c = clampWidth(w, bound > 0 ? bound : undefined);
          writePanelWidth(c);
          return c;
        });
      }
    },
    []
  );

  const interfaceShellHeaderClose = (
    <button
      type="button"
      onClick={() => setOpen(false)}
      onPointerDown={(e) => e.stopPropagation()}
      className="rounded p-0.5 text-white/90 hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      aria-label="Chiudi pannello Interface"
      title="Chiudi"
    >
      <X className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />
    </button>
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
        interfaceShellHeaderExtra={interfaceShellHeaderClose}
      />
    </div>
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
      aria-valuemax={
        typeof window !== 'undefined'
          ? clampHeight(9999, flowShellSize.h > 0 ? flowShellSize.h : undefined)
          : 800
      }
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
      className={`absolute left-0 right-0 ${shellClass} flex-col items-stretch border-t ${transitionClass} ${
        open ? 'bottom-0 translate-y-0' : 'bottom-0 translate-y-full'
      }`}
      style={{ height: panelHeightPx }}
      aria-hidden={!open}
    >
      <div className="flex flex-col h-full min-h-0 pointer-events-auto">
        {bottomSplitter}
        {editor}
      </div>
    </div>
  );

  const topPanel = (
    <div
      className={`absolute left-0 right-0 top-0 ${shellClass} flex-col items-stretch border-b ${transitionClass} ${
        open ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{ height: panelHeightPx }}
      aria-hidden={!open}
    >
      <div className="flex flex-col h-full min-h-0 pointer-events-auto">
        {editor}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-valuenow={panelHeightPx}
          aria-valuemin={MIN_H}
          aria-valuemax={
            typeof window !== 'undefined'
              ? clampHeight(9999, flowShellSize.h > 0 ? flowShellSize.h : undefined)
              : 800
          }
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
      className={`absolute left-0 top-0 bottom-0 ${shellClass} flex-row border-r ${transitionClass} ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{ width: panelWidthPx }}
      aria-hidden={!open}
    >
      <div className="flex flex-row h-full min-h-0 w-full min-w-0 pointer-events-auto">
        {editor}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={panelWidthPx}
          aria-valuemin={MIN_W}
          aria-valuemax={
            typeof window !== 'undefined'
              ? clampWidth(9999, flowShellSize.w > 0 ? flowShellSize.w : undefined)
              : 1200
          }
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
      className={`absolute right-0 top-0 bottom-0 ${shellClass} flex-row border-l ${transitionClass} ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ width: panelWidthPx }}
      aria-hidden={!open}
    >
      <div className="flex flex-row h-full min-h-0 w-full min-w-0 box-border pointer-events-auto">
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={panelWidthPx}
          aria-valuemin={MIN_W}
          aria-valuemax={
            typeof window !== 'undefined'
              ? clampWidth(9999, flowShellSize.w > 0 ? flowShellSize.w : undefined)
              : 1200
          }
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
    'absolute z-[43] flex items-center gap-1.5 border border-violet-600/55 bg-slate-800/95 hover:bg-slate-700/95 text-violet-100 text-xs font-semibold tracking-wide shadow-lg backdrop-blur-sm transition-colors pointer-events-auto';
  const toggleStyle: React.CSSProperties = { WebkitBackdropFilter: 'blur(8px)' };

  /** Linguetta minimale: solo apertura; posizione dock da trascinamento del pannello (header con pannello aperto). */
  const toggleBottom = (
    <div
      className={`${toggleShellBase} bottom-0 left-1/2 -translate-x-1/2 rounded-t-lg border-b-0 px-2 py-2 min-w-[10rem]`}
      style={toggleStyle}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full min-w-0 items-center justify-center gap-2 rounded-md bg-transparent border-0 text-inherit cursor-pointer py-1 px-1"
        aria-expanded={false}
        aria-label="Apri Interface"
        title="Apri Interface"
      >
        <Layers className="w-4 h-4 text-violet-400/90 shrink-0" strokeWidth={2} />
        <span className="truncate max-w-[8rem]" title={flowId}>
          Interface · {flowTitle}
        </span>
        <ChevronUp className="w-4 h-4 shrink-0 opacity-80" />
      </button>
    </div>
  );

  const toggleTop = (
    <div
      className={`${toggleShellBase} left-1/2 top-0 -translate-x-1/2 rounded-b-lg border-t-0 px-2 py-2 min-w-[10rem]`}
      style={toggleStyle}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full min-w-0 items-center justify-center gap-2 rounded-md bg-transparent border-0 text-inherit cursor-pointer py-1 px-1"
        aria-expanded={false}
        aria-label="Apri Interface"
        title="Apri Interface"
      >
        <Layers className="w-4 h-4 text-violet-400/90 shrink-0" strokeWidth={2} />
        <span className="truncate max-w-[8rem]" title={flowId}>
          Interface · {flowTitle}
        </span>
        <ChevronUp className="w-4 h-4 shrink-0 opacity-80 rotate-180" />
      </button>
    </div>
  );

  const toggleLeft = (
    <div
      className={`${toggleShellBase} left-0 top-1/2 -translate-y-1/2 rounded-r-lg border-l-0 flex-col py-3 px-2 min-w-0 max-w-[9rem]`}
      style={toggleStyle}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-center gap-2 rounded-md bg-transparent border-0 text-inherit cursor-pointer py-1 w-full min-w-0"
        aria-expanded={false}
        aria-label="Apri Interface"
        title="Apri Interface"
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
      className={`${toggleShellBase} right-0 top-1/2 -translate-y-1/2 rounded-l-lg border-r-0 flex-col py-3 px-2 min-w-0 max-w-[9rem]`}
      style={toggleStyle}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-center gap-2 rounded-md bg-transparent border-0 text-inherit cursor-pointer py-1 w-full min-w-0"
        aria-expanded={false}
        aria-label="Apri Interface"
        title="Apri Interface"
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
    <div ref={flowShellRef} className="absolute inset-0 z-[38] pointer-events-none">
      {removalBlockRefs !== null ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="iface-removal-block-title"
        >
          <div className="max-w-md w-full rounded-lg border border-violet-500/35 bg-[#0f1218] p-4 shadow-xl text-slate-100">
            <h3 id="iface-removal-block-title" className="text-sm font-semibold mb-2">
              Impossibile rimuovere questo output
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              La variabile nel flow parent (collegamento Subflow) è ancora referenziata con token [GUID] nei punti seguenti.
              Rimuovi quei riferimenti, poi riprova.
            </p>
            <ul className="text-xs max-h-52 overflow-y-auto space-y-1.5 border border-slate-700/80 rounded-md p-2 mb-4 bg-black/20">
              {removalBlockRefs.map((r) => (
                <li key={`${r.kind}:${r.id}`} className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">{r.kind}</span>
                  <span className="font-mono text-violet-200/95 break-all">{r.label}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="rounded-md bg-violet-600/90 hover:bg-violet-500 px-3 py-1.5 text-xs font-medium text-white"
              onClick={() => setRemovalBlockRefs(null)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
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

      {!open && !hideEdgeToggle && dockRegion === 'bottom' ? toggleBottom : null}
      {!open && !hideEdgeToggle && dockRegion === 'top' ? toggleTop : null}
      {!open && !hideEdgeToggle && dockRegion === 'left' ? toggleLeft : null}
      {!open && !hideEdgeToggle && dockRegion === 'right' ? toggleRight : null}
    </div>
  );
}
