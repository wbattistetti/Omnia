/**
 * Builds hierarchical data for the flow debugger error list: flows → row groups → UX issues + FIX targets.
 */

import React, { type ComponentType, type CSSProperties } from 'react';
import { HelpCircle, Workflow } from 'lucide-react';
import type { CompilationError } from '@components/FlowCompiler/types';
import type { Flow } from '@flows/FlowTypes';
import type { Node, Edge } from 'reactflow';
import type { FlowNode, NodeRow } from '@components/Flowchart/types/flowTypes';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import { getTaskIdFromRow } from '@utils/taskHelpers';
import { normalizeSeverity } from '@utils/severityUtils';
import {
  getTaskVisuals,
  hasTaskTree,
  resolveTaskType,
} from '@components/Flowchart/utils/taskVisuals';
import { getFlowchartTaskTypeLabelColor } from '@components/Flowchart/utils/flowchartTaskTypeColors';
import { ensureHexColor } from '@responseEditor/utils/color';
import getIconComponent from '@components/TaskEditor/ResponseEditor/icons';
import { splitFlowPrefixedMessage } from './errorReportDisplay';
import { isCompileErrorReportUxCode, resolveCompileUxMessage } from '@domain/compileErrors/compileUxMessages';
import { compilationErrorFixKey } from '@utils/compilationErrorFix';

export type FlowVisualMeta = {
  Icon: ComponentType<{ className?: string; style?: CSSProperties; size?: number }>;
  color: string;
};

export type RowVisualMeta = {
  Icon: ComponentType<{ className?: string; style?: CSSProperties; size?: number }>;
  labelColor: string;
  iconColor: string;
};

export type HumanIssueItem = {
  message: string;
  error: CompilationError;
};

export type RowIssueGroup = {
  rowKey: string;
  nodeId?: string;
  rowId?: string;
  edgeId?: string;
  rowTitle: string;
  visuals: RowVisualMeta;
  errorCount: number;
  warningCount: number;
  hasBlockingError: boolean;
  issues: HumanIssueItem[];
};

export type FlowIssueRoot = {
  flowId: string;
  displayTitle: string;
  flowVisuals: FlowVisualMeta;
  errorCount: number;
  warningCount: number;
  rows: RowIssueGroup[];
};

function flowDisplayTitle(flowId: string, flows: Record<string, Flow<Node<FlowNode>, Edge>>): string {
  if (flowId === 'main') return 'MAIN';
  const t = flows[flowId]?.title?.trim();
  if (t) return `SUBFLOW: ${t}`;
  return `SUBFLOW: ${flowId}`;
}

/**
 * Node title for error cards: canvas label, else last row text (same rule as VB GetNodeUserDisplayLabel).
 */
export function findNodeDisplayTitleInWorkspace(
  flows: Record<string, Flow<Node<FlowNode>, Edge>>,
  flowId: string,
  nodeId: string | undefined
): string | null {
  if (!nodeId?.trim()) return null;
  const scan = (fid: string): string | null => {
    const flow = flows[fid];
    const nodes = flow?.nodes ?? [];
    const n = nodes.find((x) => x.id === nodeId);
    const data = n?.data;
    if (!data) return null;
    const label = String(data.label ?? '').trim();
    if (label) return label;
    const rows = data.rows ?? [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const t = (rows[i]?.text ?? '').trim();
      if (t) return t;
    }
    return null;
  };
  const primary = scan(flowId);
  if (primary) return primary;
  for (const fid of Object.keys(flows)) {
    if (fid === flowId) continue;
    const hit = scan(fid);
    if (hit) return hit;
  }
  return null;
}

/**
 * Row / edge visuals aligned with NodeRow (task type, heuristics, custom icon/color).
 */
