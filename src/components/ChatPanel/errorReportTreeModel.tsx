/**
 * Builds hierarchical data for ErrorReportPanel: flows (roots) → row groups → human issues with FIX targets.
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
import { ensureHexColor } from '@responseEditor/utils/color';
import getIconComponent from '@components/TaskEditor/ResponseEditor/icons';
import {
  splitFlowPrefixedMessage,
  findEdgeLabelInWorkspace,
  stripNodeRowReferences,
} from './errorReportDisplay';
import { compilationErrorFixKey } from '@utils/compilationErrorFix';
import { getDialogueStepUserLabel, ordinalItalianEscalation } from '@utils/dialogueStepUserLabels';

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
  /** Raw compiler errors for this row group (for detail panel). */
  sourceErrors: CompilationError[];
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

/** Visuals for node-level graph issues (e.g. ambiguous outgoing links). */
const NODE_STRUCTURE_VISUALS: RowVisualMeta = {
  Icon: Workflow,
  labelColor: '#0ea5e9',
  iconColor: '#0ea5e9',
};

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
    color: '#0ea5e9',
  };
}

export function humanIssuesForError(
  error: CompilationError,
  rowText: string | null,
  edgeLabel: string | null
): HumanIssueItem[] {
  const cat = (error.category ?? '').trim();
  const bind = (messages: string[]): HumanIssueItem[] =>
    messages.map((message) => ({ message, error }));

  switch (cat) {
    case 'NoEntryNodes':
      return bind(['Il flusso non ha un nodo di start definito.']);
    case 'MultipleEntryNodes':
      return bind([
        'Il flusso ha più nodi di start. Lascia solo quello da cui vuoi iniziare.',
      ]);
    case 'MissingOrInvalidTask':
    case 'TaskNotFound':
    case 'Task not found':
    case 'MissingTaskId': {
      const label =
        (error as { rowLabel?: string }).rowLabel?.trim() || rowText?.trim() || 'questa riga';
      return bind([`Non hai specificato cosa deve fare «${label}».`]);
    }
    case 'TaskTypeInvalidOrMissing':
    case 'MissingTaskType':
    case 'InvalidTaskType': {
      const label =
        (error as { rowLabel?: string }).rowLabel?.trim() || rowText?.trim() || 'questa riga';
      return bind([`Scegli il tipo di task per «${label}».`]);
    }
    case 'TaskCompilationFailed':
    case 'CompilationException':
      return bind([
        'Questo task non può essere eseguito. Aprilo e controlla la configurazione.',
      ]);
    case 'ConditionNotFound':
    case 'ConditionMissingScript':
    case 'ConditionHasNoScript':
    case 'LinkMissingCondition':
    case 'EdgeLabelWithoutCondition':
    case 'EdgeWithoutCondition':
      return bind(['Devi definire una condizione per questo link.']);
    case 'AmbiguousLink': {
      const r = ((error as { reason?: string }).reason || '').trim();
      if (r === 'sameLabel') {
        return bind([
          'Due o più collegamenti in uscita hanno la stessa etichetta: il ramo non è distinguibile.',
        ]);
      }
      if (r === 'sameCondition') {
        return bind([
          'Due o più collegamenti usano la stessa condizione: i rami non sono distinguibili.',
        ]);
      }
      if (r === 'overlappingConditions') {
        return bind([
          'Due o più collegamenti usano la stessa regola: i rami non sono distinguibili.',
        ]);
      }
      return bind(['Devi definire una condizione per questo link.']);
    }
    case 'AmbiguousOutgoingLinks':
      return bind([
        "I link di uscita da questo nodo non sono mutuamente esclusivi: c'è più di un collegamento in uscita e almeno uno non ha una condizione valida. Aggiungi condizioni distinte o un ramo Else.",
      ]);
    case 'AmbiguousDuplicateEdgeLabels':
      return bind([
        'Due o più collegamenti in uscita hanno la stessa etichetta: il ramo non è distinguibile.',
      ]);
    case 'AmbiguousDuplicateConditionScript':
      return bind([
        'Due o più collegamenti condividono la stessa condizione o lo stesso script: i rami non sono distinguibili.',
      ]);
    case 'EmptyEscalation': {
      const stepLabel = getDialogueStepUserLabel(error.stepKey);
      const ordinal = ordinalItalianEscalation(error.escalationIndex);
      return bind([`Manca il messaggio nel ${ordinal} tentativo di: "${stepLabel}".`]);
    }
    default: {
      const { body } = splitFlowPrefixedMessage(error.message);
      const cleaned = stripNodeRowReferences(body);
      if (cleaned.length > 8) {
        return bind([cleaned]);
      }
      return bind(['Correggi il problema indicato dal compilatore.']);
    }
  }
}

