/**
 * Sintesi analisi backend per contesto generazione use case / prompt designer.
 */

import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import { readAgentBackendAnalysisBundle } from './agentBackendAnalysisBundle';
import type { BackendAnalysisDocumentV2 } from './backendAnalysisDocumentV2';
import { markdownToBackendAnalysisV2 } from './migrateToBackendAnalysisV2';
import { taskRepository } from '@services/TaskRepository';

const PER_BACKEND_HOW_TO_MAX = 600;
const PROPOSED_SPEC_MAX = 400;

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Costruisce blocco markdown sintetico da documento V2. */
export function synthesizeBackendAnalysisFromDocument(
  doc: BackendAnalysisDocumentV2
): string {
  const parts: string[] = [];

  const systemPrompt = doc.global.agentSystemPromptMarkdown.trim();
  if (systemPrompt) {
    parts.push('### System prompt operativo (runtime)', '', clip(systemPrompt, 2_000), '');
  }

  const backends = Object.values(doc.backends);
  if (backends.length > 0) {
    parts.push('### Backend in catalogo', '');
    for (const b of backends) {
      const howTo = b.howToUseMarkdown.trim();
      if (!howTo) continue;
      parts.push(`#### ${b.displayLabel}`, clip(howTo, PER_BACKEND_HOW_TO_MAX), '');
    }
  }

  const proposed = doc.global.proposedBackends;
  if (proposed.length > 0) {
    parts.push('### Backend da aggiungere (gap catalogo)', '');
    for (const p of proposed) {
      const purpose = p.purposeMarkdown?.trim() || p.specMarkdown.trim();
      parts.push(
        `- **${p.suggestedName}**: ${clip(purpose, PROPOSED_SPEC_MAX) || 'vedi specifica in analisi'}`
      );
    }
    parts.push('');
  }

  return parts.join('\n').trim();
}

/**
 * Legge analisi backend persistita per agente e restituisce sintesi (vuota se assente).
 */
export function buildBackendAnalysisContextBlock(
  catalog: ProjectBackendCatalogBlob | undefined,
  agentTaskId: string
): string {
  const id = String(agentTaskId ?? '').trim();
  if (!id || !catalog) return '';

  const bundle = readAgentBackendAnalysisBundle(catalog, id);
  const baseline = bundle.agentAnalysisBaselineMarkdown.trim();
  const markdown = bundle.analysisMarkdown.trim();

  if (!baseline && !markdown) return '';

  let doc = bundle.analysisDocument;
  if (!doc || Object.keys(doc.backends).length === 0) {
    if (!markdown) return '';
    const manual = catalog.manualEntries ?? [];
    doc = markdownToBackendAnalysisV2(markdown, manual, taskRepository.getAllTasks());
  }

  const synthesis = synthesizeBackendAnalysisFromDocument(doc);
  if (!synthesis) return '';

  return synthesis;
}
