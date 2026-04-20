/**
 * Pure helpers to present compilation errors in the debugger error list:
 * resolve row/edge labels from workspace flows; UX copy lives in `@domain/compileErrors`.
 */

import type { CompilationError } from '@components/FlowCompiler/types';
import type { Flow } from '@flows/FlowTypes';
import type { Node, Edge } from 'reactflow';
import type { FlowNode, NodeRow } from '@components/Flowchart/types/flowTypes';
import { resolveCompileUxMessage } from '@domain/compileErrors/compileUxMessages';
import { splitFlowPrefixedMessage, withFlowPrefix } from '@utils/flowPrefixedMessage';

const UUID_RE =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:[-_][a-zA-Z0-9]+)?/g;

export { splitFlowPrefixedMessage, withFlowPrefix } from '@utils/flowPrefixedMessage';

export function truncateDisplayLabel(text: string, maxLen = 64): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(1, maxLen - 1))}…`;
}

export function findRowTextInWorkspace(
  flows: Record<string, Flow<Node<FlowNode>, Edge>>,
  error: CompilationError
): string | null {
  const keys = new Set<string>();
  if (error.rowId) keys.add(error.rowId);
  if (error.taskId) keys.add(error.taskId);
  if (keys.size === 0) return null;

  for (const flow of Object.values(flows)) {
    const nodes = flow.nodes ?? [];
    for (const n of nodes) {
      const rows: NodeRow[] = n.data?.rows ?? [];
      for (const row of rows) {
        if (row?.id && keys.has(row.id)) {
          const t = (row.text ?? '').trim();
          return t.length > 0 ? t : null;
        }
      }
    }
  }
  return null;
}

export function findEdgeLabelInWorkspace(
  flows: Record<string, Flow<Node<FlowNode>, Edge>>,
  edgeId: string | undefined
): string | null {
  if (!edgeId?.trim()) return null;
  for (const flow of Object.values(flows)) {
    const edges = flow.edges ?? [];
    for (const e of edges) {
      if (e.id !== edgeId) continue;
      const top = typeof (e as Edge).label === 'string' ? String((e as Edge).label).trim() : '';
      const dataLabel =
        typeof (e as Edge & { data?: { label?: string } }).data?.label === 'string'
          ? String((e as Edge & { data?: { label?: string } }).data?.label).trim()
          : '';
      const pick = top || dataLabel;
      return pick.length > 0 ? pick : null;
    }
  }
  return null;
}

/** @deprecated Prefer `shouldSuppressTechnicalDetailForError` from `@domain/compileErrors`. */
export function isMissingDataContractCompilationError(error: CompilationError): boolean {
  const cat = (error.category ?? '').trim();
  if (cat !== 'TaskCompilationFailed' && cat !== 'CompilationException') return false;
  const { body } = splitFlowPrefixedMessage(error.message);
  return /missing\s+data\s+contract/i.test(body);
}

export function stripNodeRowReferences(message: string): string {
  let m = message;
  m = m.replace(/\s+in\s+node\s+[0-9a-fA-F-]+(?:\s*,\s*row\s+[0-9a-fA-F-]+)?/gi, '');
  m = m.replace(/\s*,\s*row\s+[0-9a-fA-F-]+/gi, '');
  m = m.replace(UUID_RE, '');
  m = m.replace(/\s+/g, ' ').trim();
  m = m.replace(/^[.,;:]\s*|[.,;:]+$/g, '');
  return m;
}

/**
 * User-visible error body for the panel (optional [flowId] prefix when message carries it).
 */
export function formatErrorMessageForReportPanel(
  error: CompilationError,
  _rowText: string | null,
  _edgeLabel: string | null
): string {
  void _rowText;
  void _edgeLabel;
  const ux = resolveCompileUxMessage(error);
  if (!ux) return '';
  const { flowTag } = splitFlowPrefixedMessage(error.message);
  return withFlowPrefix(flowTag, ux);
}

export function formatErrorLocationTitle(
  error: CompilationError,
  rowText: string | null,
  edgeLabel: string | null
): string {
  if (rowText?.trim()) {
    return truncateDisplayLabel(rowText.trim());
  }
  if (error.edgeId) {
    const el = edgeLabel?.trim();
    if (el) return truncateDisplayLabel(el);
    return 'Link';
  }
  if (error.category === 'TaskNotFound' || error.rowId || error.taskId) {
    return 'Unnamed row';
  }
  return 'Issue';
}
