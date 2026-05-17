/**
 * Mapping tree: dot paths, folder vs variable icon.
 * Backend SEND/RECEIVE: `BackendMappingTree` (react-arborist + trie wireKey).
 * Interface: ricorsione `MappingTreeRow` con drag variabili / reorder.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WorkspaceState } from '@flows/FlowTypes';
import { useFlowWorkspaceOptional } from '@flows/FlowStore';
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Brackets,
  Pencil,
  StickyNote,
  Table2,
  X,
  AlertTriangle,
  Settings2,
} from 'lucide-react';
import type { MappingEntry } from './mappingTypes';
import type { OpenApiInputUiKind } from '../../services/openApiBackendCallSpec';
import {
  buildMappingTree,
  renameLeafSegment,
  reorderMappingEntries,
  type MappingTreeNode,
  type MappingTreeSiblingOrder,
} from './mappingTreeUtils';
import { LabelWithPencilEdit, type LabelWithPencilEditHandle } from './LabelWithPencilEdit';
import { MappingRowFields } from './MappingRowFields';
import {
  DND_NEW_BACKEND_PARAM,
  expandAncestorsOfPath,
  insertNewBackendParameter,
  isEphemeralNewSegment,
  type ParamDropPlacement,
  type ParamDropPosition,
} from './backendParamInsert';
import {
  DND_FLOWROW_VAR,
  DND_IFACE_REORDER,
  FLOW_INTERFACE_POINTER_PREVIEW,
  parseFlowInterfaceDropFromDataTransfer,
  type FlowInterfaceDropPayload,
  type FlowInterfacePointerPreviewDetail,
} from './flowInterfaceDragTypes';
import {
  handleAgentBackendParamDragOver,
  hasAgentBackendParamDrag,
  parseAgentBackendParamDropFromDataTransfer,
} from '@domain/agentInterface/agentInterfaceDragTypes';
import { mergeBackendMappingVariableDrop } from './backendMappingVariableDrop';
import { getInterfaceTreeRowDisplayLabel } from './interfaceMappingLabels';
import {
  MAPPING_ROW_CELL_H,
  MAPPING_ROW_CELL_MIN_H,
  MAPPING_ROW_ICON_SM,
  MAPPING_ROW_MIN_H,
  MAPPING_ROW_TEXT_CLASS,
} from './mappingPanelTypography';
import {
  BackendReceiveArrowIcon,
  BackendSendArrowIcon,
  resolveSendArrowKind,
  sendArrowTitle,
  type SendArrowGlyphKind,
} from './BackendSendArrowIcon';
import { unwrapSessionTreeWireKey } from './bookFromAgendaSessionTree';
import { BackendMappingDominioValoriPanel } from './backendMappingDominioValori';
import { backendDominioValoriLabelInsetPx } from './backendMappingDominioValoriLayout';
import {
  BACKEND_TREE_ARROW_SLOT_PX,
  BACKEND_TREE_CHEVRON_SLOT_PX,
  backendTreeDepthIndentPx,
} from './backendMappingTreeLayout';
import { BackendMappingTree } from './BackendMappingTree';
import type { BackendSendAdvancementApi } from './backendMappingTreeTypes';
import { MappingParameterToolbarActions, MappingParameterInterfaceRemoveAction } from './MappingParameterToolbarActions';
import { MappingParameterToolbarPortal } from './MappingParameterToolbarPortal';
import { MappingTreeNodeRow } from './MappingTreeNodeRow';
import { setMappingDragLabelGhost } from './mappingDragGhost';
import { writeAgentBackendParamDragData } from '@domain/agentInterface/agentInterfaceDragTypes';
import type { AgentParamDragSource } from './backendMappingTreeContext';
export type { BackendSendAdvancementApi } from './backendMappingTreeTypes';

const DND_TYPE = 'application/x-omnia-varlabel';

function hasNewParamDrag(e: React.DragEvent): boolean {
  return [...e.dataTransfer.types].includes(DND_NEW_BACKEND_PARAM);
}

function hasFlowRowVarDrag(e: React.DragEvent): boolean {
  const types = e.dataTransfer?.types ? [...e.dataTransfer.types] : [];
  if (types.includes(DND_FLOWROW_VAR)) return true;
  const lower = DND_FLOWROW_VAR.toLowerCase();
  return types.some((t) => t.toLowerCase() === lower);
}

/** Hit-test row under cursor (for drag preview when pointer is over nested controls). */
function findBackendMapRowElementFromPoint(clientX: number, clientY: number): HTMLElement | null {
  try {
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const n of stack) {
      if (!(n instanceof HTMLElement)) continue;
      const row = n.closest('[data-backend-map-row]');
      if (row instanceof HTMLElement) return row;
    }
  } catch {
    return null;
  }
  return null;
}

function hasIfaceReorderDrag(e: React.DragEvent): boolean {
  return [...e.dataTransfer.types].includes(DND_IFACE_REORDER);
}

function placementFromY(clientY: number, rowRect: DOMRect, hasChildren: boolean): ParamDropPlacement {
  const y = clientY - rowRect.top;
  const t = rowRect.height > 0 ? y / rowRect.height : 0.5;
  if (hasChildren) {
    if (t < 0.28) return 'before';
    if (t > 0.72) return 'after';
    return 'child';
  }
  return t < 0.5 ? 'before' : 'after';
}

/** Matches row `ml-2` + `pl-2` (8px + 8px) per depth level. */
const ROW_DEPTH_INDENT_PX = 16;
/** Backend flat tree: indentazione uniforme per ogni livello sotto un accordion espanso. */
const BACKEND_FLAT_DEPTH_INDENT_PX = ROW_DEPTH_INDENT_PX;
/**
 * Offset from row left edge toward the row icon (interface / drop line legacy).
 */
const ROW_ICON_LINE_OFFSET_PX = 24;
/** Larghezza cella chevron nel rail backend (griglia fissa, senza indent per profondità). */
const TREE_RAIL_CHEVRON_CELL_PX = 22;

type DropPreviewTone = 'amber' | 'teal' | 'emerald';

function DropPreviewLine({
  indentPx = 0,
  tone = 'amber',
}: {
  indentPx?: number;
  tone?: DropPreviewTone;
}) {
  const toneClass =
    tone === 'teal'
      ? 'bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.55)]'
      : tone === 'emerald'
        ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]'
        : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.55)]';
  return (
    <div
      className={`h-0.5 rounded-full pointer-events-none ${toneClass}`}
      style={{ marginLeft: indentPx }}
      aria-hidden
    />
  );
}

function siblingDropLineIndentPx(depth: number): number {
  return depth * ROW_DEPTH_INDENT_PX + ROW_ICON_LINE_OFFSET_PX;
}

function childDropLineIndentPx(depth: number): number {
  return (depth + 1) * ROW_DEPTH_INDENT_PX + ROW_ICON_LINE_OFFSET_PX;
}

function resolveInterfaceParamSide(
  interfaceZone: 'input' | 'output' | undefined,
  entry: MappingEntry | undefined
): 'send' | 'receive' | null {
  if (!entry) return null;
  if (entry.sourceSide === 'send' || entry.sourceSide === 'receive') return entry.sourceSide;
  if (interfaceZone === 'input') return 'send';
  if (interfaceZone === 'output') return 'receive';
  return null;
}

function InterfaceParamArrow({
  side,
  entry,
}: {
  side: 'send' | 'receive';
  entry?: MappingEntry;
}): React.ReactElement {
  if (side === 'send') {
    const kind = entry ? resolveSendArrowKind(entry.apiField, entry) : 'filledSolid';
    return <BackendSendArrowIcon kind={kind} title={sendArrowTitle(kind)} compact />;
  }
  const optional = Boolean(entry?.sendBindingOptional);
  return <BackendReceiveArrowIcon optional={optional} compact />;
}

/** Mapping con `wireKey` sotto `pathKey` (discendenti diretti o annidati). */
function countDescendantMappingEntries(entries: MappingEntry[], pathKey: string): number {
  const base = pathKey.trim();
  if (!base) return 0;
  const prefix = `${base}.`;
  let n = 0;
  for (const e of entries) {
    const w = e.wireKey.trim();
    if (w.startsWith(prefix)) n += 1;
  }
  return n;
}

export interface FlowMappingTreeProps {
  variant: 'backend' | 'interface';
  entries: MappingEntry[];
  onEntriesChange: (next: MappingEntry[]) => void;
  apiOptions: string[];
  variableOptions: string[];
  listIdPrefix: string;
  showDropZone?: boolean;
  onDropVariable?: (payload: FlowInterfaceDropPayload) => void;
  /** Backend: enable drag-from-header new parameter + drop targets */
  enableBackendParamDrop?: boolean;
  /** Agent interface: accept backend signature palette drag on INPUT/OUTPUT. */
  enableAgentBackendParamDrop?: boolean;
  /** Drag leaf params to agent Interface (embedded backend editor). */
  agentParamDragSource?: AgentParamDragSource;
  /** Backend: when false, only variable field is shown per row */
  showApiFields?: boolean;
  /** Interface: resolve variable display names */
  projectId?: string;
  /** Interface: canvas flow id for pointer-drag preview + row data-* attributes. */
  flowCanvasId?: string;
  interfaceZone?: 'input' | 'output';
  /** Visual order of sibling rows; `alphabetical` sorts by internal segment (backend: drag-reorder disabled). */
  siblingOrder?: MappingTreeSiblingOrder;
  /** Backend: arrow direction in the row gutter (SEND →, RECEIVE ←). */
  backendColumn?: 'send' | 'receive';
  /** Backend RECEIVE: crea variabile manuale da nome digitato. */
  onCreateOutputVariable?: (displayName: string) => { id: string; label: string } | null;
  onOutputVariableCreated?: () => void;
  /**
   * Backend: id variabili note (es. GUID da `variableCreationService`) per split variabile vs costante su `inputs[].variable`.
   * Se omesso, l’adapter usa la modalità legacy (tutto in `variableRefId`).
   */
  backendKnownVariableIds?: ReadonlySet<string>;
  /** Backend SEND: tipo editor costante (OpenAPI) per wireKey. */
  backendSendParamKindByWireKey?: Record<string, OpenApiInputUiKind>;
  /** Backend SEND: valori enum OpenAPI per costante (wireKey). */
  backendSendParamEnumByWireKey?: Record<string, string[]>;
  /** Backend SEND: checkbox avanzamento + editor inline per riga (batch progression). */
  backendSendAdvancement?: BackendSendAdvancementApi;
  /**
   * Embedded Backend Call: when `false`, SEND rows close the parameter-constraint panel (`rowExtra === 'config'`).
   * Mirrors the toolbar «Signature» sub-row so panels do not stay open when that strip is collapsed.
   */
  embeddedSignatureSubToolbarOpen?: boolean;
  /** Scroll verticale sul contenitore padre (workspace inspector). */
  scrollMappingInParent?: boolean;
}