export function errorFlowId(error: CompilationError): string {
  const { flowTag } = splitFlowPrefixedMessage(error.message);
  const id = flowTag?.trim();
  return id || 'main';
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

function rowGroupKey(error: CompilationError): string {
  if (error.edgeId) return `edge:${error.edgeId}`;
  const nid = error.nodeId?.trim();
  if (nid) {
    if (error.category === 'AmbiguousLink') {
      const r = ((error as { reason?: string }).reason || '').trim() || 'gen';
      return `node:${nid}:amb:${r}`;
    }
    if (error.category === 'AmbiguousOutgoingLinks') return `node:${nid}:uncond`;
    if (error.category === 'AmbiguousDuplicateEdgeLabels') return `node:${nid}:dupLbl`;
    if (error.category === 'AmbiguousDuplicateConditionScript') return `node:${nid}:dupScr`;
  }
  const n = error.nodeId?.trim() || '';
  const r = (error.rowId || error.taskId || '').trim();
  return `row:${n}::${r}`;
}

function rowTitleForError(
  error: CompilationError,
  row: NodeRow | null,
  edgeLabel: string | null,
  flows: Record<string, Flow<Node<FlowNode>, Edge>>,
  flowId: string
): string {
  if (
    (error.category === 'AmbiguousLink' ||
      error.category === 'AmbiguousOutgoingLinks' ||
      error.category === 'AmbiguousDuplicateEdgeLabels' ||
      error.category === 'AmbiguousDuplicateConditionScript') &&
    error.nodeId
  ) {
    return findNodeDisplayTitleInWorkspace(flows, flowId, error.nodeId) || 'Nodo';
  }
  if (error.edgeId) {
    return edgeLabel?.trim() || 'Collegamento';
  }
  const t = (row?.text ?? '').trim();
  if (t) return t;
  return 'Riga senza nome';
}

/**
 * Build flow roots: `main` is always listed first; other flows from errors; rows grouped with counts.
 */
export function buildErrorReportTree(
  errors: CompilationError[],
  flows: Record<string, Flow<Node<FlowNode>, Edge>>
): FlowIssueRoot[] {
  const byFlow = new Map<string, CompilationError[]>();
  for (const e of errors) {
    const fid = errorFlowId(e);
    const list = byFlow.get(fid) ?? [];
    list.push(e);
    byFlow.set(fid, list);
  }

  const flowIds = new Set<string>(['main', ...byFlow.keys()]);

  const orderedFlowIds = Array.from(flowIds).sort((a, b) => {
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
      const k = rowGroupKey(err);
      const g = rowMap.get(k) ?? [];
      g.push(err);
      rowMap.set(k, g);
    }

    const rows: RowIssueGroup[] = [];
    for (const [, errList] of rowMap) {
      const primary = errList[0];
      const lookup = findRowInWorkspace(flows, flowId, primary);
      const edgeLabel = findEdgeLabelInWorkspace(flows, primary.edgeId);
      const rowTitle = rowTitleForError(primary, lookup.row, edgeLabel, flows, flowId);
      const isEdge = Boolean(primary.edgeId);
      const isNodeAmbiguity =
        primary.category === 'AmbiguousLink' ||
        primary.category === 'AmbiguousOutgoingLinks' ||
        primary.category === 'AmbiguousDuplicateEdgeLabels' ||
        primary.category === 'AmbiguousDuplicateConditionScript';
      const visuals = isNodeAmbiguity ? NODE_STRUCTURE_VISUALS : getErrorRowVisuals(lookup.row, isEdge);

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
        const el = findEdgeLabelInWorkspace(flows, er.edgeId);
        issuesRaw.push(...humanIssuesForError(er, rtText, el));
      }
      const issues = dedupeHumanIssuesByFixKey(issuesRaw);

      rows.push({
        rowKey: rowGroupKey(primary),
        nodeId: primary.nodeId ?? lookup.nodeId,
        rowId: primary.rowId || primary.taskId,
        edgeId: primary.edgeId,
        rowTitle,
        visuals,
        errorCount: ec,
        warningCount: wc,
        hasBlockingError,
        issues,
        sourceErrors: errList,
      });
    }

    rows.sort((a, b) => a.rowTitle.localeCompare(b.rowTitle, 'it', { sensitivity: 'base' }));

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
