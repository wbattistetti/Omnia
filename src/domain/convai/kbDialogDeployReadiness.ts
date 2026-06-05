/**
 * Validazione design-time: KB pronta per deploy deterministico (omnia_dialog_step).
 */

import {
  parseAgentKnowledgeBaseDocumentsJson,
  resolveAgentKnowledgeBaseDocumentsJson,
} from '@domain/knowledgeBase/serializeKbDocuments';
import {
  canApproveKbDocumentRestructureForRuntime,
  kbDocumentHasUsableRestructure,
  kbDocumentRestructureApprovalIssues,
} from '@domain/knowledgeBase/kbDocumentRestructureHelpers';
import { parseMarkdownPipeTable } from '@domain/knowledgeBase/parseKbTabularText';
import { extractRestructuredDataForRuntime } from '@domain/knowledgeBase/kbDocumentRestructureSplit';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';

export type KbDialogDeployIssue = {
  code: string;
  message: string;
  documentId?: string;
  documentName?: string;
};

function gridFromDoc(doc: StagedKbDocument) {
  const md = extractRestructuredDataForRuntime(String(doc.documentRestructuredMarkdown ?? ''));
  if (!md) return null;
  return parseMarkdownPipeTable(md);
}

function eligibleKbDialogDocuments(docs: StagedKbDocument[]): StagedKbDocument[] {
  return docs.filter(
    (d) =>
      d.documentRestructuredApprovedForRuntime === true &&
      kbDocumentHasUsableRestructure(d) &&
      d.documentSelectorSpec &&
      Array.isArray(d.documentSelectorSpec.columns) &&
      d.documentSelectorSpec.columns.length > 0
  );
}

/** Documenti KB utilizzabili dal runtime omnia_dialog_step. */
export function listKbDocumentsReadyForDialogDeploy(
  agentKnowledgeBaseDocumentsJson: string | undefined | null
): StagedKbDocument[] {
  const docs = parseAgentKnowledgeBaseDocumentsJson(String(agentKnowledgeBaseDocumentsJson ?? ''));
  return eligibleKbDialogDocuments(docs);
}

/** Issue bloccanti per deploy deterministico. Vuoto = pronto. */
export function collectKbDialogDeployIssues(
  agentKnowledgeBaseDocumentsJson: string | undefined | null,
  liveKnowledgeBaseDocuments?: readonly StagedKbDocument[] | null
): KbDialogDeployIssue[] {
  const json = resolveAgentKnowledgeBaseDocumentsJson(
    agentKnowledgeBaseDocumentsJson,
    liveKnowledgeBaseDocuments
  );
  const docs = parseAgentKnowledgeBaseDocumentsJson(json);
  if (docs.length === 0) {
    return [
      {
        code: 'kb_missing',
        message: 'Nessun documento knowledge base sul task agente.',
      },
    ];
  }

  const ready = eligibleKbDialogDocuments(docs);
  if (ready.length > 0) return [];

  const issues: KbDialogDeployIssue[] = [];
  for (const doc of docs) {
    if (!kbDocumentHasUsableRestructure(doc)) {
      issues.push({
        code: 'kb_restructure_missing',
        message: `«${doc.name}»: tabella riformattata non utilizzabile.`,
        documentId: doc.id,
        documentName: doc.name,
      });
      continue;
    }
    if (doc.documentRestructuredApprovedForRuntime !== true) {
      issues.push({
        code: 'kb_not_approved',
        message: `«${doc.name}»: approva la tabella per runtime nella tab Riformattato.`,
        documentId: doc.id,
        documentName: doc.name,
      });
      continue;
    }
    const grid = gridFromDoc(doc);
    const specIssues = kbDocumentRestructureApprovalIssues(doc, grid);
    if (specIssues.length > 0) {
      for (const si of specIssues) {
        issues.push({
          code: `kb_selector_${si.code}`,
          message: `«${doc.name}»: ${si.message}`,
          documentId: doc.id,
          documentName: doc.name,
        });
      }
      continue;
    }
    if (!canApproveKbDocumentRestructureForRuntime(doc, grid)) {
      issues.push({
        code: 'kb_not_ready',
        message: `«${doc.name}»: configurazione selettori non pronta.`,
        documentId: doc.id,
        documentName: doc.name,
      });
    }
  }

  if (issues.length === 0) {
    return [
      {
        code: 'kb_dialog_config_missing',
        message: 'Nessun documento KB approvato con selettori dialogo.',
      },
    ];
  }
  return issues;
}

export function isKbDialogDeployReady(agentKnowledgeBaseDocumentsJson: string | undefined | null): boolean {
  return collectKbDialogDeployIssues(agentKnowledgeBaseDocumentsJson).length === 0;
}
