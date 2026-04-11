/**
 * Mapping tree: dot paths, folder vs variable icon, SEND/RECEIVE style columns.
 * Backend: toolbar sopra il nome interno in hover sulla colonna label (overlap, senza pt extra).
 * Backend: drag “Parameter” from block header, drop on rows with insertion preview line.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Circle,
  Brackets,
  ArrowRight,
  ArrowLeft,
  Pencil,
  StickyNote,
  Table2,
  X,
} from 'lucide-react';
import type { MappingEntry } from './mappingTypes';
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
import { mergeBackendMappingVariableDrop } from './backendMappingVariableDrop';
import { getInterfaceLeafDisplayName } from './interfaceMappingLabels';

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
/**
 * Offset from row left edge toward the row icon: `px-1` + chevron `w-5` + `gap-1` ≈ 28px; a few px less
 * so the line sits slightly left of the icon (Brackets/Circle).
 */
const ROW_ICON_LINE_OFFSET_PX = 24;

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

/** Inline grid sotto la riga backend per valori di esempio (hint / tooltip). */
function BackendMappingSampleValuesBlock({
  values,
  onChange,
  entryId,
  onClose,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  entryId: string;
  onClose?: () => void;
}) {
  const rows = values.length > 0 ? values : [''];
  return (
    <div className="mt-1 w-full min-w-0 space-y-1 rounded-md border border-sky-600/35 bg-slate-950/80 px-2 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium text-sky-200/80">Valori (esempio)</p>
        {onClose ? (
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-sky-200"
            title="Chiudi"
            aria-label="Chiudi pannello valori"
            onClick={onClose}
          >
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        ) : null}
      </div>
      {rows.map((val, i) => (
        <div key={`${entryId}-sv-${i}`} className="flex gap-1">
          <input
            className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[10px] text-amber-100 placeholder:text-slate-600"
            value={val}
            title={val.trim() || undefined}
            placeholder="Valore"
            onChange={(e) => {
              const next = [...rows];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            className="shrink-0 rounded px-1 text-[10px] text-slate-500 hover:text-red-400"
            aria-label="Rimuovi valore"
            onClick={() => {
              const next = rows.filter((_, j) => j !== i);
              onChange(next.length > 0 ? next : []);
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-[10px] text-sky-400 hover:underline"
        onClick={() => onChange([...rows, ''])}
      >
        + Aggiungi valore
      </button>
    </div>
  );
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
}

function updateEntry(entries: MappingEntry[], id: string, patch: Partial<MappingEntry>): MappingEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
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
}: RowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const labelEditRef = useRef<LabelWithPencilEditHandle>(null);
  const [rowExtra, setRowExtra] = useState<'none' | 'notes' | 'values'>('none');
  const hasChildren = node.children.length > 0;
  const isExpanded = !collapsed.has(node.pathKey);
  const hasEntry = Boolean(node.entry);
  const isGroupOnly = hasChildren && !hasEntry;
  const canRenameLabel = Boolean(node.entry && !hasChildren);
  /** Interface: single variable name in tree; no separate alias column. */
  const leafLabelEditable = canRenameLabel && variant !== 'interface';

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
    [enableBackendParamDrop, variant, hasChildren, node.pathKey, onBackendParamDragOver]
  );

  const onRowDrop = useCallback(
    (e: React.DragEvent) => {
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
    [enableBackendParamDrop, variant, hasChildren, node.pathKey, onInsertBackendParam, onBackendFlowVariableDrop]
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

  return (
    <div className="select-none" {...ifaceRowAttrs}>
      {(showBefore || showIfaceBefore || showReorderBefore) && (
        <DropPreviewLine
          indentPx={siblingDropLineIndentPx(depth)}
          tone={showReorderBefore ? reorderLineTone : 'amber'}
        />
      )}
      <div className={`relative ${depth > 0 ? 'ml-2 border-l border-slate-700/40 pl-2' : ''}`}>
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
          className={`group/row flex items-center gap-0.5 min-h-[32px] rounded-md px-0.5 py-0.5 -mx-0.5 hover:bg-slate-800/50 ${
            enableRowReorder && node.entry ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
          onDragOver={combinedRowDragOver}
          onDragOverCapture={combinedRowDragOver}
          onDrop={combinedRowDrop}
        >
        <div className="flex items-center gap-0.5 shrink-0 w-4 justify-start min-w-[1rem]">
          {hasChildren ? (
            <button
              type="button"
              className="p-0.5 rounded text-slate-400 hover:text-slate-200"
              aria-expanded={isExpanded}
              onClick={() => toggleCollapsed(node.pathKey)}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-4 inline-block" />
          )}
        </div>

        <div
          className="shrink-0 -mr-0.5 flex items-center justify-center"
          title={
            isGroupOnly
              ? 'Gruppo'
              : variant === 'backend' && backendColumn === 'send'
                ? 'Parametro in uscita (verso API)'
                : variant === 'backend' && backendColumn === 'receive'
                  ? 'Parametro in ingresso (da API)'
                  : 'Parametro'
          }
        >
          {isGroupOnly ? (
            <Circle className="w-3.5 h-3.5" strokeWidth={2} />
          ) : variant === 'interface' ? (
            <span className="w-3.5 h-3.5 inline-block" aria-hidden />
          ) : variant === 'backend' && backendColumn === 'send' ? (
            <ArrowRight
              className="w-[1.125rem] h-[1.125rem] text-teal-400 drop-shadow-[0_0_6px_rgba(45,212,191,0.45)]"
              strokeWidth={3.1}
              aria-hidden
            />
          ) : variant === 'backend' && backendColumn === 'receive' ? (
            <ArrowLeft
              className="w-[1.125rem] h-[1.125rem] text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.45)]"
              strokeWidth={3.1}
              aria-hidden
            />
          ) : (
            <Brackets className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
          )}
        </div>

        <div className="relative shrink-0 min-w-0 max-w-[min(18rem,55vw)] pl-0.5 group/label-slot">
          {variant === 'backend' && node.entry && !isGroupOnly && (
            <div className="absolute bottom-full left-0 z-30 mb-0.5 flex items-center gap-0.5 rounded-md bg-slate-900/95 px-0.5 py-0.5 opacity-0 shadow-md ring-1 ring-slate-600/50 transition-opacity pointer-events-none group-hover/label-slot:opacity-100 group-hover/label-slot:pointer-events-auto">
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-amber-200"
                title="Modifica nome interno"
                aria-label="Modifica nome interno"
                onClick={() => labelEditRef.current?.startEditing()}
              >
                <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                title="Rimuovi parametro"
                aria-label="Rimuovi parametro"
                onClick={handleRemove}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className={`rounded p-1 hover:bg-slate-800 ${rowExtra === 'notes' ? 'text-amber-300' : 'text-slate-400 hover:text-amber-200'}`}
                title="Descrizione (tooltip)"
                aria-label="Descrizione campo"
                onClick={() => setRowExtra((x) => (x === 'notes' ? 'none' : 'notes'))}
              >
                <StickyNote className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                className={`rounded p-1 hover:bg-slate-800 ${rowExtra === 'values' ? 'text-sky-300' : 'text-slate-400 hover:text-sky-200'}`}
                title="Valori di esempio"
                aria-label="Valori di esempio"
                onClick={() => setRowExtra((x) => (x === 'values' ? 'none' : 'values'))}
              >
                <Table2 className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>
          )}
          <LabelWithPencilEdit
            ref={labelEditRef}
            segment={node.segment}
            displayLabel={
              variant === 'interface' && node.entry
                ? getInterfaceLeafDisplayName(node.entry, projectId)
                : undefined
            }
            editable={leafLabelEditable}
            onCommit={handleRenameSegment}
            editIntent={Boolean(node.entry && pendingLabelEditId === node.entry.id)}
            onConsumeEditIntent={onConsumeLabelEditIntent}
            ephemeralNew={ephemeralNew}
            onAbandonEphemeral={ephemeralNew ? handleAbandonEphemeral : undefined}
            inlinePencil={variant !== 'backend'}
            viewTitle={variant === 'backend' ? descTitle : undefined}
          />
        </div>

        <div
          className="shrink-0 flex items-center min-w-0"
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
          />
        </div>

        <span className="flex-1 min-w-2 shrink" aria-hidden />

        {node.entry && variant === 'interface' && (
          <button
            type="button"
            className="shrink-0 p-1 rounded text-slate-600 opacity-0 group-hover/row:opacity-100 hover:text-red-400 focus:opacity-100 focus:outline-none"
            aria-label="Rimuovi mapping"
            onClick={handleRemove}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        </div>

        {variant === 'backend' && node.entry && rowExtra === 'notes' && (
          <div className="mt-1 w-full min-w-0 rounded-md border border-amber-600/35 bg-slate-950/50 px-2 py-1.5 pb-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-medium text-amber-200/90">Descrizione</span>
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
          <BackendMappingSampleValuesBlock
            values={node.entry.sampleValues ?? []}
            onChange={(sampleValues) => patchEntry({ sampleValues })}
            entryId={node.entry.id}
            onClose={() => setRowExtra('none')}
          />
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {showChildLine && <DropPreviewLine indentPx={childDropLineIndentPx(depth)} />}
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
            />
          ))}
        </div>
      )}

      {(showAfter || showIfaceAfter || showReorderAfter) && (
        <DropPreviewLine
          indentPx={siblingDropLineIndentPx(depth)}
          tone={showReorderAfter ? reorderLineTone : 'amber'}
        />
      )}
    </div>
  );
}

export function FlowMappingTree({
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
}: FlowMappingTreeProps) {
  const tree = useMemo(
    () => buildMappingTree(entries, { siblingOrder }),
    [entries, siblingOrder]
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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
      setPendingLabelEditId(newEntry.id);
      setDropIndicator(null);
      setRootEdgeDrop(null);
      onEntriesChange(next);
    },
    [entries, onEntriesChange, siblingOrder]
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
      setDropIndicator(null);
      setRootEdgeDrop(null);
      setPendingLabelEditId(result.newEntry.id);
    },
    [entries, onEntriesChange, projectId, flowCanvasId, siblingOrder]
  );

  const onAbandonEphemeralEntry = useCallback(
    (entryId: string) => {
      setPendingLabelEditId((p) => (p === entryId ? null : p));
      onEntriesChange(removeEntry(entries, entryId));
    },
    [entries, onEntriesChange]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
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
    [onDropVariable]
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

  return (
    <div
      {...ifaceTreeRootProps}
      className={
        showDropZone
          ? `min-h-[88px] rounded-lg p-1 transition-colors ${entries.length === 0 ? 'border-2 border-dashed border-violet-600/45 bg-violet-950/20' : 'border border-dashed border-violet-700/25 bg-slate-950/15'}`
          : enableBackendParamDrop && variant === 'backend' && tree.length === 0
            ? 'min-h-[52px] rounded-md border border-dashed border-teal-600/35 bg-slate-950/20 p-1'
            : ''
      }
      onDragOver={showDropZone ? onDragOver : rootDragOver}
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

      {tree.map((n) => (
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
        />
      ))}

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

export { DND_TYPE, DND_NEW_BACKEND_PARAM, DND_FLOWROW_VAR };
export type { FlowInterfaceDropPayload } from './flowInterfaceDragTypes';