function updateEntry(entries: MappingEntry[], id: string, patch: Partial<MappingEntry>): MappingEntry[] {
  return entries.map((e) => {
    if (e.id !== id) return e;
    const next: MappingEntry = { ...e, ...patch };
    if (Object.prototype.hasOwnProperty.call(patch, 'literalConstant') && patch.literalConstant === undefined) {
      delete (next as MappingEntry & { literalConstant?: string }).literalConstant;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'variableRefId') && patch.variableRefId === undefined) {
      delete (next as MappingEntry & { variableRefId?: string }).variableRefId;
    }
    return next;
  });
}

function removeEntry(entries: MappingEntry[], id: string): MappingEntry[] {
  return entries.filter((e) => e.id !== id);
}

export type DropIndicatorState = {
  targetPathKey: string;
  placement: ParamDropPlacement;
} | null;

interface RowProps {
  node: MappingTreeNode;
  depth: number;
  variant: 'backend' | 'interface';
  collapsed: Set<string>;
  toggleCollapsed: (pathKey: string) => void;
  listIdPrefix: string;
  entries: MappingEntry[];
  onEntriesChange: (next: MappingEntry[]) => void;
  enableBackendParamDrop: boolean;
  showApiFields: boolean;
  dropIndicator: DropIndicatorState;
  onBackendParamDragOver: (pathKey: string, placement: ParamDropPlacement) => void;
  pendingLabelEditId: string | null;
  onConsumeLabelEditIntent: () => void;
  onInsertBackendParam: (pos: ParamDropPosition) => void;
  onAbandonEphemeralEntry: (entryId: string) => void;
  /** Backend: drop variabile da flow (DND_FLOWROW_VAR) con inserimento a posizione. */
  onBackendFlowVariableDrop?: (e: React.DragEvent, pos: ParamDropPosition) => void;
  projectId?: string;
  flowCanvasId?: string;
  /** Live workspace flows (Interface leaf labels + task row fallback). */
  workspaceFlows?: WorkspaceState['flows'];
  ifacePointerPreview: FlowInterfacePointerPreviewDetail | null;
  enableRowReorder: boolean;
  ifaceReorderDrag: { targetPathKey: string; placement: 'before' | 'after' } | null;
  reorderDragSourceIdRef: React.MutableRefObject<string | null>;
  onIfaceReorderHover: (pathKey: string, placement: 'before' | 'after') => void;
  onIfaceReorderCommit: (fromId: string, targetId: string, placeAfter: boolean) => void;
  backendColumn?: 'send' | 'receive';
  variableOptions: string[];
  onCreateOutputVariable?: (displayName: string) => { id: string; label: string } | null;
  onOutputVariableCreated?: () => void;
  backendKnownVariableIds?: ReadonlySet<string>;
  backendSendParamKindByWireKey?: Record<string, OpenApiInputUiKind>;
  backendSendParamEnumByWireKey?: Record<string, string[]>;
  backendSendAdvancement?: BackendSendAdvancementApi;
  /** Backend: freccia e testo su griglia a margine fisso (indent solo nel binario ad albero). */
  flatTreeGrid?: boolean;
  /** Larghezza binario ad albero (px); usata solo con `flatTreeGrid`. */
  treeRailWidthPx?: number;
  embeddedSignatureSubToolbarOpen?: boolean;
  /** Backend: layout albero compatto (indent + slot fissi, senza rail w-14). */
  backendCleanTree?: boolean;
  agentParamDragSource?: AgentParamDragSource;
  enableAgentBackendParamDrop?: boolean;
  interfaceZone?: 'input' | 'output';
  onAgentBackendParamDrop?: (payload: import('./flowInterfaceDragTypes').FlowInterfaceDropPayload) => void;
}

