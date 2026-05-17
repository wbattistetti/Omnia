/**
 * Albero mapping backend SEND/RECEIVE su react-arborist (trie wireKey + renderer riga custom).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tree, type TreeApi } from 'react-arborist';
import type { OpenApiInputUiKind } from '../../services/openApiBackendCallSpec';
import type { MappingEntry } from './mappingTypes';
import {
  buildMappingTree,
  type MappingTreeSiblingOrder,
} from './mappingTreeUtils';
import {
  DND_NEW_BACKEND_PARAM,
  insertNewBackendParameter,
  type ParamDropPlacement,
  type ParamDropPosition,
} from './backendParamInsert';
import { parseFlowInterfaceDropFromDataTransfer } from './flowInterfaceDragTypes';
import { mergeBackendMappingVariableDrop } from './backendMappingVariableDrop';
import {
  mappingForestToArboristData,
  countArboristVisibleNodes,
  expandArboristAncestors,
  type BackendArboristNodeData,
} from './backendMappingArboristData';
import {
  BackendMappingTreeProvider,
  type BackendMappingDropIndicator,
} from './backendMappingTreeContext';
import { BackendMappingTreeNode } from './BackendMappingTreeNode';
import {
  BACKEND_TREE_ARROW_SLOT_PX,
  BACKEND_TREE_CHEVRON_SLOT_PX,
  BACKEND_TREE_INDENT_PX,
} from './backendMappingTreeLayout';
import {
  DropPreviewLine,
  findBackendMapRowElementFromPoint,
  placementFromY,
  type DropPreviewTone,
} from './backendMappingTreeDnD';
import type { BackendSendAdvancementApi } from './backendMappingTreeTypes';
import { DND_FLOWROW_VAR } from './flowInterfaceDragTypes';

export const BACKEND_ARBORIST_ROW_HEIGHT = 28;

const BACKEND_TREE_MIN_VIEWPORT_PX = 80;

function hasNewParamDrag(e: React.DragEvent): boolean {
  return [...e.dataTransfer.types].includes(DND_NEW_BACKEND_PARAM);
}

function hasFlowRowVarDrag(e: React.DragEvent): boolean {
  const types = e.dataTransfer?.types ? [...e.dataTransfer.types] : [];
  if (types.includes(DND_FLOWROW_VAR)) return true;
  const lower = DND_FLOWROW_VAR.toLowerCase();
  return types.some((t) => t.toLowerCase() === lower);
}

function removeEntry(entries: MappingEntry[], id: string): MappingEntry[] {
  return entries.filter((e) => e.id !== id);
}

export interface BackendMappingTreeProps {
  entries: MappingEntry[];
  onEntriesChange: (next: MappingEntry[]) => void;
  listIdPrefix: string;
  enableBackendParamDrop?: boolean;
  showApiFields?: boolean;
  projectId?: string;
  flowCanvasId?: string;
  siblingOrder?: MappingTreeSiblingOrder;
  backendColumn?: 'send' | 'receive';
  onCreateOutputVariable?: (displayName: string) => { id: string; label: string } | null;
  onOutputVariableCreated?: () => void;
  backendKnownVariableIds?: ReadonlySet<string>;
  backendSendParamKindByWireKey?: Record<string, OpenApiInputUiKind>;
  backendSendParamEnumByWireKey?: Record<string, string[]>;
  backendSendAdvancement?: BackendSendAdvancementApi;
  embeddedSignatureSubToolbarOpen?: boolean;
  variableOptions: string[];
  agentParamDragSource?: import('./backendMappingTreeContext').AgentParamDragSource;
  /** Altezza da righe visibili; scroll delegato al contenitore padre (workspace inspector). */
  scrollMappingInParent?: boolean;
}

