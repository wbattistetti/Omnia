/**
 * Pannello Data (variabili di scope flow): albero compatto per segmento, icone variabile vs gruppo,
 * rinomina con matita al hover e conferma ✓/✗. Modalità dock: colonna flex (FlowCanvasHost).
 */

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Brackets,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { VariableInstance } from '@types/variableTypes';
import type { FlowVariableDefinition } from '../../flows/flowVariableTypes';
import {
  buildFlowVariableTree,
  flattenFlowVariablePathKeysDfs,
  flowVariablesWithoutPath,
  type FlowVariableTreeNode,
} from '../../flows/flowVariableTree';
import {
  computeNewFlowVariableVarName,
  DND_NEW_FLOW_DATA,
  hasNewFlowDataDrag,
  type FlowVarDropPlacement,
} from '../../flows/flowVariableInsert';
import { variableCreationService } from '../../services/VariableCreationService';
import { useProjectData, useProjectDataUpdate } from '../../context/ProjectDataContext';
import { useProjectTranslations } from '../../context/ProjectTranslationsContext';
import { resolveVariableStoreProjectId } from '../../utils/safeProjectId';
import { getVariableLabel } from '../../utils/getVariableLabel';
import { makeTranslationKey } from '../../utils/translationKeys';

export interface FlowVariablesRailProps {
  flowId: string;
  projectId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideEdgeToggle?: boolean;
  dockAsColumn?: boolean;
}

const ROW_DEPTH_INDENT_PX = 16;
const ROW_ICON_LINE_OFFSET_PX = 24;

function siblingDropLineIndentPx(depth: number): number {
  return depth * ROW_DEPTH_INDENT_PX + ROW_ICON_LINE_OFFSET_PX;
}

function childDropLineIndentPx(depth: number): number {
  return (depth + 1) * ROW_DEPTH_INDENT_PX + ROW_ICON_LINE_OFFSET_PX;
}

function placementFromY(clientY: number, rowRect: DOMRect, hasChildNodes: boolean): FlowVarDropPlacement {
  const y = clientY - rowRect.top;
  const t = rowRect.height > 0 ? y / rowRect.height : 0.5;
  if (hasChildNodes) {
    if (t < 0.28) return 'before';
    if (t > 0.72) return 'after';
    return 'child';
  }
  return t < 0.5 ? 'before' : 'after';
}

function DropPreviewLine({ indentPx = 0 }: { indentPx?: number }) {
  return (
    <div
      className="pointer-events-none h-0.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.55)]"
      style={{ marginLeft: indentPx }}
      aria-hidden
    />
  );
}

function instanceToDef(v: VariableInstance, translations: Record<string, string>): FlowVariableDefinition {
  const devFb = import.meta.env.DEV ? String(v.varName || '').trim() : undefined;
  return {
    id: v.id,
    label: getVariableLabel(v.id, translations, devFb),
    type: 'string',
    visibility: 'internal',
  };
}

