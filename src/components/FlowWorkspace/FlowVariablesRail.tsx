/**
 * Right-edge panel: VariableCreationService rows for this flow canvas.
 * Uses absolute positioning inside the canvas host (not viewport-fixed) so each open flow
 * pane / tab has its own rail on the right edge of that canvas.
 */

import React, { useCallback, useMemo, useReducer } from 'react';
import { Brackets, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { VariableInstance } from '@types/variableTypes';
import type { FlowVariableDefinition } from '../../flows/flowVariableTypes';
import { buildFlowVariableTree, flowVariablesWithoutPath, type FlowVariableTreeNode } from '../../flows/flowVariableTree';
import { variableCreationService } from '../../services/VariableCreationService';
import { useProjectData, useProjectDataUpdate } from '../../context/ProjectDataContext';
import { resolveVariableStoreProjectId } from '../../utils/safeProjectId';

export interface FlowVariablesRailProps {
  flowId: string;
  /** When set, uses this project; otherwise falls back to currentProjectId in localStorage. */
  projectId?: string;
}

function instanceToDef(v: VariableInstance): FlowVariableDefinition {
  return {
    id: v.id,
    label: v.varName,
    type: 'string',
    visibility: 'internal',
  };
}

function scopeLabel(v: VariableInstance): string {
  if (String(v.taskInstanceId ?? '').trim()) return 'Task';
  if ((v.scope ?? 'project') === 'flow') return 'Flow';
  return 'Project';
}

interface InstanceCardProps {
  instance: VariableInstance;
  projectId: string;
  onRenamed: () => void;
  onRemoved: () => void;
}

function InstanceCard({ instance, projectId, onRenamed, onRemoved }: InstanceCardProps) {
  const taskBound = String(instance.taskInstanceId ?? '').trim().length > 0;
  const [draft, setDraft] = React.useState(instance.varName);

  React.useEffect(() => {
    setDraft(instance.varName);
  }, [instance.id, instance.varName]);

  const commitRename = useCallback(() => {
    if (taskBound) return;
    const t = draft.trim();
    if (!t || t === instance.varName) return;
    const ok = variableCreationService.renameVariableById(projectId, instance.id, t);
    if (ok) onRenamed();
    else setDraft(instance.varName);
  }, [draft, instance.id, instance.varName, projectId, taskBound, onRenamed]);

  return (
    <div className="rounded-md border border-slate-700/80 bg-slate-800/50 p-2 space-y-1.5">
      <div className="flex gap-1 items-start">
        <input
          className="flex-1 min-w-0 rounded bg-slate-900/80 border border-slate-600 px-1.5 py-1 text-xs text-slate-100 disabled:opacity-60"
          placeholder="name"
          value={draft}
          disabled={taskBound}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        {!taskBound ? (
          <button
            type="button"
            className="shrink-0 p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"
            aria-label="Remove variable"
            onClick={() => {
              variableCreationService.removeVariableById(projectId, instance.id);
              onRemoved();
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span className="shrink-0 text-[10px] text-slate-500 px-1 py-1" title="Defined by task on canvas">
            —
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{scopeLabel(instance)}</span>
        {taskBound && (
          <span className="text-[10px] text-slate-600 truncate max-w-[10rem]" title={instance.taskInstanceId}>
            {instance.taskInstanceId}
          </span>
        )}
      </div>
    </div>
  );
}

interface TreeNodesProps {
  nodes: FlowVariableTreeNode[];
  depth: number;
  byVarId: Map<string, VariableInstance>;
  projectId: string;
  onRefresh: () => void;
}

function FlowVariableTreeNodes({ nodes, depth, byVarId, projectId, onRefresh }: TreeNodesProps) {
  return (
    <ul className={depth > 0 ? 'mt-1 space-y-1 border-l border-slate-700/50 pl-2 ml-1' : 'space-y-1'}>
      {nodes.map((node) => (
        <FlowVariableTreeBranch
          key={node.pathKey}
          node={node}
          depth={depth}
          byVarId={byVarId}
          projectId={projectId}
          onRefresh={onRefresh}
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
  onRefresh,
}: TreeNodesProps & { node: FlowVariableTreeNode }) {
  const hasChildren = node.children.length > 0;
  const [expanded, setExpanded] = React.useState(true);
  const inst = node.variable ? byVarId.get(node.variable.id) : undefined;

  return (
    <li className="text-xs">
      <div className="flex items-start gap-1" style={{ paddingLeft: depth > 0 ? 0 : undefined }}>
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={expanded}
            className="shrink-0 mt-1 p-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden />
        )}
        <div className="flex-1 min-w-0 space-y-1">
          {inst ? (
            <InstanceCard instance={inst} projectId={projectId} onRenamed={onRefresh} onRemoved={onRefresh} />
          ) : hasChildren ? (
            <div className="rounded-md border border-dashed border-slate-600/60 bg-slate-900/30 px-2 py-1.5">
              <span className="text-[11px] font-medium text-slate-400">{node.segment}</span>
              <span className="block text-[10px] text-slate-600 mt-0.5">Group (no variable on this path)</span>
            </div>
          ) : null}
          {hasChildren && expanded && (
            <FlowVariableTreeNodes
              nodes={node.children}
              depth={depth + 1}
              byVarId={byVarId}
              projectId={projectId}
              onRefresh={onRefresh}
            />
          )}
        </div>
      </div>
    </li>
  );
}

export function FlowVariablesRail({ flowId, projectId: projectIdProp }: FlowVariablesRailProps) {
  const [open, setOpen] = React.useState(false);
  const [addScope, setAddScope] = React.useState<'project' | 'flow'>('project');
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const { data: projectData } = useProjectData();
  const pdUpdate = useProjectDataUpdate();

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

  const defs = useMemo(() => instances.map(instanceToDef), [instances]);
  const orphans = useMemo(() => flowVariablesWithoutPath(defs), [defs]);
  const tree = useMemo(() => buildFlowVariableTree(defs), [defs]);

  const addVariable = useCallback(() => {
    const base =
      addScope === 'flow'
        ? variableCreationService.createManualVariable(projectId, `var_${Date.now().toString(36)}`, {
            scope: 'flow',
            scopeFlowId: flowId,
          })
        : variableCreationService.createManualVariable(projectId, `var_${Date.now().toString(36)}`);
    void base;
    refresh();
  }, [projectId, addScope, flowId]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-50
                   bg-slate-800/40 hover:bg-slate-800/70
                   border-l-2 border-slate-600/50 hover:border-slate-500/70
                   px-2 py-8 rounded-l-lg
                   transition-all duration-300 ease-in-out
                   cursor-pointer group
                   backdrop-blur-sm
                   shadow-lg hover:shadow-xl"
        title={open ? 'Close Variables' : 'Open Variables'}
        aria-expanded={open}
        aria-label="Flow variables"
      >
        <div className="flex flex-col items-center gap-2">
          <Brackets className="w-5 h-5 text-slate-300/70 group-hover:text-slate-200 transition-colors" />
          <span
            className="text-slate-300/70 group-hover:text-slate-200
                       font-semibold text-sm tracking-wider
                       transition-colors duration-300"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            Variables
          </span>
        </div>
      </button>

      <div
        className={`absolute right-0 top-0 bottom-0 z-40 flex flex-col
          bg-slate-900/95 border-l border-slate-600/60 backdrop-blur-md shadow-2xl
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
          w-[min(100vw,22rem)] max-w-[100vw]`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-700/80 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-100 truncate">Variables</h2>
            <p className="text-xs text-slate-400 truncate" title={flowId}>
              Flow: {flowId}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
              Single store: project-wide and this flow&apos;s manual vars, plus task-bound names visible here.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/80 shrink-0 flex-wrap">
          <select
            className="rounded bg-slate-900/80 border border-slate-600 px-1.5 py-1 text-[11px] text-slate-200"
            value={addScope}
            onChange={(e) => setAddScope(e.target.value as 'project' | 'flow')}
            aria-label="Scope for new variable"
          >
            <option value="project">Add to project</option>
            <option value="flow">Add to this flow</option>
          </select>
          <button
            type="button"
            onClick={addVariable}
            disabled={!projectId}
            className="shrink-0 inline-flex items-center gap-1 rounded-md bg-slate-700/80 px-2 py-1 text-xs font-medium text-slate-100 hover:bg-slate-600 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-3">
          {!projectId && (
            <p className="text-xs text-amber-500/90 px-1">Open or save a project to load variables.</p>
          )}
          <section aria-label="Variable list">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2 px-1">
              All variables
            </h3>
            {projectId && instances.length === 0 && (
              <p className="text-xs text-slate-500 px-1">
                No variables yet. Use Add or create variables from tasks / backend mapping. Dot names (e.g.{' '}
                <code className="text-slate-400">a.b</code>) group as a tree.
              </p>
            )}

            {orphans.length > 0 && (
              <div className="space-y-2 mb-3">
                <p className="text-[10px] text-amber-500/90 px-1">Invalid or empty label</p>
                {orphans.map((row) => {
                  const inst = byVarId.get(row.id);
                  if (!inst) return null;
                  return (
                    <InstanceCard
                      key={row.id}
                      instance={inst}
                      projectId={projectId}
                      onRenamed={refresh}
                      onRemoved={refresh}
                    />
                  );
                })}
              </div>
            )}

            {tree.length > 0 && (
              <FlowVariableTreeNodes
                nodes={tree}
                depth={0}
                byVarId={byVarId}
                projectId={projectId}
                onRefresh={refresh}
              />
            )}
          </section>
        </div>
      </div>
    </>
  );
}