function MappingTreeRow({
  node,
  depth,
  variant,
  collapsed,
  toggleCollapsed,
  listIdPrefix,
  entries,
  onEntriesChange,
  enableBackendParamDrop,
  showApiFields,
  dropIndicator,
  onBackendParamDragOver,
  pendingLabelEditId,
  onConsumeLabelEditIntent,
  onInsertBackendParam,
  onAbandonEphemeralEntry,
  onBackendFlowVariableDrop,
  projectId,
  flowCanvasId,
  workspaceFlows,
  ifacePointerPreview,
  enableRowReorder,
  ifaceReorderDrag,
  reorderDragSourceIdRef,
  onIfaceReorderHover,
  onIfaceReorderCommit,
  backendColumn,
  variableOptions,
  onCreateOutputVariable,
  onOutputVariableCreated,
  backendKnownVariableIds,
  backendSendParamKindByWireKey,
  backendSendParamEnumByWireKey,
  backendSendAdvancement,
  flatTreeGrid,
  treeRailWidthPx,
  embeddedSignatureSubToolbarOpen,
  backendCleanTree: backendCleanTreeProp = false,
  agentParamDragSource,
  enableAgentBackendParamDrop = false,
  interfaceZone,
  onAgentBackendParamDrop,
}: RowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const valueAnchorRef = useRef<HTMLDivElement>(null);
  const labelEditRef = useRef<LabelWithPencilEditHandle>(null);
  const [rowExtra, setRowExtra] = useState<'none' | 'notes' | 'values' | 'config'>('none');
  const [paramHovered, setParamHovered] = useState(false);
  const paramHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onParamEnter = useCallback(() => {
    if (paramHideTimerRef.current != null) clearTimeout(paramHideTimerRef.current);
    setParamHovered(true);
  }, []);

  const onParamLeave = useCallback(() => {
    if (paramHideTimerRef.current != null) clearTimeout(paramHideTimerRef.current);
    paramHideTimerRef.current = setTimeout(() => setParamHovered(false), 120);
  }, []);

  useEffect(() => {
    if (embeddedSignatureSubToolbarOpen !== false) return;
    setRowExtra((x) => (x === 'config' ? 'none' : x));
  }, [embeddedSignatureSubToolbarOpen]);
  const hasChildren = node.children.length > 0;
  const isExpanded = !collapsed.has(node.pathKey);
  const hasEntry = Boolean(node.entry);
  const isGroupOnly = hasChildren && !hasEntry;
  const canRenameLabel = Boolean(node.entry && !hasChildren);
  /** Interface: single variable name in tree; no separate alias column. */
  const leafLabelEditable = canRenameLabel && variant !== 'interface';

  const backendCleanTree = variant === 'backend' && backendCleanTreeProp;
  const flatBackendRowLayout = Boolean(
    !backendCleanTree && flatTreeGrid && typeof treeRailWidthPx === 'number' && treeRailWidthPx > 0
  );
  const backendDense = variant === 'backend';
  const rowMinH = MAPPING_ROW_MIN_H;
  const cellH = MAPPING_ROW_CELL_H;
  const cellMinH = MAPPING_ROW_CELL_MIN_H;
  const iconSm = MAPPING_ROW_ICON_SM;
  const rowTextClass = MAPPING_ROW_TEXT_CLASS;
  const interfaceParamSide =
    variant === 'interface' ? resolveInterfaceParamSide(interfaceZone, node.entry) : null;
  /** Linee drop: offset allineato al gutter riga. */
  const dropLineIndentSibling = (d: number) =>
    backendCleanTree
      ? backendTreeDepthIndentPx(d) + Math.floor(BACKEND_TREE_CHEVRON_SLOT_PX / 2)
      : flatBackendRowLayout
        ? d * BACKEND_FLAT_DEPTH_INDENT_PX + ROW_ICON_LINE_OFFSET_PX
        : siblingDropLineIndentPx(d);
  const dropLineIndentChild = (d: number) =>
    backendCleanTree
      ? backendTreeDepthIndentPx(d + 1) + Math.floor(BACKEND_TREE_CHEVRON_SLOT_PX / 2)
      : flatBackendRowLayout
        ? (d + 1) * BACKEND_FLAT_DEPTH_INDENT_PX + ROW_ICON_LINE_OFFSET_PX
        : childDropLineIndentPx(d);

  const backendFlatDepthPaddingPx = flatBackendRowLayout ? depth * BACKEND_FLAT_DEPTH_INDENT_PX : 0;

  const hiddenDescendantParamCount = useMemo(
    () => countDescendantMappingEntries(entries, node.pathKey),
    [entries, node.pathKey]
  );
  const collapsedParamCountSuffix =
    hasChildren && !isExpanded ? (
      <span
        className="shrink-0 whitespace-nowrap text-[10px] font-medium tabular-nums text-slate-500"
        aria-label={`${hiddenDescendantParamCount} parametri nascosti`}
      >
        ({hiddenDescendantParamCount})
      </span>
    ) : null;

  const patchEntry = useCallback(
    (patch: Partial<MappingEntry>) => {
      if (!node.entry) return;
      onEntriesChange(updateEntry(entries, node.entry!.id, patch));
    },
    [entries, node.entry, onEntriesChange]
  );

  const handleRenameSegment = useCallback(
    (newSegment: string) => {
      if (!node.entry) return;
      const nextPath = renameLeafSegment(node.pathKey, newSegment);
      onEntriesChange(
        entries.map((e) => {
          if (e.id !== node.entry!.id) return e;
          return { ...e, wireKey: nextPath };
        })
      );
    },
    [entries, node.entry, node.pathKey, onEntriesChange]
  );

  const handleRemove = useCallback(() => {
    if (!node.entry) return;
    onEntriesChange(removeEntry(entries, node.entry.id));
  }, [entries, node.entry, onEntriesChange]);

  const datalistApi = `${listIdPrefix}-api`;
  const datalistVar = `${listIdPrefix}-var`;

  const onRowDragOver = useCallback(
    (e: React.DragEvent) => {
      if (
        variant === 'interface' &&
        enableAgentBackendParamDrop &&
        handleAgentBackendParamDragOver(e, interfaceZone)
      ) {
        return;
      }
      if (!enableBackendParamDrop || variant !== 'backend') return;
      if (hasFlowRowVarDrag(e)) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        const el = rowRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const p = placementFromY(e.clientY, rect, hasChildren);
        onBackendParamDragOver(node.pathKey, p);
        return;
      }
      if (!hasNewParamDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      const el = rowRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const p = placementFromY(e.clientY, rect, hasChildren);
      onBackendParamDragOver(node.pathKey, p);
    },
    [enableAgentBackendParamDrop, enableBackendParamDrop, interfaceZone, variant, hasChildren, node.pathKey, onBackendParamDragOver]
  );

  const onRowDrop = useCallback(
    (e: React.DragEvent) => {
      if (variant === 'interface' && enableAgentBackendParamDrop && onAgentBackendParamDrop) {
        e.preventDefault();
        e.stopPropagation();
        const agent = parseAgentBackendParamDropFromDataTransfer(e.dataTransfer);
        if (agent) {
          if (interfaceZone === 'input' && agent.side !== 'send') return;
          if (interfaceZone === 'output' && agent.side !== 'receive') return;
          onAgentBackendParamDrop({ wireKey: agent.wireKey, agentBackendParam: agent });
        }
        return;
      }
      if (!enableBackendParamDrop || variant !== 'backend') return;
      if (hasFlowRowVarDrag(e) && onBackendFlowVariableDrop) {
        const el = rowRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const placement = placementFromY(e.clientY, rect, hasChildren);
        onBackendFlowVariableDrop(e, { targetPathKey: node.pathKey, placement });
        return;
      }
      if (!hasNewParamDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      const el = rowRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const placement = placementFromY(e.clientY, rect, hasChildren);
      onInsertBackendParam({ targetPathKey: node.pathKey, placement });
    },
    [
      enableAgentBackendParamDrop,
      enableBackendParamDrop,
      interfaceZone,
      onAgentBackendParamDrop,
      variant,
      hasChildren,
      node.pathKey,
      onInsertBackendParam,
      onBackendFlowVariableDrop,
    ]
  );

  const handleIfaceReorderDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!enableRowReorder || !node.entry) return;
      if (!hasIfaceReorderDrag(e)) return;
      const fromId = reorderDragSourceIdRef.current;
      if (!fromId || fromId === node.entry.id) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      const rect = rowRef.current?.getBoundingClientRect();
      if (!rect) return;
      const placement = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      onIfaceReorderHover(node.pathKey, placement);
    },
    [enableRowReorder, node.entry, node.pathKey, onIfaceReorderHover, reorderDragSourceIdRef]
  );

  const handleIfaceReorderDrop = useCallback(
    (e: React.DragEvent) => {
      if (!enableRowReorder || !node.entry) return;
      if (!hasIfaceReorderDrag(e)) return;
      const fromId = reorderDragSourceIdRef.current;
      if (!fromId || fromId === node.entry.id) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = rowRef.current?.getBoundingClientRect();
      if (!rect) return;
      const placeAfter = e.clientY >= rect.top + rect.height / 2;
      onIfaceReorderCommit(fromId, node.entry.id, placeAfter);
    },
    [enableRowReorder, node.entry, onIfaceReorderCommit, reorderDragSourceIdRef]
  );

  const combinedRowDragOver = useCallback(
    (e: React.DragEvent) => {
      if (enableRowReorder && hasIfaceReorderDrag(e)) {
        handleIfaceReorderDragOver(e);
        return;
      }
      onRowDragOver(e);
    },
    [enableRowReorder, handleIfaceReorderDragOver, onRowDragOver]
  );

  const combinedRowDrop = useCallback(
    (e: React.DragEvent) => {
      if (enableRowReorder && hasIfaceReorderDrag(e)) {
        handleIfaceReorderDrop(e);
        return;
      }
      onRowDrop(e);
    },
    [enableRowReorder, handleIfaceReorderDrop, onRowDrop]
  );

  const showBefore =
    enableBackendParamDrop &&
    dropIndicator?.targetPathKey === node.pathKey &&
    dropIndicator.placement === 'before';
  const showAfter =
    enableBackendParamDrop &&
    dropIndicator?.targetPathKey === node.pathKey &&
    dropIndicator.placement === 'after';
  const showChildLine =
    enableBackendParamDrop &&
    hasChildren &&
    isExpanded &&
    dropIndicator?.targetPathKey === node.pathKey &&
    dropIndicator.placement === 'child';

  const showIfaceBefore =
    variant === 'interface' &&
    ifacePointerPreview?.targetPathKey === node.pathKey &&
    ifacePointerPreview.placement === 'before';
  const showIfaceAfter =
    variant === 'interface' &&
    ifacePointerPreview?.targetPathKey === node.pathKey &&
    ifacePointerPreview.placement === 'after';
  const showReorderBefore =
    enableRowReorder &&
    ifaceReorderDrag?.targetPathKey === node.pathKey &&
    ifaceReorderDrag.placement === 'before';
  const showReorderAfter =
    enableRowReorder &&
    ifaceReorderDrag?.targetPathKey === node.pathKey &&
    ifaceReorderDrag.placement === 'after';

  const reorderLineTone: DropPreviewTone =
    variant === 'backend' && backendColumn === 'send'
      ? 'teal'
      : variant === 'backend' && backendColumn === 'receive'
        ? 'emerald'
        : 'amber';

  const ephemeralNew = Boolean(node.entry && isEphemeralNewSegment(node.segment));

  const wireKey = node.entry?.wireKey?.trim() ?? '';
  const advancementWireKey = unwrapSessionTreeWireKey(wireKey);
  const showAdvancementUi =
    variant === 'backend' &&
    backendColumn === 'send' &&
    Boolean(node.entry) &&
    !isGroupOnly &&
    Boolean(backendSendAdvancement) &&
    !ephemeralNew;

  /** Una sola altezza riga per freccia/checkbox/label/valore quando l’avanzamento è collassato (h-7). */
  const rowAlignClass = 'items-center';

  const handleAbandonEphemeral = useCallback(() => {
    if (node.entry) onAbandonEphemeralEntry(node.entry.id);
  }, [node.entry, onAbandonEphemeralEntry]);

  const ifaceRowAttrs =
    variant === 'interface' && flowCanvasId
      ? ({
          'data-flow-iface-row': '',
          'data-path-key': node.pathKey,
          'data-flow-canvas-id': flowCanvasId,
        } as const)
      : {};

  useEffect(() => {
    setRowExtra('none');
  }, [node.pathKey]);

  const descTitle =
    variant === 'backend' && node.entry?.fieldDescription?.trim()
      ? node.entry.fieldDescription.trim()
      : undefined;

  /** Solo descrizione campo: niente didascalie one-of nel tooltip (restano in compile / doc OpenAPI). */
  const backendMappingViewTitle = variant === 'backend' ? descTitle : undefined;

  const receiveOptional =
    variant === 'backend' && backendColumn === 'receive' && node.entry && !isGroupOnly
      ? Boolean(node.entry.sendBindingOptional)
      : false;

  const sendOptionalLabelClass =
    variant === 'backend' && backendColumn === 'send' && node.entry?.sendBindingOptional
      ? 'italic text-slate-400/95 underline decoration-dotted decoration-slate-500/75 underline-offset-[3px]'
      : undefined;

  const receiveOptionalLabelClass =
    variant === 'backend' && backendColumn === 'receive' && node.entry && receiveOptional
      ? 'italic text-slate-400/95 underline decoration-dotted decoration-slate-500/75 underline-offset-[3px]'
      : undefined;

  const segmentToneClass = sendOptionalLabelClass ?? receiveOptionalLabelClass;

  const sendGlyphKind: SendArrowGlyphKind =
    variant === 'backend' && backendColumn === 'send' && node.entry && !isGroupOnly
      ? resolveSendArrowKind(node.entry.apiField, node.entry)
      : 'filledSolid';

  const dominioValoriAlignPx =
    variant === 'backend' && node.entry && !isGroupOnly
      ? backendCleanTree
        ? backendDominioValoriCleanTreeInsetPx({
            depth,
            showAdvancementUi,
            hasOpenApiDrift: Boolean(node.entry.openapiDescriptionDrift),
          })
        : backendDominioValoriLabelInsetPx({
            showAdvancementUi,
            hasOpenApiDrift: Boolean(node.entry.openapiDescriptionDrift),
            treeRailWidthPx: flatBackendRowLayout ? treeRailWidthPx : undefined,
            treeDepthIndentPx: flatBackendRowLayout ? backendFlatDepthPaddingPx : undefined,
          })
      : 0;

  const depthLegacyGutter = backendCleanTree
    ? depth > 0
      ? 'ml-1 border-l border-slate-700/40 pl-1'
      : ''
    : !flatBackendRowLayout && depth > 0
      ? 'ml-2 border-l border-slate-700/40 pl-2'
      : '';

  const chevronToggle = hasChildren ? (
    <button
      type="button"
      className={`rounded ${backendDense ? 'p-px' : 'p-0.5'} text-slate-400 hover:text-slate-200`}
      aria-expanded={isExpanded}
      onClick={() => toggleCollapsed(node.pathKey)}
    >
      {isExpanded ? <ChevronDown className={iconSm} /> : <ChevronRight className={iconSm} />}
    </button>
  ) : null;

  const chevronControl = chevronToggle ?? (
    <span className={`inline-block ${backendDense ? 'w-3.5' : 'w-4'} shrink-0`} aria-hidden />
  );

  const useUnifiedNodeRow = variant === 'interface' && !flatBackendRowLayout;

  const ifaceParamArrow =
    isGroupOnly || !interfaceParamSide ? null : (
      <InterfaceParamArrow side={interfaceParamSide} entry={node.entry} />
    );

  const ifaceLabelNode = (
    <LabelWithPencilEdit
      ref={labelEditRef}
      segment={node.segment}
      displayLabel={
        node.entry
          ? getInterfaceTreeRowDisplayLabel(node.entry, node.segment, projectId, {
              flowCanvasId,
              flows: workspaceFlows,
            })
          : undefined
      }
      editable={leafLabelEditable}
      onCommit={handleRenameSegment}
      editIntent={Boolean(node.entry && pendingLabelEditId === node.entry.id)}
      onConsumeEditIntent={onConsumeLabelEditIntent}
      ephemeralNew={ephemeralNew}
      onAbandonEphemeral={ephemeralNew ? handleAbandonEphemeral : undefined}
      inlinePencil
      viewTitle={backendMappingViewTitle}
      segmentClassName={segmentToneClass}
      readOnlyPreferWrap={false}
      textSizeClass={rowTextClass}
      hoverHighlight={Boolean(node.entry && !isGroupOnly)}
    />
  );

  const ifaceValueEditor = (
    <MappingRowFields
      variant="interface"
      entry={node.entry}
      groupOnlyInterface={isGroupOnly}
      showApiFields
      secondaryFieldsLocked={false}
      suppressFieldTabFocus={Boolean(node.entry && pendingLabelEditId === node.entry.id)}
      datalistApiId={datalistApi}
      datalistVarId={datalistVar}
      onPatch={patchEntry}
      backendColumn={backendColumn}
      variableOptions={variableOptions}
      onCreateOutputVariable={onCreateOutputVariable}
      onOutputVariableCreated={onOutputVariableCreated}
      backendKnownVariableIds={backendKnownVariableIds}
      backendSendParamKindByWireKey={backendSendParamKindByWireKey}
      backendSendParamEnumByWireKey={backendSendParamEnumByWireKey}
    />
  );

  return (
    <div className="select-none" {...ifaceRowAttrs}>
      {(showBefore || showIfaceBefore || showReorderBefore) && (
        <DropPreviewLine
          indentPx={dropLineIndentSibling(depth)}
          tone={showReorderBefore ? reorderLineTone : 'amber'}
        />
      )}
      <div className={`relative overflow-visible ${depthLegacyGutter}`}>
        {useUnifiedNodeRow ? (
          <MappingTreeNodeRow
            rowRef={rowRef}
            isGroup={isGroupOnly}
            chevron={chevronToggle}
            arrow={ifaceParamArrow}
            label={ifaceLabelNode}
            labelSuffix={collapsedParamCountSuffix}
            valueEditor={isGroupOnly ? null : ifaceValueEditor}
            toolbar={
              node.entry && !isGroupOnly ? (
                <MappingParameterInterfaceRemoveAction onRemove={handleRemove} />
              ) : null
            }
            draggable={Boolean(enableRowReorder && node.entry)}
            onDragStart={(e) => {
              if (!enableRowReorder || !node.entry) return;
              const t = e.target as HTMLElement;
              if (t.closest('button, input, textarea, select, [role="combobox"]')) {
                e.preventDefault();
                return;
              }
              e.stopPropagation();
              reorderDragSourceIdRef.current = node.entry.id;
              e.dataTransfer.setData(DND_IFACE_REORDER, node.entry.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={combinedRowDragOver}
            onDragOverCapture={combinedRowDragOver}
            onDrop={combinedRowDrop}
            rowProps={{
              onDragEnd: () => {
                reorderDragSourceIdRef.current = null;
              },
            }}
          />
        ) : (
        <div
          ref={rowRef}
          {...(variant === 'backend' && enableBackendParamDrop
            ? ({
                'data-backend-map-row': node.pathKey,
                'data-backend-map-has-children': hasChildren ? '1' : '0',
              } as const)
            : {})}
          draggable={Boolean(enableRowReorder && node.entry)}
          onDragStart={(e) => {
            if (!enableRowReorder || !node.entry) return;
            const t = e.target as HTMLElement;
            if (t.closest('button, input, textarea, select, [role="combobox"]')) {
              e.preventDefault();
              return;
            }
            e.stopPropagation();
            reorderDragSourceIdRef.current = node.entry.id;
            e.dataTransfer.setData(DND_IFACE_REORDER, node.entry.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => {
            reorderDragSourceIdRef.current = null;
          }}
          className={`group/row flex ${rowAlignClass} gap-1 ${rowMinH} rounded-md py-0 pr-0.5 -mx-0.5 ${
            backendCleanTree
              ? ''
              : variant === 'backend' && flatBackendRowLayout
                ? 'items-start gap-0'
                : ''
          } ${
            enableRowReorder && node.entry ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
          style={
            backendCleanTree
              ? { paddingLeft: backendTreeDepthIndentPx(depth) }
              : backendFlatDepthPaddingPx > 0
                ? { paddingLeft: backendFlatDepthPaddingPx }
                : undefined
          }
          onDragOver={combinedRowDragOver}
          onDragOverCapture={combinedRowDragOver}
          onDrop={combinedRowDrop}
        >
        {backendCleanTree ? (
          <>
            <div
              className={`flex shrink-0 items-center justify-center ${cellMinH}`}
              style={{ width: BACKEND_TREE_CHEVRON_SLOT_PX }}
            >
              {chevronControl}
            </div>
            {!isGroupOnly ? (
              <div
                className={`flex shrink-0 items-center justify-center ${cellH}`}
                style={{ width: BACKEND_TREE_ARROW_SLOT_PX }}
                title={
                  variant === 'backend' && backendColumn === 'send'
                    ? sendArrowTitle(sendGlyphKind)
                    : variant === 'backend' && backendColumn === 'receive'
                      ? receiveOptional
                        ? 'Parametro in ingresso (da API). Opzionale.'
                        : 'Parametro in ingresso (da API). Obbligatorio.'
                      : 'Parametro'
                }
              >
                {variant === 'backend' && backendColumn === 'send' ? (
                  <BackendSendArrowIcon
                    kind={sendGlyphKind}
                    title={sendArrowTitle(sendGlyphKind)}
                    compact
                  />
                ) : variant === 'backend' && backendColumn === 'receive' ? (
                  <BackendReceiveArrowIcon optional={receiveOptional} compact />
                ) : variant === 'interface' && interfaceParamSide ? (
                  <InterfaceParamArrow side={interfaceParamSide} entry={node.entry} />
                ) : (
                  <Brackets className={iconSm} strokeWidth={2} aria-hidden />
                )}
              </div>
            ) : null}
          </>
        ) : flatBackendRowLayout && treeRailWidthPx != null ? (
          <div
            className="flex shrink-0 items-stretch border-r border-slate-800/20 bg-slate-950/20"
            style={{ width: treeRailWidthPx }}
          >
            <div
              className={`flex ${cellMinH} min-w-0 flex-1 justify-start pl-0 ${
                variant === 'backend' && isGroupOnly && flatBackendRowLayout
                  ? backendDense
                    ? 'items-start pt-px'
                    : 'items-start pt-0.5'
                  : 'items-center'
              }`}
            >
              {chevronControl}
            </div>
          </div>
        ) : (
          <div className={`flex ${cellH} ${cellMinH} min-w-[1rem] shrink-0 items-center justify-start gap-0.5`}>{chevronControl}</div>
        )}

        {!backendCleanTree && (variant !== 'backend' || !isGroupOnly) ? (
        <div
          className={`flex ${cellH} shrink-0 items-center justify-center pr-0`}
          style={{ width: BACKEND_TREE_ARROW_SLOT_PX }}
          title={
            isGroupOnly
              ? node.segment === 'Session'
                ? 'Session · scope progetto e conversazione (BookFromAgenda)'
                : 'Gruppo'
              : variant === 'backend' && backendColumn === 'send'
                ? sendArrowTitle(sendGlyphKind)
                : variant === 'backend' && backendColumn === 'receive'
                  ? receiveOptional
                    ? 'Parametro in ingresso (da API). Opzionale.'
                    : 'Parametro in ingresso (da API). Obbligatorio.'
                  : interfaceParamSide === 'send'
                    ? sendArrowTitle(
                        node.entry ? resolveSendArrowKind(node.entry.apiField, node.entry) : 'filledSolid'
                      )
                    : interfaceParamSide === 'receive'
                      ? 'Parametro in ingresso (da API).'
                      : 'Parametro'
          }
        >
          {isGroupOnly ? (
            <span className={`inline-block ${iconSm} shrink-0`} aria-hidden />
          ) : variant === 'interface' && interfaceParamSide ? (
            <InterfaceParamArrow side={interfaceParamSide} entry={node.entry} />
          ) : variant === 'backend' && backendColumn === 'send' ? (
            <BackendSendArrowIcon kind={sendGlyphKind} title={sendArrowTitle(sendGlyphKind)} compact />
          ) : variant === 'backend' && backendColumn === 'receive' ? (
            <BackendReceiveArrowIcon optional={receiveOptional} compact />
          ) : (
            <Brackets className={iconSm} strokeWidth={2} aria-hidden />
          )}
        </div>
        ) : null}

        {showAdvancementUi ? (
          <div
            className={`flex ${cellH} shrink-0 items-center`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              className={`${backendDense ? 'h-3 w-3' : 'h-3.5 w-3.5'} cursor-pointer rounded border-slate-500 bg-slate-900 text-teal-500 focus:ring-teal-500/40`}
              checked={backendSendAdvancement!.isEnabled(advancementWireKey)}
              onChange={(e) => backendSendAdvancement!.onToggle(advancementWireKey, e.target.checked)}
              title="Avanzamento tra batch"
              aria-label="Avanzamento parametro"
            />
          </div>
        ) : null}

        <div
          className={`flex min-w-0 shrink-0 items-center gap-0 ${
            node.entry && !isGroupOnly ? 'flex-1' : backendCleanTree ? 'flex-1' : ''
          } ${rowMinH} ${
            node.entry && !isGroupOnly && agentParamDragSource ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
          onMouseEnter={node.entry && !isGroupOnly ? onParamEnter : undefined}
          onMouseLeave={node.entry && !isGroupOnly ? onParamLeave : undefined}
          draggable={Boolean(
            node.entry && !isGroupOnly && agentParamDragSource && variant === 'backend' && !ephemeralNew
          )}
          onDragStart={
            node.entry && !isGroupOnly && agentParamDragSource && variant === 'backend' && !ephemeralNew
              ? (e) => {
                  const t = e.target as HTMLElement;
                  if (t.closest('button, input, textarea, select, [role="combobox"]')) {
                    e.preventDefault();
                    return;
                  }
                  const side = backendColumn === 'receive' ? 'receive' : 'send';
                  writeAgentBackendParamDragData(e.dataTransfer, {
                    wireKey: node.entry!.wireKey,
                    backendTaskId: agentParamDragSource.backendTaskId,
                    side,
                    ...(agentParamDragSource.backendLabel
                      ? { backendLabel: agentParamDragSource.backendLabel }
                      : {}),
                  });
                  setMappingDragLabelGhost(e, node.segment);
                }
              : undefined
          }
        >
        <div
          className={`group/label-slot relative flex ${rowMinH} min-w-0 shrink-0 gap-0 pl-0 ${
            backendCleanTree ? 'max-w-none flex-1' : 'max-w-[min(20rem,52vw)]'
          } ${
            variant === 'backend' && flatBackendRowLayout && !backendCleanTree ? 'items-start' : 'items-center'
          }`}
        >
          {variant === 'backend' && node.entry?.openapiDescriptionDrift ? (
            <span
              className="shrink-0 text-amber-400"
              title={
                node.entry.openapiDescriptionHint
                  ? `Descrizione salvata diversa da OpenAPI.\nOpenAPI: ${node.entry.openapiDescriptionHint}`
                  : 'Descrizione salvata diversa da OpenAPI'
              }
            >
              <AlertTriangle className={iconSm} strokeWidth={2} aria-hidden />
            </span>
          ) : null}
          <div
            className={`min-w-0 flex-1 flex ${
              variant === 'backend' ? 'items-center gap-0.5' : 'items-baseline gap-1'
            } ${
              variant === 'backend' && !leafLabelEditable ? '' : 'overflow-hidden'
            }`}
          >
            <div className="min-w-0 flex-1">
            <LabelWithPencilEdit
              ref={labelEditRef}
              segment={node.segment}
              displayLabel={
                variant === 'interface' && node.entry
                  ? getInterfaceTreeRowDisplayLabel(node.entry, node.segment, projectId, {
                      flowCanvasId,
                      flows: workspaceFlows,
                    })
                  : undefined
              }
              editable={leafLabelEditable}
              onCommit={handleRenameSegment}
              editIntent={Boolean(node.entry && pendingLabelEditId === node.entry.id)}
              onConsumeEditIntent={onConsumeLabelEditIntent}
              ephemeralNew={ephemeralNew}
              onAbandonEphemeral={ephemeralNew ? handleAbandonEphemeral : undefined}
              inlinePencil={variant !== 'backend'}
              viewTitle={backendMappingViewTitle}
              segmentClassName={segmentToneClass}
              readOnlyPreferWrap={variant === 'backend' && !leafLabelEditable}
              textSizeClass={rowTextClass}
              hoverHighlight={Boolean(node.entry && !isGroupOnly)}
            />
            </div>
            {collapsedParamCountSuffix}
          </div>
        </div>

          <div
            ref={node.entry && !isGroupOnly ? valueAnchorRef : undefined}
            className={`relative flex ${rowMinH} min-w-0 shrink-0 items-center gap-0 pl-0`}
          {...(variant === 'backend' && ephemeralNew ? ({ inert: true } as React.HTMLAttributes<HTMLDivElement>) : {})}
        >
          <MappingRowFields
            variant={variant}
            entry={node.entry}
            groupOnlyBackend={variant === 'backend' && isGroupOnly}
            groupOnlyInterface={variant === 'interface' && isGroupOnly}
            showApiFields={variant === 'backend' ? showApiFields : true}
            secondaryFieldsLocked={variant === 'backend' && ephemeralNew}
            suppressFieldTabFocus={Boolean(
              node.entry && (pendingLabelEditId === node.entry.id || (variant === 'backend' && ephemeralNew))
            )}
            datalistApiId={datalistApi}
            datalistVarId={datalistVar}
            onPatch={patchEntry}
            backendColumn={backendColumn}
            variableOptions={variableOptions}
            onCreateOutputVariable={onCreateOutputVariable}
            onOutputVariableCreated={onOutputVariableCreated}
            backendKnownVariableIds={backendKnownVariableIds}
            backendSendParamKindByWireKey={backendSendParamKindByWireKey}
            backendSendParamEnumByWireKey={backendSendParamEnumByWireKey}
          />
        </div>
        {node.entry && !isGroupOnly ? (
          <MappingParameterToolbarPortal
            anchorRef={valueAnchorRef}
            visible={paramHovered}
            onPointerHoverChange={setParamHovered}
          >
            {variant === 'backend' ? (
              <MappingParameterToolbarActions
                onEditName={() => labelEditRef.current?.startEditing()}
                onRemove={handleRemove}
                rowExtra={rowExtra}
                onToggleNotes={() => setRowExtra((x) => (x === 'notes' ? 'none' : 'notes'))}
                onToggleValues={() => setRowExtra((x) => (x === 'values' ? 'none' : 'values'))}
                showConstraint={backendColumn === 'send'}
                onToggleConstraint={() => setRowExtra((x) => (x === 'config' ? 'none' : 'config'))}
              />
            ) : (
              <MappingParameterInterfaceRemoveAction onRemove={handleRemove} />
            )}
          </MappingParameterToolbarPortal>
        ) : null}
        </div>

        {showAdvancementUi && backendSendAdvancement!.isEnabled(advancementWireKey) ? (
          <div className="flex min-w-0 shrink-0 items-center">{backendSendAdvancement.renderEditor(advancementWireKey)}</div>
        ) : null}

        {variant === 'interface' && !useUnifiedNodeRow ? (
          <span className="min-w-2 shrink flex-1" aria-hidden />
        ) : null}
        </div>
        )}

        {variant === 'backend' && node.entry && rowExtra === 'notes' && (
          <div className="mt-1 w-full min-w-0 rounded-md border border-amber-600/35 bg-slate-950/50 px-2 py-1.5 pb-2">
            {node.entry.openapiDescriptionDrift && node.entry.openapiDescriptionHint ? (
              <div className="mb-2 rounded border border-amber-700/45 bg-amber-950/40 px-2 py-1.5 text-[10px] text-amber-100/95">
                <div className="font-semibold text-amber-200/95">Riferimento OpenAPI</div>
                <p className="mt-1 whitespace-pre-wrap text-amber-50/90">{node.entry.openapiDescriptionHint}</p>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-medium text-amber-200/90">Descrizione (locale)</span>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-amber-200"
                title="Chiudi"
                aria-label="Chiudi pannello descrizione"
                onClick={() => setRowExtra('none')}
              >
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>
            <label className="sr-only" htmlFor={`${listIdPrefix}-desc-${node.entry.id}`}>
              Descrizione parametro
            </label>
            <textarea
              id={`${listIdPrefix}-desc-${node.entry.id}`}
              className="w-full min-h-[4rem] rounded-md border border-amber-600/40 bg-slate-950/90 px-2 py-1.5 text-[11px] text-amber-50/95 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              placeholder="Descrizione del campo (appare come suggerimento sul nome)"
              value={node.entry.fieldDescription ?? ''}
              onChange={(e) => patchEntry({ fieldDescription: e.target.value })}
            />
          </div>
        )}

        {variant === 'backend' && node.entry && rowExtra === 'values' && (
          <BackendMappingDominioValoriPanel
            values={node.entry.sampleValues ?? []}
            onChange={(sampleValues) => patchEntry({ sampleValues })}
            entryId={node.entry.id}
            onClose={() => setRowExtra('none')}
            alignInsetPx={dominioValoriAlignPx}
          />
        )}

        {variant === 'backend' && backendColumn === 'send' && node.entry && rowExtra === 'config' && (
          <div className="mt-0.5 w-full min-w-0">
            <div
              className="max-w-md rounded-md border border-sky-500/45 bg-slate-900/85 shadow-md shadow-black/25 ring-1 ring-slate-700/30 backdrop-blur-[1px]"
              style={{
                marginLeft: dominioValoriAlignPx,
                width: `min(20rem, calc(100% - ${dominioValoriAlignPx}px))`,
              }}
              role="dialog"
              aria-labelledby={`${listIdPrefix}-param-constraint-${node.entry.id}-title`}
            >
              <div className="flex items-start justify-between gap-2 border-b border-sky-600/35 bg-sky-950/35 px-2 py-1.5">
                <h2
                  id={`${listIdPrefix}-param-constraint-${node.entry.id}-title`}
                  className="text-[11px] font-semibold leading-tight text-slate-100"
                >
                  Parameter constraint
                </h2>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
                  title="Close"
                  aria-label="Close parameter constraint"
                  onClick={() => setRowExtra('none')}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </button>
              </div>
              <div className="flex flex-col gap-0.5 px-2 py-1.5">
                {(
                  [
                    {
                      id: 'design',
                      label: 'Mandatory (design-time)',
                      desc: 'Parameter must be provided before deployment',
                      tooltip:
                        'Parameter must be bound to a variable or constant before deployment',
                      active:
                        !node.entry.sendBindingOptional &&
                        node.entry.sendBindingBindingPhase !== 'runtime',
                      patch: {
                        sendBindingOptional: false,
                        sendBindingBindingPhase: 'design' as const,
                        sendBindingDesignTimeRequired: true,
                      },
                    },
                    {
                      id: 'runtime',
                      label: 'Mandatory (runtime)',
                      desc: 'Parameter injected by system at runtime',
                      tooltip:
                        'Parameter is injected by the system at runtime (e.g., conversationId)',
                      active:
                        !node.entry.sendBindingOptional &&
                        node.entry.sendBindingBindingPhase === 'runtime',
                      patch: {
                        sendBindingOptional: false,
                        sendBindingBindingPhase: 'runtime' as const,
                        sendBindingDesignTimeRequired: false,
                      },
                    },
                    {
                      id: 'optional',
                      label: 'Optional',
                      desc: 'Parameter can be omitted',
                      tooltip:
                        'Parameter can be omitted — the call proceeds even if no value is provided',
                      active: Boolean(node.entry.sendBindingOptional),
                      patch: {
                        sendBindingOptional: true,
                        sendBindingBindingPhase: 'design' as const,
                        sendBindingDesignTimeRequired: false,
                      },
                    },
                  ] as const
                ).map(({ id, label, desc, tooltip, active, patch }) => (
                  <button
                    key={id}
                    type="button"
                    title={tooltip}
                    onClick={() => patchEntry(patch)}
                    className={`flex w-full items-start gap-2 rounded-sm py-1.5 pl-1 pr-1.5 text-left transition-colors ${
                      active
                        ? 'border-l-2 border-sky-400 bg-sky-950/15'
                        : 'border-l-2 border-transparent hover:bg-slate-800/35'
                    }`}
                  >
                    <span
                      className={`mt-0.5 h-3 w-3 shrink-0 rounded-full border-2 ${
                        active ? 'border-sky-400 bg-sky-500' : 'border-slate-500 bg-transparent'
                      }`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[10px] leading-snug ${
                          active
                            ? 'font-semibold text-sky-50 underline decoration-sky-400/90 underline-offset-2'
                            : 'font-medium text-slate-300'
                        }`}
                      >
                        {label}
                      </span>
                      <span className="mt-0.5 block text-[9px] leading-snug text-slate-500">{desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className={backendDense ? 'flex flex-col gap-0' : 'flex flex-col gap-px'}>
          {showChildLine && <DropPreviewLine indentPx={dropLineIndentChild(depth)} />}
          {node.children.map((ch) => (
            <MappingTreeRow
              key={ch.pathKey}
              node={ch}
              depth={depth + 1}
              variant={variant}
              collapsed={collapsed}
              toggleCollapsed={toggleCollapsed}
              listIdPrefix={listIdPrefix}
              entries={entries}
              onEntriesChange={onEntriesChange}
              enableBackendParamDrop={enableBackendParamDrop}
              showApiFields={showApiFields}
              dropIndicator={dropIndicator}
              onBackendParamDragOver={onBackendParamDragOver}
              pendingLabelEditId={pendingLabelEditId}
              onConsumeLabelEditIntent={onConsumeLabelEditIntent}
              onInsertBackendParam={onInsertBackendParam}
              onAbandonEphemeralEntry={onAbandonEphemeralEntry}
              onBackendFlowVariableDrop={onBackendFlowVariableDrop}
              projectId={projectId}
              flowCanvasId={flowCanvasId}
              workspaceFlows={workspaceFlows}
              ifacePointerPreview={ifacePointerPreview}
              enableRowReorder={enableRowReorder}
              ifaceReorderDrag={ifaceReorderDrag}
              reorderDragSourceIdRef={reorderDragSourceIdRef}
              onIfaceReorderHover={onIfaceReorderHover}
              onIfaceReorderCommit={onIfaceReorderCommit}
              backendColumn={backendColumn}
              variableOptions={variableOptions}
              onCreateOutputVariable={onCreateOutputVariable}
              onOutputVariableCreated={onOutputVariableCreated}
              backendKnownVariableIds={backendKnownVariableIds}
              backendSendParamKindByWireKey={backendSendParamKindByWireKey}
              backendSendParamEnumByWireKey={backendSendParamEnumByWireKey}
              backendSendAdvancement={backendSendAdvancement}
              flatTreeGrid={flatTreeGrid}
              treeRailWidthPx={treeRailWidthPx}
              backendCleanTree={backendCleanTreeProp}
              embeddedSignatureSubToolbarOpen={embeddedSignatureSubToolbarOpen}
              agentParamDragSource={agentParamDragSource}
              enableAgentBackendParamDrop={enableAgentBackendParamDrop}
              interfaceZone={interfaceZone}
              onAgentBackendParamDrop={onAgentBackendParamDrop}
            />
          ))}
        </div>
      )}

      {(showAfter || showIfaceAfter || showReorderAfter) && (
        <DropPreviewLine
          indentPx={dropLineIndentSibling(depth)}
          tone={showReorderAfter ? reorderLineTone : 'amber'}
        />
      )}
    </div>
  );
}

function BackendMappingTreeView({
  variant,
  entries,
  onEntriesChange,
  apiOptions,
  variableOptions,
  listIdPrefix,
  showDropZone,
  onDropVariable,
  enableBackendParamDrop = false,
  showApiFields = true,
  projectId,
  flowCanvasId,
  interfaceZone,
  siblingOrder = 'construction',
  backendColumn,
  onCreateOutputVariable,
  onOutputVariableCreated,
  backendKnownVariableIds,
  backendSendParamKindByWireKey,
  backendSendParamEnumByWireKey,
  backendSendAdvancement,
  embeddedSignatureSubToolbarOpen,
  agentParamDragSource,
  scrollMappingInParent = false,
}: FlowMappingTreeProps) {
  return (
    <div
      className={
        scrollMappingInParent
          ? 'flex min-w-0 flex-col'
          : 'flex h-full min-h-0 flex-1 flex-col overflow-hidden'
      }
    >
      <datalist id={`${listIdPrefix}-api`}>
        {apiOptions.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <datalist id={`${listIdPrefix}-var`}>
        {variableOptions.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <BackendMappingTree
        entries={entries}
        onEntriesChange={onEntriesChange}
        listIdPrefix={listIdPrefix}
        enableBackendParamDrop={enableBackendParamDrop}
        showApiFields={showApiFields}
        projectId={projectId}
        flowCanvasId={flowCanvasId}
        siblingOrder={siblingOrder}
        backendColumn={backendColumn}
        onCreateOutputVariable={onCreateOutputVariable}
        onOutputVariableCreated={onOutputVariableCreated}
        backendKnownVariableIds={backendKnownVariableIds}
        backendSendParamKindByWireKey={backendSendParamKindByWireKey}
        backendSendParamEnumByWireKey={backendSendParamEnumByWireKey}
        backendSendAdvancement={backendSendAdvancement}
        embeddedSignatureSubToolbarOpen={embeddedSignatureSubToolbarOpen}
        variableOptions={variableOptions}
        agentParamDragSource={agentParamDragSource}
        scrollMappingInParent={scrollMappingInParent}
      />
    </div>
  );
}

function InterfaceMappingTree({
  variant,
  entries,
  onEntriesChange,
  apiOptions,
  variableOptions,
  listIdPrefix,
  showDropZone,
  onDropVariable,
  enableBackendParamDrop = false,
  enableAgentBackendParamDrop = false,
  showApiFields = true,
  projectId,
  flowCanvasId,
  interfaceZone,
  siblingOrder = 'construction',
  backendColumn,
  onCreateOutputVariable,
  onOutputVariableCreated,
  backendKnownVariableIds,
  backendSendParamKindByWireKey,
  backendSendParamEnumByWireKey,
  backendSendAdvancement,
  embeddedSignatureSubToolbarOpen,
  agentParamDragSource,
}: FlowMappingTreeProps) {
  /** InterfaceMappingTree is mounted only for `variant === 'interface'`; backend accordion layout lives in BackendMappingTree. */
  const useBackendRootAccordion = false;
  const workspaceState = useFlowWorkspaceOptional();
  const workspaceFlows = workspaceState?.flows;

  const tree = useMemo(
    () => buildMappingTree(entries, { siblingOrder }),
    [entries, siblingOrder]
  );

  const backendTreeRailWidthPx = useMemo(() => {
    if (variant !== 'backend' || tree.length === 0) return undefined;
    return TREE_RAIL_CHEVRON_CELL_PX + 6;
  }, [tree, variant]);

  const flatTreeGrid = variant === 'backend';
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  /** Backend accordion: radici chiuse dall’utente (pathKey radice = primo segmento). */
  const [closedRootAccordions, setClosedRootAccordions] = useState<Set<string>>(() => new Set());
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState>(null);
  const [rootEdgeDrop, setRootEdgeDrop] = useState<'top' | 'bottom' | null>(null);
  const [pendingLabelEditId, setPendingLabelEditId] = useState<string | null>(null);
  const reorderDragSourceIdRef = useRef<string | null>(null);
  const [ifaceReorderDrag, setIfaceReorderDrag] = useState<{
    targetPathKey: string;
    placement: 'before' | 'after';
  } | null>(null);
  const [ifacePointerPreview, setIfacePointerPreview] = useState<FlowInterfacePointerPreviewDetail | null>(null);

  /** Drag reorder changes stored array order; only affects display when siblings use `construction` order. */
  const enableRowReorder =
    variant === 'interface' || (variant === 'backend' && siblingOrder === 'construction');

  useEffect(() => {
    if (!flowCanvasId || variant !== 'interface' || !interfaceZone) return;
    const h = (e: Event) => {
      const d = (e as CustomEvent<FlowInterfacePointerPreviewDetail | null>).detail;
      if (d === null) {
        setIfacePointerPreview(null);
        return;
      }
      if (d.flowId !== flowCanvasId || d.zone !== interfaceZone) {
        setIfacePointerPreview(null);
        return;
      }
      setIfacePointerPreview(d);
    };
    window.addEventListener(FLOW_INTERFACE_POINTER_PREVIEW, h);
    return () => window.removeEventListener(FLOW_INTERFACE_POINTER_PREVIEW, h);
  }, [flowCanvasId, variant, interfaceZone]);

  const onIfaceReorderHover = useCallback((pathKey: string, placement: 'before' | 'after') => {
    setIfaceReorderDrag({ targetPathKey: pathKey, placement });
  }, []);

  const onIfaceReorderCommit = useCallback(
    (fromId: string, targetId: string, placeAfter: boolean) => {
      reorderDragSourceIdRef.current = null;
      setIfaceReorderDrag(null);
      const next = reorderMappingEntries(entries, fromId, targetId, placeAfter);
      onEntriesChange(next);
    },
    [entries, onEntriesChange]
  );

  const toggleCollapsed = useCallback((pathKey: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) next.delete(pathKey);
      else next.add(pathKey);
      return next;
    });
  }, []);

  /** Apre l’accordion della radice interessata da un nuovo wireKey (primo segmento). */
  const openRootAccordionForWireKey = useCallback((wireKey: string) => {
    const parts = wireKey
      .split('.')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (parts.length === 0) return;
    const rootKey = parts[0]!;
    setClosedRootAccordions((prev) => {
      const next = new Set(prev);
      next.delete(rootKey);
      return next;
    });
  }, []);

  useEffect(() => {
    const clear = () => {
      setDropIndicator(null);
      setRootEdgeDrop(null);
      reorderDragSourceIdRef.current = null;
      setIfaceReorderDrag(null);
    };
    window.addEventListener('dragend', clear);
    return () => window.removeEventListener('dragend', clear);
  }, []);

  const onBackendParamDragOver = useCallback((pathKey: string, placement: ParamDropPlacement) => {
    setRootEdgeDrop(null);
    setDropIndicator({ targetPathKey: pathKey, placement });
  }, []);

  const onConsumeLabelEditIntent = useCallback(() => {
    setPendingLabelEditId(null);
  }, []);

  const onInsertBackendParam = useCallback(
    (pos: ParamDropPosition) => {
      const { next, newEntry } = insertNewBackendParameter(entries, pos, { siblingOrder });
      setCollapsed((prev) => expandAncestorsOfPath(prev, newEntry.wireKey));
      openRootAccordionForWireKey(newEntry.wireKey);
      setPendingLabelEditId(newEntry.id);
      setDropIndicator(null);
      setRootEdgeDrop(null);
      onEntriesChange(next);
    },
    [entries, onEntriesChange, openRootAccordionForWireKey, siblingOrder]
  );

  /** Backend: variabile da riga flow / menù subflow (DND_FLOWROW_VAR). */
  const commitBackendFlowVariableDrop = useCallback(
    (e: React.DragEvent, pos: ParamDropPosition) => {
      const payload = parseFlowInterfaceDropFromDataTransfer(e.dataTransfer);
      const vid = payload?.variableRefId?.trim();
      if (!vid) return;
      e.preventDefault();
      e.stopPropagation();
      const rowText = (payload.rowLabel ?? '').trim();
      const result = mergeBackendMappingVariableDrop(
        entries,
        { variableRefId: vid, rowLabel: rowText },
        projectId,
        flowCanvasId,
        siblingOrder,
        pos
      );
      if (!result) return;
      onEntriesChange(result.merged);
      setCollapsed((prev) => expandAncestorsOfPath(prev, result.newEntry.wireKey));
      openRootAccordionForWireKey(result.newEntry.wireKey);
      setDropIndicator(null);
      setRootEdgeDrop(null);
      setPendingLabelEditId(result.newEntry.id);
    },
    [entries, onEntriesChange, openRootAccordionForWireKey, projectId, flowCanvasId, siblingOrder]
  );

  const onAbandonEphemeralEntry = useCallback(
    (entryId: string) => {
      setPendingLabelEditId((p) => (p === entryId ? null : p));
      onEntriesChange(removeEntry(entries, entryId));
    },
    [entries, onEntriesChange]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (enableAgentBackendParamDrop && handleAgentBackendParamDragOver(e, interfaceZone)) {
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    [enableAgentBackendParamDrop, interfaceZone]
  );

  const onDragOverCapture = useCallback(
    (e: React.DragEvent) => {
      if (enableAgentBackendParamDrop) {
        handleAgentBackendParamDragOver(e, interfaceZone);
      }
    },
    [enableAgentBackendParamDrop, interfaceZone]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (onDropVariable && enableAgentBackendParamDrop) {
        const agent = parseAgentBackendParamDropFromDataTransfer(e.dataTransfer);
        if (agent) {
          if (interfaceZone === 'input' && agent.side !== 'send') return;
          if (interfaceZone === 'output' && agent.side !== 'receive') return;
          onDropVariable({ wireKey: agent.wireKey, agentBackendParam: agent });
          return;
        }
      }
      if (onDropVariable) {
        const fromRow = parseFlowInterfaceDropFromDataTransfer(e.dataTransfer);
        if (fromRow) {
          onDropVariable(fromRow);
          return;
        }
      }
      const label =
        e.dataTransfer.getData(DND_TYPE) || e.dataTransfer.getData('text/plain');
      if (label?.trim() && onDropVariable) {
        onDropVariable({ wireKey: label.trim() });
      }
    },
    [onDropVariable, enableAgentBackendParamDrop, interfaceZone]
  );

  const onEmptyBackendDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!enableBackendParamDrop || variant !== 'backend' || tree.length > 0) return;
      if (hasFlowRowVarDrag(e)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDropIndicator({ targetPathKey: '', placement: 'after' });
        return;
      }
      if (!hasNewParamDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDropIndicator({ targetPathKey: '', placement: 'after' });
    },
    [enableBackendParamDrop, variant, tree.length]
  );

  const onEmptyBackendDrop = useCallback(
    (e: React.DragEvent) => {
      if (!enableBackendParamDrop || variant !== 'backend' || tree.length > 0) return;
      if (hasFlowRowVarDrag(e)) {
        commitBackendFlowVariableDrop(e, { targetPathKey: '', placement: 'after' });
        return;
      }
      if (!hasNewParamDrag(e)) return;
      e.preventDefault();
      onInsertBackendParam({ targetPathKey: '', placement: 'after' });
    },
    [enableBackendParamDrop, variant, tree.length, onInsertBackendParam, commitBackendFlowVariableDrop]
  );

  const rootDragOver = useCallback(
    (e: React.DragEvent) => {
      if (showDropZone) onDragOver(e);
      if (enableBackendParamDrop && variant === 'backend' && tree.length > 0 && hasFlowRowVarDrag(e)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        const rowEl = findBackendMapRowElementFromPoint(e.clientX, e.clientY);
        if (rowEl) {
          const pathKey = rowEl.getAttribute('data-backend-map-row') || '';
          const hasCh = rowEl.getAttribute('data-backend-map-has-children') === '1';
          const rect = rowEl.getBoundingClientRect();
          const p = placementFromY(e.clientY, rect, hasCh);
          setDropIndicator({ targetPathKey: pathKey, placement: p });
          setRootEdgeDrop(null);
        } else {
          setDropIndicator(null);
        }
        return;
      }
      if (enableBackendParamDrop && variant === 'backend' && tree.length > 0 && hasNewParamDrag(e)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        const rowEl = findBackendMapRowElementFromPoint(e.clientX, e.clientY);
        if (rowEl) {
          const pathKey = rowEl.getAttribute('data-backend-map-row') || '';
          const hasCh = rowEl.getAttribute('data-backend-map-has-children') === '1';
          const rect = rowEl.getBoundingClientRect();
          const p = placementFromY(e.clientY, rect, hasCh);
          setDropIndicator({ targetPathKey: pathKey, placement: p });
          setRootEdgeDrop(null);
        } else {
          setDropIndicator(null);
        }
      }
    },
    [showDropZone, onDragOver, enableBackendParamDrop, variant, tree.length]
  );

  const ifaceTreeRootProps =
    variant === 'interface' && flowCanvasId
      ? ({ 'data-flow-iface-tree-root': '', 'data-flow-canvas-id': flowCanvasId } as const)
      : {};

  /** Righe backend SEND/RECEIVE (accordion o legacy): evita duplicare la lunga lista di props. */
  function renderBackendMappingRow(node: MappingTreeNode, depth: number, treeRailPx: number | undefined) {
    return (
      <MappingTreeRow
        key={node.pathKey}
        node={node}
        depth={depth}
        variant="backend"
        collapsed={collapsed}
        toggleCollapsed={toggleCollapsed}
        listIdPrefix={listIdPrefix}
        entries={entries}
        onEntriesChange={onEntriesChange}
        enableBackendParamDrop={Boolean(enableBackendParamDrop)}
        showApiFields={showApiFields}
        dropIndicator={dropIndicator}
        onBackendParamDragOver={onBackendParamDragOver}
        pendingLabelEditId={pendingLabelEditId}
        onConsumeLabelEditIntent={onConsumeLabelEditIntent}
        onInsertBackendParam={onInsertBackendParam}
        onAbandonEphemeralEntry={onAbandonEphemeralEntry}
        onBackendFlowVariableDrop={enableBackendParamDrop ? commitBackendFlowVariableDrop : undefined}
        projectId={projectId}
        flowCanvasId={flowCanvasId}
        workspaceFlows={workspaceFlows}
        ifacePointerPreview={ifacePointerPreview}
        enableRowReorder={enableRowReorder}
        ifaceReorderDrag={ifaceReorderDrag}
        reorderDragSourceIdRef={reorderDragSourceIdRef}
        onIfaceReorderHover={onIfaceReorderHover}
        onIfaceReorderCommit={onIfaceReorderCommit}
        backendColumn={backendColumn}
        variableOptions={variableOptions}
        onCreateOutputVariable={onCreateOutputVariable}
        onOutputVariableCreated={onOutputVariableCreated}
        backendKnownVariableIds={backendKnownVariableIds}
        backendSendParamKindByWireKey={backendSendParamKindByWireKey}
        backendSendParamEnumByWireKey={backendSendParamEnumByWireKey}
        backendSendAdvancement={backendSendAdvancement}
        flatTreeGrid={flatTreeGrid && !useBackendRootAccordion}
        treeRailWidthPx={useBackendRootAccordion ? undefined : treeRailPx}
        backendCleanTree={useBackendRootAccordion}
        embeddedSignatureSubToolbarOpen={embeddedSignatureSubToolbarOpen}
        agentParamDragSource={agentParamDragSource}
        scrollMappingInParent={scrollMappingInParent}
      />
    );
  }

  return (
    <div
      {...ifaceTreeRootProps}
      className={
        showDropZone
          ? `min-h-[88px] rounded-lg p-1 transition-colors ${entries.length === 0 ? 'border-2 border-dashed border-violet-600/45 bg-violet-950/20' : 'border border-dashed border-violet-700/25 bg-slate-950/15'}`
          : enableBackendParamDrop && variant === 'backend' && tree.length === 0
            ? 'min-h-[52px] rounded-md border border-dashed border-teal-600/35 bg-slate-950/20 p-1'
            : tree.length > 0
              ? useBackendRootAccordion
                ? 'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:auto]'
                : 'min-h-full'
              : ''
      }
      onDragOver={showDropZone ? onDragOver : rootDragOver}
      onDragOverCapture={showDropZone ? onDragOverCapture : undefined}
      onDrop={showDropZone ? onDrop : undefined}
    >
      <datalist id={`${listIdPrefix}-api`}>
        {apiOptions.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <datalist id={`${listIdPrefix}-var`}>
        {variableOptions.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>

      {showDropZone && entries.length === 0 && (
        <p className="text-[10px] text-violet-300/80 text-center py-6 px-2">
          Con questo pannello aperto: puoi rilasciare una <span className="font-semibold">riga del nodo</span> qui (la riga resta sul nodo). Oppure chip demo / Variabili. Il legame usa{' '}
          <span className="font-semibold">variableRefId</span> quando disponibile.
        </p>
      )}

      {enableBackendParamDrop && variant === 'backend' && tree.length === 0 && (
        <div
          className="py-3 px-2 text-center"
          onDragOver={onEmptyBackendDragOver}
          onDrop={onEmptyBackendDrop}
        >
          {dropIndicator?.targetPathKey === '' && <DropPreviewLine indentPx={siblingDropLineIndentPx(0)} />}
          <p className="text-[10px] text-teal-300/75">
            Trascina <span className="font-semibold text-teal-200/90">Parameter</span> dall&apos;header, oppure una{' '}
            <span className="font-semibold text-teal-200/90">variabile</span> dal menù subflow (icona Interface sulla riga).
          </p>
        </div>
      )}

      {enableBackendParamDrop && variant === 'backend' && tree.length > 0 && (
        <div
          className="h-2.5 -mx-0.5 rounded-sm shrink-0"
          onDragOver={(e) => {
            if (!hasNewParamDrag(e) && !hasFlowRowVarDrag(e)) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            setRootEdgeDrop('top');
            setDropIndicator(null);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setRootEdgeDrop(null);
          }}
          onDrop={(e) => {
            if (hasFlowRowVarDrag(e)) {
              commitBackendFlowVariableDrop(e, { targetPathKey: tree[0].pathKey, placement: 'before' });
              return;
            }
            if (!hasNewParamDrag(e)) return;
            e.preventDefault();
            e.stopPropagation();
            onInsertBackendParam({ targetPathKey: tree[0].pathKey, placement: 'before' });
          }}
        >
          {rootEdgeDrop === 'top' && <DropPreviewLine indentPx={siblingDropLineIndentPx(0)} />}
        </div>
      )}

      {variant === 'interface' &&
        ifacePointerPreview?.placement === 'append' &&
        ifacePointerPreview.targetPathKey === null &&
        tree.length === 0 && <DropPreviewLine indentPx={siblingDropLineIndentPx(0)} />}

      {variant === 'interface' || !useBackendRootAccordion
        ? tree.map((n) => (
            <MappingTreeRow
              key={n.pathKey}
              node={n}
              depth={0}
              variant={variant}
              collapsed={collapsed}
              toggleCollapsed={toggleCollapsed}
              listIdPrefix={listIdPrefix}
              entries={entries}
              onEntriesChange={onEntriesChange}
              enableBackendParamDrop={Boolean(enableBackendParamDrop && variant === 'backend')}
              showApiFields={variant === 'backend' ? showApiFields : true}
              dropIndicator={dropIndicator}
              onBackendParamDragOver={onBackendParamDragOver}
              pendingLabelEditId={pendingLabelEditId}
              onConsumeLabelEditIntent={onConsumeLabelEditIntent}
              onInsertBackendParam={onInsertBackendParam}
              onAbandonEphemeralEntry={onAbandonEphemeralEntry}
              onBackendFlowVariableDrop={
                enableBackendParamDrop && variant === 'backend' ? commitBackendFlowVariableDrop : undefined
              }
              projectId={projectId}
              flowCanvasId={flowCanvasId}
              workspaceFlows={workspaceFlows}
              ifacePointerPreview={ifacePointerPreview}
              enableRowReorder={enableRowReorder}
              ifaceReorderDrag={ifaceReorderDrag}
              reorderDragSourceIdRef={reorderDragSourceIdRef}
              onIfaceReorderHover={onIfaceReorderHover}
              onIfaceReorderCommit={onIfaceReorderCommit}
              backendColumn={backendColumn}
              variableOptions={variableOptions}
              onCreateOutputVariable={onCreateOutputVariable}
              onOutputVariableCreated={onOutputVariableCreated}
              backendKnownVariableIds={backendKnownVariableIds}
              backendSendParamKindByWireKey={backendSendParamKindByWireKey}
              backendSendParamEnumByWireKey={backendSendParamEnumByWireKey}
              backendSendAdvancement={backendSendAdvancement}
              flatTreeGrid={flatTreeGrid}
              treeRailWidthPx={backendTreeRailWidthPx}
              embeddedSignatureSubToolbarOpen={embeddedSignatureSubToolbarOpen}
              agentParamDragSource={agentParamDragSource}
              enableAgentBackendParamDrop={variant === 'interface' && enableAgentBackendParamDrop}
              interfaceZone={interfaceZone}
              onAgentBackendParamDrop={variant === 'interface' ? onDropVariable : undefined}
            />
          ))
        : tree.map((root) => {
            const isLeafRoot = Boolean(root.entry && root.children.length === 0);
            const isGroupRoot = root.children.length > 0 && !root.entry;
            const isHybridRoot = Boolean(root.entry && root.children.length > 0);
            if (isHybridRoot) {
              return (
                <CollapsiblePanelSection
                  key={root.pathKey}
                  compact
                  title={root.segment}
                  headerTone="slate"
                  defaultOpen
                  open={!closedRootAccordions.has(root.pathKey)}
                  onOpenChange={(next) => {
                    setClosedRootAccordions((prev) => {
                      const nextSet = new Set(prev);
                      if (next) nextSet.delete(root.pathKey);
                      else nextSet.add(root.pathKey);
                      return nextSet;
                    });
                  }}
                  headerTitleClassName="text-left text-[11px] font-semibold text-amber-100/95 normal-case tracking-normal leading-tight"
                  contentClassName="min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain max-h-[min(50vh,420px)] px-0 py-px"
                  className="min-w-0 shrink-0 rounded-md"
                >
                  <div className="flex flex-col gap-0">
                    {renderBackendMappingRow(root, 1, undefined)}
                    {root.children.map((ch) => renderBackendMappingRow(ch, 2, undefined))}
                  </div>
                </CollapsiblePanelSection>
              );
            }
            if (isLeafRoot) {
              return (
                <div
                  key={root.pathKey}
                  className="rounded border border-slate-700/45 bg-slate-950/20 px-0 py-0"
                >
                  {renderBackendMappingRow(root, 0, undefined)}
                </div>
              );
            }
            if (isGroupRoot) {
              return (
                <CollapsiblePanelSection
                  key={root.pathKey}
                  compact
                  title={root.segment}
                  headerTone="slate"
                  defaultOpen
                  open={!closedRootAccordions.has(root.pathKey)}
                  onOpenChange={(next) => {
                    setClosedRootAccordions((prev) => {
                      const nextSet = new Set(prev);
                      if (next) nextSet.delete(root.pathKey);
                      else nextSet.add(root.pathKey);
                      return nextSet;
                    });
                  }}
                  headerTitleClassName="text-left text-[11px] font-semibold text-amber-100/95 normal-case tracking-normal leading-tight"
                  contentClassName="min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain max-h-[min(50vh,420px)] px-0 py-px"
                  className="min-w-0 shrink-0 rounded-md"
                >
                  <div className="flex flex-col gap-0">
                    {root.children.map((ch) => renderBackendMappingRow(ch, 1, undefined))}
                  </div>
                </CollapsiblePanelSection>
              );
            }
            return null;
          })}

      {variant === 'interface' &&
        ifacePointerPreview?.placement === 'append' &&
        ifacePointerPreview.targetPathKey === null &&
        tree.length > 0 && <DropPreviewLine indentPx={siblingDropLineIndentPx(0)} />}

      {enableBackendParamDrop && variant === 'backend' && tree.length > 0 && (
        <div
          className="h-2.5 -mx-0.5 rounded-sm shrink-0 mt-0.5"
          onDragOver={(e) => {
            if (!hasNewParamDrag(e) && !hasFlowRowVarDrag(e)) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            setRootEdgeDrop('bottom');
            setDropIndicator(null);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setRootEdgeDrop(null);
          }}
          onDrop={(e) => {
            if (hasFlowRowVarDrag(e)) {
              const last = tree[tree.length - 1];
              commitBackendFlowVariableDrop(e, { targetPathKey: last.pathKey, placement: 'after' });
              return;
            }
            if (!hasNewParamDrag(e)) return;
            e.preventDefault();
            e.stopPropagation();
            const last = tree[tree.length - 1];
            onInsertBackendParam({ targetPathKey: last.pathKey, placement: 'after' });
          }}
        >
          {rootEdgeDrop === 'bottom' && <DropPreviewLine indentPx={siblingDropLineIndentPx(0)} />}
        </div>
      )}
    </div>
  );
}

export function FlowMappingTree(props: FlowMappingTreeProps) {
  if (props.variant === 'backend') {
    return <BackendMappingTreeView {...props} />;
  }
  return <InterfaceMappingTree {...props} />;
}

/* eslint-disable react-refresh/only-export-components -- costanti DND esposte per consumer legacy */
export { DND_TYPE, DND_NEW_BACKEND_PARAM, DND_FLOWROW_VAR };
export type { FlowInterfaceDropPayload } from './flowInterfaceDragTypes';