export function BackendMappingTree({
  entries,
  onEntriesChange,
  listIdPrefix,
  enableBackendParamDrop = false,
  showApiFields = true,
  projectId,
  flowCanvasId,
  siblingOrder = 'construction',
  backendColumn,
  onCreateOutputVariable,
  onOutputVariableCreated,
  backendKnownVariableIds,
  backendSendParamKindByWireKey,
  backendSendParamEnumByWireKey,
  backendSendAdvancement,
  embeddedSignatureSubToolbarOpen,
  variableOptions,
  agentParamDragSource,
  scrollMappingInParent = false,
}: BackendMappingTreeProps) {
  const treeRef = useRef<TreeApi<BackendArboristNodeData> | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [treeHeight, setTreeHeight] = useState(240);
  const [dropIndicator, setDropIndicator] = useState<BackendMappingDropIndicator>(null);
  const [rootEdgeDrop, setRootEdgeDrop] = useState<'top' | 'bottom' | null>(null);
  const [pendingLabelEditId, setPendingLabelEditId] = useState<string | null>(null);

  const forest = useMemo(
    () => buildMappingTree(entries, { siblingOrder }),
    [entries, siblingOrder]
  );

  const arboristData = useMemo(() => mappingForestToArboristData(forest), [forest]);

  const naturalTreeHeight = useMemo(() => {
    const rows = countArboristVisibleNodes(arboristData);
    return Math.max(BACKEND_TREE_MIN_VIEWPORT_PX, rows * BACKEND_ARBORIST_ROW_HEIGHT);
  }, [arboristData]);

  const effectiveTreeHeight = scrollMappingInParent ? naturalTreeHeight : treeHeight;

  useEffect(() => {
    if (scrollMappingInParent) return;
    const el = viewportRef.current ?? measureRef.current;
    if (!el) return;
    const apply = () => {
      const h = el.getBoundingClientRect().height;
      if (h <= 0) return;
      const next = Math.max(BACKEND_TREE_MIN_VIEWPORT_PX, Math.floor(h));
      setTreeHeight((prev) => (prev === next ? prev : next));
    };
    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    apply();
    return () => ro.disconnect();
  }, [forest.length, scrollMappingInParent]);

  useEffect(() => {
    const clear = () => {
      setDropIndicator(null);
      setRootEdgeDrop(null);
    };
    window.addEventListener('dragend', clear);
    return () => window.removeEventListener('dragend', clear);
  }, []);

  const openPathInTree = useCallback((wireKey: string) => {
    const api = treeRef.current;
    if (!api) return;
    expandArboristAncestors((id) => api.open(id), wireKey);
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
      openPathInTree(newEntry.wireKey);
      setPendingLabelEditId(newEntry.id);
      setDropIndicator(null);
      setRootEdgeDrop(null);
      onEntriesChange(next);
    },
    [entries, onEntriesChange, openPathInTree, siblingOrder]
  );

  const commitBackendFlowVariableDrop = useCallback(
    (e: React.DragEvent, pos: ParamDropPosition) => {
      const payload = parseFlowInterfaceDropFromDataTransfer(e.dataTransfer);
      const vid = payload?.variableRefId?.trim();
      if (!vid) return;
      e.preventDefault();
      e.stopPropagation();
      const result = mergeBackendMappingVariableDrop(
        entries,
        { variableRefId: vid, rowLabel: (payload.rowLabel ?? '').trim() },
        projectId,
        flowCanvasId,
        siblingOrder,
        pos
      );
      if (!result) return;
      onEntriesChange(result.merged);
      openPathInTree(result.newEntry.wireKey);
      setDropIndicator(null);
      setRootEdgeDrop(null);
      setPendingLabelEditId(result.newEntry.id);
    },
    [entries, onEntriesChange, openPathInTree, projectId, flowCanvasId, siblingOrder]
  );

  const onAbandonEphemeralEntry = useCallback(
    (entryId: string) => {
      setPendingLabelEditId((p) => (p === entryId ? null : p));
      onEntriesChange(removeEntry(entries, entryId));
    },
    [entries, onEntriesChange]
  );

  const dropLineTone: DropPreviewTone =
    backendColumn === 'send' ? 'teal' : backendColumn === 'receive' ? 'emerald' : 'amber';

  const dropLineIndentPx = useCallback(
    (level: number) =>
      BACKEND_TREE_CHEVRON_SLOT_PX +
      Math.floor(BACKEND_TREE_ARROW_SLOT_PX / 2) +
      level * BACKEND_TREE_INDENT_PX,
    []
  );

  const contextValue = useMemo(
    () => ({
      entries,
      onEntriesChange,
      listIdPrefix,
      showApiFields,
      enableBackendParamDrop: Boolean(enableBackendParamDrop),
      dropIndicator,
      onBackendParamDragOver,
      onInsertBackendParam,
      onBackendFlowVariableDrop: enableBackendParamDrop ? commitBackendFlowVariableDrop : undefined,
      pendingLabelEditId,
      onConsumeLabelEditIntent,
      onAbandonEphemeralEntry,
      backendColumn,
      variableOptions,
      onCreateOutputVariable,
      onOutputVariableCreated,
      backendKnownVariableIds,
      backendSendParamKindByWireKey,
      backendSendParamEnumByWireKey,
      backendSendAdvancement,
      embeddedSignatureSubToolbarOpen,
      agentParamDragSource,
      dropLineIndentPx,
      dropLineTone,
    }),
    [
      entries,
      onEntriesChange,
      listIdPrefix,
      showApiFields,
      enableBackendParamDrop,
      dropIndicator,
      onBackendParamDragOver,
      onInsertBackendParam,
      commitBackendFlowVariableDrop,
      pendingLabelEditId,
      onConsumeLabelEditIntent,
      onAbandonEphemeralEntry,
      backendColumn,
      variableOptions,
      onCreateOutputVariable,
      onOutputVariableCreated,
      backendKnownVariableIds,
      backendSendParamKindByWireKey,
      backendSendParamEnumByWireKey,
      backendSendAdvancement,
      embeddedSignatureSubToolbarOpen,
      agentParamDragSource,
      dropLineIndentPx,
      dropLineTone,
    ]
  );

  const rootDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!enableBackendParamDrop || forest.length === 0) return;
      if (!hasFlowRowVarDrag(e) && !hasNewParamDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      const rowEl = findBackendMapRowElementFromPoint(e.clientX, e.clientY);
      if (rowEl) {
        const pathKey = rowEl.getAttribute('data-backend-map-row') || '';
        const hasCh = rowEl.getAttribute('data-backend-map-has-children') === '1';
        const rect = rowEl.getBoundingClientRect();
        setDropIndicator({
          targetPathKey: pathKey,
          placement: placementFromY(e.clientY, rect, hasCh),
        });
        setRootEdgeDrop(null);
      } else {
        setDropIndicator(null);
      }
    },
    [enableBackendParamDrop, forest.length]
  );

  const siblingDropLineIndentPx = dropLineIndentPx(0);

  if (forest.length === 0) {
    return (
      <div
        className="min-h-[52px] rounded-md border border-dashed border-teal-600/35 bg-slate-950/20 p-1"
        onDragOver={(e) => {
          if (!enableBackendParamDrop) return;
          if (!hasNewParamDrag(e) && !hasFlowRowVarDrag(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setDropIndicator({ targetPathKey: '', placement: 'after' });
        }}
        onDrop={(e) => {
          if (hasFlowRowVarDrag(e)) {
            commitBackendFlowVariableDrop(e, { targetPathKey: '', placement: 'after' });
            return;
          }
          if (!hasNewParamDrag(e)) return;
          e.preventDefault();
          onInsertBackendParam({ targetPathKey: '', placement: 'after' });
        }}
      >
        {dropIndicator?.targetPathKey === '' ? (
          <DropPreviewLine indentPx={siblingDropLineIndentPx} />
        ) : null}
        <p className="px-2 py-3 text-center text-xs text-teal-300/75">
          Trascina <span className="font-semibold text-teal-200/90">Parameter</span> dall&apos;header, oppure una{' '}
          <span className="font-semibold text-teal-200/90">variabile</span> dal menù subflow.
        </p>
      </div>
    );
  }

  return (
    <BackendMappingTreeProvider value={contextValue}>
      <div
        ref={measureRef}
        className={
          scrollMappingInParent
            ? 'flex min-w-0 flex-col'
            : 'flex h-full min-h-0 flex-1 flex-col'
        }
        onDragOver={enableBackendParamDrop ? rootDragOver : undefined}
      >
        {enableBackendParamDrop ? (
          <div
            className="h-2.5 shrink-0 rounded-sm"
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
                commitBackendFlowVariableDrop(e, {
                  targetPathKey: forest[0]!.pathKey,
                  placement: 'before',
                });
                return;
              }
              if (!hasNewParamDrag(e)) return;
              e.preventDefault();
              onInsertBackendParam({ targetPathKey: forest[0]!.pathKey, placement: 'before' });
            }}
          >
            {rootEdgeDrop === 'top' ? <DropPreviewLine indentPx={siblingDropLineIndentPx} /> : null}
          </div>
        ) : null}

        <div
          ref={viewportRef}
          className={
            scrollMappingInParent
              ? 'relative shrink-0 overflow-visible'
              : 'relative min-h-0 flex-1 overflow-hidden'
          }
        >
            <Tree
              ref={treeRef}
              data={arboristData}
              idAccessor="id"
              childrenAccessor="children"
              openByDefault
              width="100%"
              height={effectiveTreeHeight}
              indent={0}
              rowHeight={BACKEND_ARBORIST_ROW_HEIGHT}
              overscanCount={8}
              disableDrag
              disableEdit
              className={
                scrollMappingInParent
                  ? 'omnia-backend-mapping-arborist'
                  : 'omnia-backend-mapping-arborist h-full'
              }
            >
              {BackendMappingTreeNode}
            </Tree>
        </div>

        {enableBackendParamDrop ? (
          <div
            className="mt-0.5 h-2.5 shrink-0 rounded-sm"
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
              const last = forest[forest.length - 1]!;
              if (hasFlowRowVarDrag(e)) {
                commitBackendFlowVariableDrop(e, { targetPathKey: last.pathKey, placement: 'after' });
                return;
              }
              if (!hasNewParamDrag(e)) return;
              e.preventDefault();
              onInsertBackendParam({ targetPathKey: last.pathKey, placement: 'after' });
            }}
          >
            {rootEdgeDrop === 'bottom' ? <DropPreviewLine indentPx={siblingDropLineIndentPx} /> : null}
          </div>
        ) : null}
      </div>
    </BackendMappingTreeProvider>
  );
}