export function getErrorRowVisuals(row: NodeRow | null, isEdgeFallback: boolean): RowVisualMeta {
  if (isEdgeFallback || !row) {
    return {
      Icon: Workflow,
      labelColor: '#f59e0b',
      iconColor: '#f59e0b',
    };
  }

  const isUndefined = (row as NodeRow & { isUndefined?: boolean }).isUndefined === true;
  const taskId = getTaskIdFromRow(row as Parameters<typeof getTaskIdFromRow>[0]);

  let Icon: ComponentType<any> = HelpCircle;
  let labelTextColor = '#94a3b8';
  let iconColor = '#94a3b8';

  if (taskId) {
    try {
      const task = taskRepository.getTask(taskId);
      if (task) {
        if (task.type !== undefined && task.type !== null && task.type !== TaskType.UNDEFINED) {
          if (task.icon || task.color) {
            const iconName = task.icon || task.iconName || 'Tag';
            const taskColor = task.color ? ensureHexColor(task.color) : '#94a3b8';
            Icon = isUndefined
              ? HelpCircle
              : function CustomTaskIcon(props: Record<string, unknown>) {
                  const { className, style, ...rest } = props as {
                    className?: string;
                    style?: CSSProperties;
                  };
                  return (
                    <span className={className} style={style} {...rest}>
                      {getIconComponent(iconName, taskColor)}
                    </span>
                  );
                };
            labelTextColor = isUndefined ? '#94a3b8' : taskColor;
            iconColor = isUndefined ? '#94a3b8' : taskColor;
          } else {
            const taskCategory = task.category || (row as { heuristics?: { inferredCategory?: string } }).heuristics?.inferredCategory || null;
            const visuals = getTaskVisuals(
              task.type,
              taskCategory,
              task.categoryCustom,
              hasTaskTree(row)
            );
            Icon = isUndefined ? HelpCircle : visuals.Icon;
            labelTextColor = isUndefined ? '#94a3b8' : visuals.labelColor;
            iconColor = isUndefined ? '#94a3b8' : visuals.iconColor;
          }
        } else {
          Icon = HelpCircle;
          labelTextColor = '#94a3b8';
          iconColor = '#94a3b8';
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (Icon === HelpCircle && !isUndefined) {
    const resolvedType = resolveTaskType(row);
    if (resolvedType !== TaskType.UNDEFINED) {
      const rowCategory = (row as { heuristics?: { inferredCategory?: string } }).heuristics?.inferredCategory || null;
      const visuals = getTaskVisuals(resolvedType, rowCategory, null, hasTaskTree(row));
      Icon = visuals.Icon;
      labelTextColor = visuals.labelColor;
      iconColor = visuals.iconColor;
    }
  }

  return { Icon, labelColor: labelTextColor, iconColor };
}

export function getFlowRootVisuals(_flowId: string): FlowVisualMeta {
  return {
    Icon: Workflow,
    color: getFlowchartTaskTypeLabelColor(TaskType.Subflow),
  };
}

export function humanIssuesForError(
  error: CompilationError,
  _rowText: string | null,
  _edgeLabel: string | null
): HumanIssueItem[] {
  void _rowText;
  void _edgeLabel;
  const message = resolveCompileUxMessage(error);
  if (!message) return [];
  return [{ message, error }];
}

/** Flow canvas id for grouping: `[flow]` prefix on message, else workspace lookup by row/task id. */
export function errorFlowId(error: CompilationError): string {
  const { flowTag } = splitFlowPrefixedMessage(error.message);
  const id = flowTag?.trim();
  return id || 'main';
}

/**
 * Resolves flow id when compiler leaves `message` empty (code-only contract).
 */
export function inferCompilationErrorFlowId(
  flows: Record<string, Flow<Node<FlowNode>, Edge>>,
  error: CompilationError
): string {
  const fromMsg = splitFlowPrefixedMessage(error.message).flowTag?.trim();
  if (fromMsg) return fromMsg;
  const keys = new Set<string>();
  if (error.rowId?.trim()) keys.add(error.rowId.trim());
  if (error.taskId?.trim()) keys.add(error.taskId.trim());
  for (const fid of Object.keys(flows)) {
    const flow = flows[fid];
    for (const n of flow?.nodes ?? []) {
      for (const row of n.data?.rows ?? []) {
        if (row?.id && keys.has(row.id)) return fid;
      }
    }
  }
  return 'main';
}

export function errorMessageWithoutFlowPrefix(error: CompilationError): string {
  const { body } = splitFlowPrefixedMessage(error.message);
  return body.trim();
}

/**
 * Collapses duplicate human lines when message and Fix target are identical (e.g. same link, same copy).
 */
export function dedupeHumanIssuesByFixKey(issues: HumanIssueItem[]): HumanIssueItem[] {
  const seen = new Set<string>();
  const out: HumanIssueItem[] = [];
  for (const item of issues) {
    const key = `${item.message}\0${compilationErrorFixKey(item.error)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export type RowLookup = {
  row: NodeRow | null;
  nodeId?: string;
};

/**
 * Find row + node in a specific flow; fallback search all flows if missing in target.
 */
export function findRowInWorkspace(
  flows: Record<string, Flow<Node<FlowNode>, Edge>>,
  flowId: string,
  error: CompilationError
): RowLookup {
  const keys = new Set<string>();
  if (error.rowId) keys.add(error.rowId);
  if (error.taskId) keys.add(error.taskId);
  const tryFlow = (fid: string): RowLookup | null => {
    const flow = flows[fid];
    if (!flow?.nodes?.length) return null;
    for (const n of flow.nodes) {
      const rows: NodeRow[] = n.data?.rows ?? [];
      for (const row of rows) {
        if (row?.id && keys.has(row.id)) {
          return { row, nodeId: n.id };
        }
      }
    }
    return null;
  };

  const primary = tryFlow(flowId);
  if (primary) return primary;
  for (const fid of Object.keys(flows)) {
    if (fid === flowId) continue;
    const hit = tryFlow(fid);
    if (hit) return hit;
  }
  return { row: null, nodeId: error.nodeId };
}

/**
 * Canvas node id for UX grouping and titles: resolve from workspace by row/task first.
 * Compiler `nodeId` is only a fallback when the row cannot be found in `flows`.
 */
export function resolveUxNodeIdForError(
  flows: Record<string, Flow<Node<FlowNode>, Edge>>,
  flowId: string,
  error: CompilationError
): string | undefined {
  const lookup = findRowInWorkspace(flows, flowId, error);
  const fromCanvas = lookup.row != null ? lookup.nodeId?.trim() : undefined;
  if (fromCanvas) return fromCanvas;
  const fallback = lookup.nodeId?.trim() || error.nodeId?.trim();
  return fallback || undefined;
}

/**
 * Stable group key: flow + canvas row identity. Multiple rows on the same FlowNode are distinct tasks.
 * Falls back to node id only when the row cannot be resolved (legacy payloads).
 */
export function uxReportGroupKey(
  flows: Record<string, Flow<Node<FlowNode>, Edge>>,
  flowId: string,
  error: CompilationError
): string {
  const lookup = findRowInWorkspace(flows, flowId, error);
  const rowId = (lookup.row?.id ?? error.rowId ?? error.taskId ?? '').trim();
  if (rowId) return `${flowId}::row::${rowId}`;
  const derived = resolveUxNodeIdForError(flows, flowId, error);
  if (derived) return `${flowId}::uxnode::${derived}`;
  return `${flowId}::unknown`;
}

/**
 * DOM/card key aligned with {@link DebuggerErrorList}: `{flowId}::{uxReportGroupKey}` per row card.
 */
export function debuggerErrorListRowCardDomKey(
  flows: Record<string, Flow<Node<FlowNode>, Edge>>,
  flowId: string,
  rowId: string | undefined
): string | null {
  const rid = (rowId ?? '').trim();
  if (!rid) return null;
  const synthetic: CompilationError = {
    taskId: rid,
    rowId: rid,
    message: '',
    severity: 'error',
    fixTarget: { type: 'task', taskId: rid },
  };
  const gk = uxReportGroupKey(flows, flowId, synthetic);
  return `${flowId}::${gk}`;
}

/**
 * Flatten order of rows on the canvas: `flow.nodes` order, then each node's `rows` order.
 * Missing ids sort last so unknown rows stay stable behind canvas-known rows.
 */
export function canvasRowOrderRankInFlow(
  flows: Record<string, Flow<Node<FlowNode>, Edge>>,
  flowId: string,
  rowId: string | undefined
): number {
  const rid = (rowId ?? '').trim();
  if (!rid) return Number.MAX_SAFE_INTEGER - 2;
  const flow = flows[flowId];
  let rank = 0;
  for (const n of flow?.nodes ?? []) {
    for (const row of n.data?.rows ?? []) {
      if (row?.id === rid) return rank;
      rank += 1;
    }
  }
  return Number.MAX_SAFE_INTEGER - 1;
}

/** Card title for a row-level error: backend rowLabel, row text, then node label heuristic. */
function rowTitleForUxCard(
  error: CompilationError,
  flows: Record<string, Flow<Node<FlowNode>, Edge>>,
  flowId: string
): string {
  const rowLab = ((error as { rowLabel?: string }).rowLabel ?? '').trim();
  if (rowLab) return rowLab;
  const lookup = findRowInWorkspace(flows, flowId, error);
  const rowText = (lookup.row?.text ?? '').trim();
  if (rowText) return rowText;
  const derived = resolveUxNodeIdForError(flows, flowId, error);
  if (derived) return findNodeDisplayTitleInWorkspace(flows, flowId, derived) || 'Riga';
  return 'Riga';
}

/**
 * Build flow roots: `main` is always listed first; other flows from errors; rows grouped with counts.
 */
export function buildErrorReportTree(
  errors: CompilationError[],
  flows: Record<string, Flow<Node<FlowNode>, Edge>>
): FlowIssueRoot[] {
  const visible = errors.filter((e) => isCompileErrorReportUxCode(e.code));
  const byFlow = new Map<string, CompilationError[]>();
  for (const e of visible) {
    const fid = inferCompilationErrorFlowId(flows, e);
    const list = byFlow.get(fid) ?? [];
    list.push(e);
    byFlow.set(fid, list);
  }

  const orderedFlowIds = Array.from(byFlow.keys()).sort((a, b) => {
    if (a === 'main') return -1;
    if (b === 'main') return 1;
    return flowDisplayTitle(a, flows).localeCompare(flowDisplayTitle(b, flows), 'it', { sensitivity: 'base' });
  });

  const roots: FlowIssueRoot[] = [];

  for (const flowId of orderedFlowIds) {
    const list = byFlow.get(flowId) ?? [];
    const errorCount = list.filter((x) => normalizeSeverity(x.severity) === 'error').length;
    const warningCount = list.filter((x) => normalizeSeverity(x.severity) === 'warning').length;

    const rowMap = new Map<string, CompilationError[]>();
    for (const err of list) {
      const k = uxReportGroupKey(flows, flowId, err);
      const g = rowMap.get(k) ?? [];
      g.push(err);
      rowMap.set(k, g);
    }

    const rows: RowIssueGroup[] = [];
    for (const [, errList] of rowMap) {
      const primary = errList[0];
      const lookup = findRowInWorkspace(flows, flowId, primary);
      const derivedNodeId = resolveUxNodeIdForError(flows, flowId, primary);
      const rowTitle = rowTitleForUxCard(primary, flows, flowId);
      const visuals = getErrorRowVisuals(lookup.row, false);

      let ec = 0;
      let wc = 0;
      for (const er of errList) {
        if (normalizeSeverity(er.severity) === 'error') ec += 1;
        else if (normalizeSeverity(er.severity) === 'warning') wc += 1;
      }
      const hasBlockingError = ec > 0;

      const issuesRaw: HumanIssueItem[] = [];
      for (const er of errList) {
        const hit = findRowInWorkspace(flows, flowId, er);
        const rtText = (hit.row?.text ?? '').trim() ? hit.row!.text!.trim() : null;
        issuesRaw.push(...humanIssuesForError(er, rtText, null));
      }
      const issues = dedupeHumanIssuesByFixKey(issuesRaw);

      rows.push({
        rowKey: uxReportGroupKey(flows, flowId, primary),
        nodeId: derivedNodeId ?? primary.nodeId ?? lookup.nodeId,
        rowId: primary.rowId || primary.taskId,
        edgeId: primary.edgeId,
        rowTitle,
        visuals,
        errorCount: ec,
        warningCount: wc,
        hasBlockingError,
        issues,
      });
    }

    rows.sort((a, b) => {
      const ra = canvasRowOrderRankInFlow(flows, flowId, a.rowId);
      const rb = canvasRowOrderRankInFlow(flows, flowId, b.rowId);
      if (ra !== rb) return ra - rb;
      return a.rowTitle.localeCompare(b.rowTitle, 'it', { sensitivity: 'base' });
    });

    roots.push({
      flowId,
      displayTitle: flowDisplayTitle(flowId, flows),
      flowVisuals: getFlowRootVisuals(flowId),
      errorCount,
      warningCount,
      rows,
    });
  }

  return roots;
}