/** Riga variabile: icona [], etichetta = solo segmento; edit del nome completo (path) per coerenza col servizio. */
function DataTreeVariableRow({
  segment,
  instance,
  projectId,
  translations,
  addTranslation,
  onRefresh,
}: {
  segment: string;
  instance: VariableInstance;
  projectId: string;
  translations: Record<string, string>;
  addTranslation: (guid: string, text: string) => void;
  onRefresh: () => void;
}) {
  const taskBound = String(instance.taskInstanceId ?? '').trim().length > 0;
  const devFb = import.meta.env.DEV ? String(instance.varName || '').trim() : undefined;
  const fullLabel = getVariableLabel(instance.id, translations, devFb);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fullLabel);

  React.useEffect(() => {
    setDraft(getVariableLabel(instance.id, translations, devFb));
  }, [instance.id, translations, devFb]);

  const commit = useCallback(() => {
    if (taskBound) return;
    const t = draft.trim();
    const current = getVariableLabel(instance.id, translations, devFb);
    if (!t || t === current) {
      setDraft(current);
      setEditing(false);
      return;
    }
    const ok = variableCreationService.renameVariableById(projectId, instance.id, t);
    if (ok) {
      addTranslation(makeTranslationKey('variable', instance.id), t);
      onRefresh();
    } else {
      setDraft(current);
    }
    setEditing(false);
  }, [draft, instance.id, translations, devFb, projectId, taskBound, addTranslation, onRefresh]);

  const cancel = useCallback(() => {
    setDraft(getVariableLabel(instance.id, translations, devFb));
    setEditing(false);
  }, [instance.id, translations, devFb]);

  const displayForDrag = getVariableLabel(instance.id, translations, devFb);

  return (
    <div
      className="group/row flex min-w-0 flex-1 items-center gap-1.5 rounded px-0.5 py-0.5 hover:bg-slate-800/60"
      draggable={!taskBound}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', displayForDrag);
        e.dataTransfer.setData('application/x-omnia-varlabel', displayForDrag);
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <Brackets className="h-3.5 w-3.5 shrink-0 text-amber-200/85" strokeWidth={2.2} aria-hidden />
      {editing ? (
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          <input
            className="min-w-0 flex-1 rounded border border-amber-500/45 bg-slate-950/90 px-1.5 py-0.5 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
            value={draft}
            disabled={taskBound}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
            autoFocus
            aria-label="Rinomina dato"
          />
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-emerald-400 hover:bg-slate-800"
            title="Conferma"
            onMouseDown={(e) => e.preventDefault()}
            onClick={commit}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-red-400"
            title="Annulla"
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancel}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate text-[11px] text-slate-100" title={fullLabel}>
            {segment}
          </span>
          {!taskBound && (
            <>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-slate-500 opacity-0 hover:bg-slate-700 hover:text-amber-200 group-hover/row:opacity-100"
                title="Rinomina"
                aria-label="Rinomina"
                onClick={() => {
                  setDraft(fullLabel);
                  setEditing(true);
                }}
              >
                <Pencil className="h-3 w-3" strokeWidth={2} />
              </button>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-slate-600 opacity-0 hover:bg-slate-700 hover:text-red-400 group-hover/row:opacity-100"
                aria-label="Rimuovi variabile"
                onClick={() => {
                  variableCreationService.removeVariableById(projectId, instance.id);
                  onRefresh();
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

interface TreeNodesProps {
  nodes: FlowVariableTreeNode[];
  depth: number;
  byVarId: Map<string, VariableInstance>;
  projectId: string;
  translations: Record<string, string>;
  addTranslation: (guid: string, text: string) => void;
  onRefresh: () => void;
  dropIndicator: { targetPathKey: string; placement: FlowVarDropPlacement } | null;
  setDropIndicator: React.Dispatch<
    React.SetStateAction<{ targetPathKey: string; placement: FlowVarDropPlacement } | null>
  >;
  onInsertAt: (pos: { targetPathKey: string; placement: FlowVarDropPlacement }) => void;
}

function FlowVariableTreeNodes(props: TreeNodesProps) {
  const {
    nodes,
    depth,
    byVarId,
    projectId,
    translations,
    addTranslation,
    onRefresh,
    dropIndicator,
    setDropIndicator,
    onInsertAt,
  } = props;
  return (
    <ul className={depth > 0 ? 'ml-2 border-l border-slate-700/40 pl-2' : ''} role="tree">
      {nodes.map((node) => (
        <FlowVariableTreeBranch
          key={node.pathKey}
          node={node}
          depth={depth}
          byVarId={byVarId}
          projectId={projectId}
          translations={translations}
          addTranslation={addTranslation}
          onRefresh={onRefresh}
          dropIndicator={dropIndicator}
          setDropIndicator={setDropIndicator}
          onInsertAt={onInsertAt}
        />
      ))}
    </ul>
  );
}

function FlowVariableTreeBranch({
  node,
  depth,
  byVarId,
  projectId,
  translations,
  addTranslation,
  onRefresh,
  dropIndicator,
  setDropIndicator,
  onInsertAt,
}: TreeNodesProps & { node: FlowVariableTreeNode }) {
  const rowRef = React.useRef<HTMLDivElement | null>(null);
  const hasChildNodes = node.children.length > 0;
  const [expanded, setExpanded] = useState(true);
  const inst = node.variable ? byVarId.get(node.variable.id) : undefined;
  const isPlaceholder = Boolean(hasChildNodes && !node.variable);
  const isVariable = Boolean(node.variable && inst);

  const handleRowDragOver = (e: React.DragEvent) => {
    if (!hasNewFlowDataDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return;
    const placement = placementFromY(e.clientY, rect, hasChildNodes);
    setDropIndicator({ targetPathKey: node.pathKey, placement });
  };

  const handleRowDragLeave = (e: React.DragEvent) => {
    if (!rowRef.current?.contains(e.relatedTarget as Node)) {
      setDropIndicator(null);
    }
  };

  const handleRowDrop = (e: React.DragEvent) => {
    if (!hasNewFlowDataDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDropIndicator(null);
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return;
    const placement = placementFromY(e.clientY, rect, hasChildNodes);
    onInsertAt({ targetPathKey: node.pathKey, placement });
  };

  const showBefore =
    dropIndicator?.targetPathKey === node.pathKey && dropIndicator.placement === 'before';
  const showAfter =
    dropIndicator?.targetPathKey === node.pathKey && dropIndicator.placement === 'after';
  const showChildLine =
    hasChildNodes &&
    expanded &&
    dropIndicator?.targetPathKey === node.pathKey &&
    dropIndicator.placement === 'child';

  return (
    <li className="text-[11px] text-slate-200" role="treeitem" aria-expanded={hasChildNodes ? expanded : undefined}>
      {showBefore && <DropPreviewLine indentPx={siblingDropLineIndentPx(depth)} />}
      <div className="flex items-start gap-0.5">
        {hasChildNodes ? (
          <button
            type="button"
            aria-expanded={expanded}
            className="mt-0.5 shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div
            ref={rowRef}
            className="min-h-[28px] rounded px-0.5 py-0.5 -mx-0.5"
            onDragOver={handleRowDragOver}
            onDragLeave={handleRowDragLeave}
            onDrop={handleRowDrop}
          >
            <div className="flex items-start gap-1">
              {isPlaceholder ? (
                <div className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5">
                  <Circle className="h-2.5 w-2.5 shrink-0 fill-slate-500 text-slate-500" aria-hidden />
                  <span className="truncate font-medium text-slate-400">{node.segment}</span>
                </div>
              ) : isVariable && inst ? (
                <DataTreeVariableRow
                  segment={node.segment}
                  instance={inst}
                  projectId={projectId}
                  translations={translations}
                  addTranslation={addTranslation}
                  onRefresh={onRefresh}
                />
              ) : node.variable ? (
                <div className="flex items-center gap-1.5 py-0.5 text-slate-500">
                  <Brackets className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                  <span className="truncate">{node.segment}</span>
                </div>
              ) : null}
            </div>
          </div>
          {showAfter && <DropPreviewLine indentPx={siblingDropLineIndentPx(depth)} />}
          {hasChildNodes && expanded && (
            <>
              {showChildLine && <DropPreviewLine indentPx={childDropLineIndentPx(depth)} />}
              <FlowVariableTreeNodes
                nodes={node.children}
                depth={depth + 1}
                byVarId={byVarId}
                projectId={projectId}
                translations={translations}
                addTranslation={addTranslation}
                onRefresh={onRefresh}
                dropIndicator={dropIndicator}
                setDropIndicator={setDropIndicator}
                onInsertAt={onInsertAt}
              />
            </>
          )}
        </div>
      </div>
    </li>
  );
}

export function FlowVariablesRail({
  flowId,
  projectId: projectIdProp,
  open: openControlled,
  onOpenChange,
  hideEdgeToggle = false,
  dockAsColumn = false,
}: FlowVariablesRailProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = openControlled !== undefined;
  const open = isControlled ? Boolean(openControlled) : internalOpen;
  const setOpen = React.useCallback(
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
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [dropIndicator, setDropIndicator] = useState<{
    targetPathKey: string;
    placement: FlowVarDropPlacement;
  } | null>(null);
  const [rootEdgeDrop, setRootEdgeDrop] = useState<'top' | 'bottom' | null>(null);
  const ignoreNextClickRef = useRef(false);
  const { data: projectData } = useProjectData();
  const pdUpdate = useProjectDataUpdate();
  const { translations, addTranslation } = useProjectTranslations();

  const projectId = useMemo(() => {
    const fromProp = projectIdProp?.trim();
    const fromCtx = pdUpdate?.getCurrentProjectId?.()?.trim();
    let fromStorage = '';
    try {
      fromStorage = localStorage.getItem('currentProjectId') || '';
    } catch {
      /* noop */
    }
    return resolveVariableStoreProjectId(fromProp || fromCtx || fromStorage || undefined);
  }, [projectIdProp, pdUpdate, projectData, refresh]);

  const instances = useMemo(() => {
    return variableCreationService.getVariablesForFlowScope(projectId, flowId);
  }, [projectId, flowId, refresh, projectData]);

  const byVarId = useMemo(() => {
    const m = new Map<string, VariableInstance>();
    instances.forEach((v) => m.set(v.id, v));
    return m;
  }, [instances]);

  const defs = useMemo(
    () => instances.map((v) => instanceToDef(v, translations)),
    [instances, translations]
  );
  const orphans = useMemo(() => flowVariablesWithoutPath(defs), [defs]);
  const tree = useMemo(() => buildFlowVariableTree(defs), [defs]);

  const flatPathKeys = useMemo(() => flattenFlowVariablePathKeysDfs(tree), [tree]);

  const varNames = useMemo(
    () => instances.map((v) => String(v.varName || '').trim()).filter(Boolean),
    [instances]
  );

  const insertVariableAt = useCallback(
    (pos: { targetPathKey: string; placement: FlowVarDropPlacement }) => {
      if (!projectId) return;
      const name = computeNewFlowVariableVarName(varNames, pos);
      const base = variableCreationService.createManualVariable(projectId, name, {
        scope: 'flow',
        scopeFlowId: flowId,
      });
      const label = String(base.varName || '').trim();
      if (label) addTranslation(makeTranslationKey('variable', base.id), label);
      refresh();
    },
    [projectId, flowId, varNames, addTranslation]
  );

  const appendAtEnd = useCallback(() => {
    if (flatPathKeys.length > 0) {
      insertVariableAt({ targetPathKey: flatPathKeys[flatPathKeys.length - 1], placement: 'after' });
    } else {
      insertVariableAt({ targetPathKey: '', placement: 'after' });
    }
  }, [flatPathKeys, insertVariableAt]);

  useEffect(() => {
    const clear = () => {
      setDropIndicator(null);
      setRootEdgeDrop(null);
    };
    window.addEventListener('dragend', clear);
    return () => window.removeEventListener('dragend', clear);
  }, []);

  const panelBody = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-700/80 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-100">Data</h2>
        {hideEdgeToggle ? (
          <button
            type="button"
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            title="Chiudi"
            aria-label="Chiudi pannello dati"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-b border-slate-800/80 px-3 py-2">
        <button
          type="button"
          draggable
          onDragStart={(e) => {
            ignoreNextClickRef.current = true;
            e.dataTransfer.setData(DND_NEW_FLOW_DATA, '1');
            e.dataTransfer.effectAllowed = 'copy';
          }}
          onDragEnd={() => {
            window.setTimeout(() => {
              ignoreNextClickRef.current = false;
            }, 0);
          }}
          onClick={() => {
            if (ignoreNextClickRef.current) {
              ignoreNextClickRef.current = false;
              return;
            }
            appendAtEnd();
          }}
          disabled={!projectId}
          title="Clic: aggiungi in coda. Trascina sull'albero per inserire con anteprima."
          className="inline-flex shrink-0 cursor-grab items-center gap-1 rounded-md bg-slate-700/80 px-2 py-1 text-xs font-medium text-slate-100 hover:bg-slate-600 active:cursor-grabbing disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Aggiungi dato
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-2">
        {!projectId && (
          <p className="px-1 text-xs text-amber-500/90">Apri o salva un progetto per vedere i dati.</p>
        )}
        {projectId && instances.length === 0 && (
          <p className="px-1 text-xs text-slate-500">Nessun dato. Usa Aggiungi dato o creane dai task.</p>
        )}

        {projectId && tree.length === 0 && (
          <div
            className="min-h-[3.5rem] rounded border border-dashed border-slate-600/45 px-2 py-3 text-center"
            onDragOver={(e) => {
              if (!hasNewFlowDataDrag(e)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              if (!hasNewFlowDataDrag(e)) return;
              e.preventDefault();
              insertVariableAt({ targetPathKey: '', placement: 'after' });
            }}
          >
            <p className="text-[11px] text-slate-500">
              Trascina qui il pulsante &quot;Aggiungi dato&quot; oppure cliccalo per il primo dato in coda.
            </p>
          </div>
        )}

        {orphans.length > 0 && (
          <div className="space-y-1">
            {orphans.map((row) => {
              const inst = byVarId.get(row.id);
              if (!inst) return null;
              const devFb = import.meta.env.DEV ? String(inst.varName || '').trim() : undefined;
              const orphanLabel = getVariableLabel(inst.id, translations, devFb);
              return (
                <DataTreeVariableRow
                  key={row.id}
                  segment={orphanLabel.trim() || '—'}
                  instance={inst}
                  projectId={projectId}
                  translations={translations}
                  addTranslation={addTranslation}
                  onRefresh={refresh}
                />
              );
            })}
          </div>
        )}

        {tree.length > 0 && (
          <>
            <div
              className="h-2 -mx-0.5 shrink-0 rounded-sm"
              onDragOver={(e) => {
                if (!hasNewFlowDataDrag(e)) return;
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
                if (!hasNewFlowDataDrag(e)) return;
                e.preventDefault();
                e.stopPropagation();
                setRootEdgeDrop(null);
                insertVariableAt({ targetPathKey: tree[0].pathKey, placement: 'before' });
              }}
            >
              {rootEdgeDrop === 'top' && <DropPreviewLine indentPx={siblingDropLineIndentPx(0)} />}
            </div>
            <FlowVariableTreeNodes
              nodes={tree}
              depth={0}
              byVarId={byVarId}
              projectId={projectId}
              translations={translations}
              addTranslation={addTranslation}
              onRefresh={refresh}
              dropIndicator={dropIndicator}
              setDropIndicator={setDropIndicator}
              onInsertAt={insertVariableAt}
            />
            <div
              className="mt-0.5 h-2 -mx-0.5 shrink-0 rounded-sm"
              onDragOver={(e) => {
                if (!hasNewFlowDataDrag(e)) return;
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
                if (!hasNewFlowDataDrag(e)) return;
                e.preventDefault();
                e.stopPropagation();
                setRootEdgeDrop(null);
                const last = flatPathKeys[flatPathKeys.length - 1];
                if (last) {
                  insertVariableAt({ targetPathKey: last, placement: 'after' });
                }
              }}
            >
              {rootEdgeDrop === 'bottom' && <DropPreviewLine indentPx={siblingDropLineIndentPx(0)} />}
            </div>
          </>
        )}
      </div>
    </>
  );

  return (
    <>
      {!hideEdgeToggle ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="fixed right-0 top-1/2 z-50 -translate-y-1/2 cursor-pointer rounded-l-lg border-l-2 border-slate-600/50 bg-slate-800/40 px-2 py-8 shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out hover:border-slate-500/70 hover:bg-slate-800/70 hover:shadow-xl group"
          title={open ? 'Chiudi dati' : 'Apri dati del flow'}
          aria-expanded={open}
          aria-label="Dati del flow"
        >
          <div className="flex flex-col items-center gap-2">
            <Brackets className="h-5 w-5 text-slate-300/70 transition-colors group-hover:text-slate-200" />
            <span
              className="text-sm font-semibold tracking-wider text-slate-300/70 transition-colors duration-300 group-hover:text-slate-200"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              Data
            </span>
          </div>
        </button>
      ) : null}

      {dockAsColumn ? (
        <div
          className={`flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-slate-600/60 bg-slate-900/95 shadow-xl transition-[width] duration-300 ease-in-out ${
            open ? 'w-[min(22rem,100%)] border-l' : 'w-0 border-0'
          }`}
        >
          {open ? (
            <div className="flex h-full min-h-0 w-[min(22rem,100vw)] max-w-[100vw] flex-col">{panelBody}</div>
          ) : null}
        </div>
      ) : (
        <div
          className={`absolute right-0 top-0 bottom-0 z-30 flex flex-col border-l border-slate-600/60 bg-slate-900/95 shadow-2xl backdrop-blur-md transition-transform duration-300 ease-in-out ${
            open ? 'translate-x-0' : 'translate-x-full'
          } w-[min(100vw,22rem)] max-w-[100vw]`}
          aria-hidden={!open}
        >
          {panelBody}
        </div>
      )}
    </>
  );
}
