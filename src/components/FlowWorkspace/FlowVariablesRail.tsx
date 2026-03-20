/**
 * Right-edge vertical tab + slide panel for flow-scoped Variables (author view).
 * Single list: variables shown in a tree when labels use dot notation (e.g. a.b.c).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Brackets, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useFlowWorkspace, useFlowActions } from '../../flows/FlowStore.tsx';
import {
  createEmptyFlowVariable,
  type FlowVariableDataType,
  type FlowVariableDefinition,
  type FlowVariableVisibility,
} from '../../flows/flowVariableTypes';
import {
  buildFlowVariableTree,
  flowVariablesWithoutPath,
  type FlowVariableTreeNode,
} from '../../flows/flowVariableTree';

const VIS_OPTIONS: { value: FlowVariableVisibility; label: string }[] = [
  { value: 'internal', label: 'Internal' },
  { value: 'input', label: 'Input' },
  { value: 'output', label: 'Output' },
  { value: 'inout', label: 'In-Out' },
];

const TYPE_OPTIONS: { value: FlowVariableDataType; label: string }[] = [
  { value: 'string', label: 'string' },
  { value: 'number', label: 'number' },
  { value: 'boolean', label: 'boolean' },
  { value: 'semanticValue', label: 'semanticValue' },
  { value: 'object', label: 'object' },
  { value: 'array', label: 'array' },
];

export interface FlowVariablesRailProps {
  flowId: string;
}

interface VariableEditorCardProps {
  row: FlowVariableDefinition;
  updateRow: (id: string, patch: Partial<FlowVariableDefinition>) => void;
  removeRow: (id: string) => void;
}

function VariableEditorCard({ row, updateRow, removeRow }: VariableEditorCardProps) {
  return (
    <div className="rounded-md border border-slate-700/80 bg-slate-800/50 p-2 space-y-1.5">
      <div className="flex gap-1 items-start">
        <input
          className="flex-1 min-w-0 rounded bg-slate-900/80 border border-slate-600 px-1.5 py-1 text-xs text-slate-100"
          placeholder="label"
          value={row.label}
          onChange={(e) => updateRow(row.id, { label: e.target.value })}
        />
        <button
          type="button"
          className="shrink-0 p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"
          aria-label="Rimuovi variabile"
          onClick={() => removeRow(row.id)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        <select
          className="rounded bg-slate-900/80 border border-slate-600 px-1 py-0.5 text-[11px] text-slate-200"
          value={row.visibility}
          onChange={(e) => updateRow(row.id, { visibility: e.target.value as FlowVariableVisibility })}
        >
          {VIS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="rounded bg-slate-900/80 border border-slate-600 px-1 py-0.5 text-[11px] text-slate-200"
          value={row.type}
          onChange={(e) => updateRow(row.id, { type: e.target.value as FlowVariableDataType })}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <input
        className="w-full rounded bg-slate-900/80 border border-slate-600 px-1.5 py-1 text-[11px] text-slate-300"
        placeholder="semantic domain (opzionale)"
        value={row.semanticDomain ?? ''}
        onChange={(e) => updateRow(row.id, { semanticDomain: e.target.value || undefined })}
      />
      <input
        className="w-full rounded bg-slate-900/80 border border-slate-600 px-1.5 py-1 text-[11px] text-slate-400"
        placeholder="note (opzionale)"
        value={row.notes ?? ''}
        onChange={(e) => updateRow(row.id, { notes: e.target.value || undefined })}
      />
    </div>
  );
}

interface TreeNodesProps {
  nodes: FlowVariableTreeNode[];
  depth: number;
  updateRow: (id: string, patch: Partial<FlowVariableDefinition>) => void;
  removeRow: (id: string) => void;
}

/**
 * Renders one level of the dot-path tree; group nodes (no variable) only show a label + chevron.
 */
function FlowVariableTreeNodes({ nodes, depth, updateRow, removeRow }: TreeNodesProps) {
  return (
    <ul className={depth > 0 ? 'mt-1 space-y-1 border-l border-slate-700/50 pl-2 ml-1' : 'space-y-1'}>
      {nodes.map((node) => (
        <FlowVariableTreeBranch
          key={node.pathKey}
          node={node}
          depth={depth}
          updateRow={updateRow}
          removeRow={removeRow}
        />
      ))}
    </ul>
  );
}

