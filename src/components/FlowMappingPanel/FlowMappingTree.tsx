/**
 * Mapping tree: dot paths, folder vs variable icon, SEND/RECEIVE style columns.
 * Pencil on label hover only for leaf rows with an entry.
 * Backend: drag “Parameter” from block header, drop on rows with insertion preview line.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, Circle, Brackets } from 'lucide-react';
import type { MappingEntry } from './mappingTypes';
import { buildMappingTree, renameLeafSegment, type MappingTreeNode } from './mappingTreeUtils';
import { LabelWithPencilEdit } from './LabelWithPencilEdit';
import { MappingRowFields } from './MappingRowFields';
import {
  DND_NEW_BACKEND_PARAM,
  expandAncestorsOfPath,
  insertNewBackendParameter,
  isEphemeralNewSegment,
  type ParamDropPlacement,
  type ParamDropPosition,
} from './backendParamInsert';

const DND_TYPE = 'application/x-omnia-varlabel';

function hasNewParamDrag(e: React.DragEvent): boolean {
  return [...e.dataTransfer.types].includes(DND_NEW_BACKEND_PARAM);
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

function DropPreviewLine({ indentPx = 0 }: { indentPx?: number }) {
  return (
    <div
      className="h-0.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.55)] pointer-events-none"
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

export interface FlowMappingTreeProps {
  variant: 'backend' | 'interface';
  entries: MappingEntry[];
  onEntriesChange: (next: MappingEntry[]) => void;
  apiOptions: string[];
  variableOptions: string[];
  listIdPrefix: string;
  showDropZone?: boolean;
  onDropVariable?: (internalPath: string) => void;
  /** Backend: enable drag-from-header new parameter + drop targets */
  enableBackendParamDrop?: boolean;
  /** Backend: when false, only variable field is shown per row */
  showApiFields?: boolean;
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
}: RowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const hasChildren = node.children.length > 0;
  const isExpanded = !collapsed.has(node.pathKey);
  const hasEntry = Boolean(node.entry);
  const isGroupOnly = hasChildren && !hasEntry;
  const canRenameLabel = Boolean(node.entry && !hasChildren);

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
          const ext = e.externalName.trim() === '' ? newSegment : e.externalName;
          return { ...e, internalPath: nextPath, externalName: ext };
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
      if (!hasNewParamDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      const el = rowRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const placement = placementFromY(e.clientY, rect, hasChildren);
      onInsertBackendParam({ targetPathKey: node.pathKey, placement });
    },
    [enableBackendParamDrop, variant, hasChildren, node.pathKey, onInsertBackendParam]
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

  const ephemeralNew = Boolean(node.entry && isEphemeralNewSegment(node.segment));

  const handleAbandonEphemeral = useCallback(() => {
    if (node.entry) onAbandonEphemeralEntry(node.entry.id);
  }, [node.entry, onAbandonEphemeralEntry]);

  return (
    <div className="select-none">
      {showBefore && <DropPreviewLine indentPx={siblingDropLineIndentPx(depth)} />}
      <div
        ref={rowRef}
        className={`group/row flex items-center gap-1 min-h-[32px] rounded-md px-1 py-0.5 -mx-1 hover:bg-slate-800/50 ${depth > 0 ? 'ml-2 border-l border-slate-700/40 pl-2' : ''}`}
        onDragOver={onRowDragOver}
        onDrop={onRowDrop}
      >
        <div className="flex items-center gap-0.5 shrink-0 w-5 justify-start">
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

        <div className="shrink-0 text-slate-500" title={isGroupOnly ? 'Gruppo' : 'Parametro'}>
          {isGroupOnly ? <Circle className="w-3.5 h-3.5" strokeWidth={2} /> : <Brackets className="w-3.5 h-3.5" />}
        </div>

        <div className="shrink-0 min-w-0 max-w-[min(18rem,55vw)]">
          <LabelWithPencilEdit
            segment={node.segment}
            editable={canRenameLabel}
            onCommit={handleRenameSegment}
            editIntent={Boolean(node.entry && pendingLabelEditId === node.entry.id)}
            onConsumeEditIntent={onConsumeLabelEditIntent}
            ephemeralNew={ephemeralNew}
            onAbandonEphemeral={ephemeralNew ? handleAbandonEphemeral : undefined}
          />
        </div>

        <MappingRowFields
          variant={variant}
          entry={node.entry}
          groupOnlyBackend={variant === 'backend' && isGroupOnly}
          groupOnlyInterface={variant === 'interface' && isGroupOnly}
          showApiFields={variant === 'backend' ? showApiFields : true}
          datalistApiId={datalistApi}
          datalistVarId={datalistVar}
          onPatch={patchEntry}
        />

        <span className="flex-1 min-w-2 shrink" aria-hidden />

        {node.entry && (
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
            />
          ))}
        </div>
      )}

      {showAfter && <DropPreviewLine indentPx={siblingDropLineIndentPx(depth)} />}
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
}: FlowMappingTreeProps) {
  const tree = useMemo(() => buildMappingTree(entries), [entries]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState>(null);
  const [rootEdgeDrop, setRootEdgeDrop] = useState<'top' | 'bottom' | null>(null);
  const [pendingLabelEditId, setPendingLabelEditId] = useState<string | null>(null);

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
      const { next, newEntry } = insertNewBackendParameter(entries, pos);
      setCollapsed((prev) => expandAncestorsOfPath(prev, newEntry.internalPath));
      setPendingLabelEditId(newEntry.id);
      setDropIndicator(null);
      setRootEdgeDrop(null);
      onEntriesChange(next);
    },
    [entries, onEntriesChange]
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
      const label =
        e.dataTransfer.getData(DND_TYPE) || e.dataTransfer.getData('text/plain');
      if (label?.trim() && onDropVariable) {
        onDropVariable(label.trim());
      }
    },
    [onDropVariable]
  );

  const onEmptyBackendDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!enableBackendParamDrop || variant !== 'backend' || tree.length > 0) return;
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
      if (!hasNewParamDrag(e)) return;
      e.preventDefault();
      onInsertBackendParam({ targetPathKey: '', placement: 'after' });
    },
    [enableBackendParamDrop, variant, tree.length, onInsertBackendParam]
  );

  const rootDragOver = useCallback(
    (e: React.DragEvent) => {
      if (showDropZone) onDragOver(e);
      if (enableBackendParamDrop && variant === 'backend' && tree.length > 0 && hasNewParamDrag(e)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    },
    [showDropZone, onDragOver, enableBackendParamDrop, variant, tree.length]
  );

  return (
    <div
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
          Trascina qui una variabile dalla lista sotto (internal = nome trascinato, external editabile).
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
            Trascina <span className="font-semibold text-teal-200/90">Parameter</span> dall&apos;header per aggiungere un parametro.
          </p>
        </div>
      )}

      {enableBackendParamDrop && variant === 'backend' && tree.length > 0 && (
        <div
          className="h-2.5 -mx-0.5 rounded-sm shrink-0"
          onDragOver={(e) => {
            if (!hasNewParamDrag(e)) return;
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
            if (!hasNewParamDrag(e)) return;
            e.preventDefault();
            e.stopPropagation();
            onInsertBackendParam({ targetPathKey: tree[0].pathKey, placement: 'before' });
          }}
        >
          {rootEdgeDrop === 'top' && <DropPreviewLine indentPx={siblingDropLineIndentPx(0)} />}
        </div>
      )}

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
        />
      ))}

      {enableBackendParamDrop && variant === 'backend' && tree.length > 0 && (
        <div
          className="h-2.5 -mx-0.5 rounded-sm shrink-0 mt-0.5"
          onDragOver={(e) => {
            if (!hasNewParamDrag(e)) return;
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

export { DND_TYPE, DND_NEW_BACKEND_PARAM };
