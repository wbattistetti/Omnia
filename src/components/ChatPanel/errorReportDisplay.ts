/**
 * Pure helpers to present compilation errors in ErrorReportPanel:
 * resolve row/edge labels from workspace flows and rewrite technical messages.
 */

import type { CompilationError } from '@components/FlowCompiler/types';
import type { Flow } from '@flows/FlowTypes';
import type { Node, Edge } from 'reactflow';
import type { FlowNode, NodeRow } from '@components/Flowchart/types/flowTypes';

const UUID_RE =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:[-_][a-zA-Z0-9]+)?/g;

export function truncateDisplayLabel(text: string, maxLen = 64): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(1, maxLen - 1))}…`;
}

/** Split optional `[flowId] message` prefix from merged multi-flow compile errors. */
export function splitFlowPrefixedMessage(message: string): { flowTag: string | null; body: string } {
  const m = message.match(/^\[([^\]]+)]\s*(.*)$/s);
  if (m) {
    return { flowTag: m[1].trim() || null, body: m[2] ?? '' };
  }
  return { flowTag: null, body: message };
}

function withFlowPrefix(flowTag: string | null, body: string): string {
  if (!flowTag) return body;
  return `[${flowTag}] ${body}`;
}

/**
 * Finds row display text (NodeRow.text) across all open flows for this error.
 */
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

/**
 * Best-effort edge label for error cards (React Flow edge id + optional label).
 */
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

/**
 * Strip "in node …, row …" / UUID-heavy tails from backend compiler messages.
 */
/**
 * Utterance/listen senza contratto NLP: il compilatore VB segnala "Missing data contract (leaf node)."
 * Messaggio unico per l'utente; il testo grezzo non va mostrato nel pannello tecnico.
 */
export function isMissingDataContractCompilationError(error: CompilationError): boolean {
  const cat = (error.category ?? '').trim();
  if (cat !== 'TaskCompilationFailed' && cat !== 'CompilationException') return false;
  const { body } = splitFlowPrefixedMessage(error.message);
  return /missing\s+data\s+contract/i.test(body);
}

export function humanMessageForTaskCompilationFailure(error: CompilationError): string {
  if (isMissingDataContractCompilationError(error)) {
    return "Manca il parser per interpretare le risposte dell'utente.";
  }
  return 'Questo task non può essere eseguito. Aprilo e controlla la configurazione.';
}

/** Errori da mostrare nel blocco "dettagli tecnici" (esclusi quelli già coperti dal messaggio umano sopra). */
export function compilationErrorsForTechnicalDetailPanel(errors: CompilationError[]): CompilationError[] {
  return errors.filter((e) => !isMissingDataContractCompilationError(e));
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
 * User-visible error body for the panel (keeps optional [flowId] prefix).
 */
export function formatErrorMessageForReportPanel(
  error: CompilationError,
  rowText: string | null,
  edgeLabel: string | null
): string {
  const { flowTag, body } = splitFlowPrefixedMessage(error.message);
  const cat = error.category ?? '';
  const rowLabel = (error as { rowLabel?: string }).rowLabel?.trim();

  if (cat === 'MissingOrInvalidTask' || cat === 'TaskNotFound' || cat === 'MissingTaskId') {
    const label = rowLabel || rowText?.trim() || 'questa riga';
    return withFlowPrefix(
      flowTag,
      `Non hai specificato cosa deve fare «${truncateDisplayLabel(label, 200)}».`
    );
  }

  if (cat === 'TaskTypeInvalidOrMissing' || cat === 'MissingTaskType' || cat === 'InvalidTaskType') {
    const label = rowLabel || rowText?.trim() || 'questa riga';
    return withFlowPrefix(flowTag, `Scegli il tipo di task per «${truncateDisplayLabel(label, 200)}».`);
  }

  if (cat === 'TaskCompilationFailed' || cat === 'CompilationException') {
    return withFlowPrefix(flowTag, humanMessageForTaskCompilationFailure(error));
  }

  if (cat === 'NoEntryNodes') {
    return withFlowPrefix(flowTag, 'Il flusso non ha un nodo di start definito.');
  }

  if (cat === 'MultipleEntryNodes') {
    return withFlowPrefix(
      flowTag,
      'Il flusso ha più nodi di start. Lascia solo quello da cui vuoi iniziare.'
    );
  }

  let out = body;

  out = stripNodeRowReferences(out);
  if (!out || out.length < 4) {
    out = cat || 'Compilation issue';
  }

  return withFlowPrefix(flowTag, out);
}

/**
 * Bold title line for an error card: row label, edge label, or neutral fallback (no node id).
 */
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