function FlowVariableTreeBranch({
  node,
  depth,
  updateRow,
  removeRow,
}: TreeNodesProps & { node: FlowVariableTreeNode }) {
  const hasChildren = node.children.length > 0;
  const [expanded, setExpanded] = useState(true);

  return (
    <li className="text-xs">
      <div
        className="flex items-start gap-1"
        style={{ paddingLeft: depth > 0 ? 0 : undefined }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={expanded}
            className="shrink-0 mt-1 p-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden />
        )}
        <div className="flex-1 min-w-0 space-y-1">
          {node.variable ? (
            <VariableEditorCard row={node.variable} updateRow={updateRow} removeRow={removeRow} />
          ) : hasChildren ? (
            <div className="rounded-md border border-dashed border-slate-600/60 bg-slate-900/30 px-2 py-1.5">
              <span className="text-[11px] font-medium text-slate-400">{node.segment}</span>
              <span className="block text-[10px] text-slate-600 mt-0.5">Gruppo (nessuna variabile su questo path)</span>
            </div>
          ) : null}
          {hasChildren && expanded && (
            <FlowVariableTreeNodes
              nodes={node.children}
              depth={depth + 1}
              updateRow={updateRow}
              removeRow={removeRow}
            />
          )}
        </div>
      </div>
    </li>
  );
}

export function FlowVariablesRail({ flowId }: FlowVariablesRailProps) {
  const { flows } = useFlowWorkspace();
  const { updateFlowVariables } = useFlowActions();
  const [open, setOpen] = useState(false);

  const variables = flows[flowId]?.meta?.variables ?? [];

  const setVars = useCallback(
    (next: FlowVariableDefinition[]) => {
      updateFlowVariables(flowId, next);
    },
    [flowId, updateFlowVariables]
  );

  const updateRow = useCallback(
    (id: string, patch: Partial<FlowVariableDefinition>) => {
      setVars(variables.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    },
    [variables, setVars]
  );

  const removeRow = useCallback(
    (id: string) => {
      setVars(variables.filter((v) => v.id !== id));
    },
    [variables, setVars]
  );

  const addRow = useCallback(() => {
    setVars([...variables, createEmptyFlowVariable()]);
  }, [variables, setVars]);

  const orphans = useMemo(() => flowVariablesWithoutPath(variables), [variables]);
  const tree = useMemo(() => buildFlowVariableTree(variables), [variables]);

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
        title={open ? 'Chiudi Variables' : 'Apri Variables'}
        aria-expanded={open}
        aria-label="Variables del flow"
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
        className={`fixed right-0 top-0 bottom-0 z-40 flex flex-col
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
          </div>
          <button
            type="button"
            onClick={addRow}
            className="shrink-0 inline-flex items-center gap-1 rounded-md bg-slate-700/80 px-2 py-1 text-xs font-medium text-slate-100 hover:bg-slate-600"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-3">
          <section aria-label="Elenco variabili">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2 px-1">
              Tutte le variabili
            </h3>
            {variables.length === 0 && (
              <p className="text-xs text-slate-500 px-1">
                Nessuna variabile. Usa Add per crearne una; i nomi con punti (es. <code className="text-slate-400">a.b</code>)
                compaiono raggruppati ad albero.
              </p>
            )}

            {orphans.length > 0 && (
              <div className="space-y-2 mb-3">
                <p className="text-[10px] text-amber-500/90 px-1">Senza nome (imposta il label)</p>
                {orphans.map((row) => (
                  <VariableEditorCard key={row.id} row={row} updateRow={updateRow} removeRow={removeRow} />
                ))}
              </div>
            )}

            {tree.length > 0 && (
              <FlowVariableTreeNodes nodes={tree} depth={0} updateRow={updateRow} removeRow={removeRow} />
            )}
          </section>
        </div>
      </div>
    </>
  );
}
