/**
 * Sincronizza le note di invalidazione scenario con documenti KB «negative knowledge».
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { isUseCaseInvalidated } from '@types/aiAgentUseCases';
import type { StagedKbDocument } from './kbDocumentTypes';

export const USE_CASE_INVALIDATION_KB_CATEGORY = 'Note di correzione scenari';
export const KB_DOCUMENT_KIND_INVALIDATION = 'invalidated_use_case_note' as const;

function newKbDocumentId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `kb-inv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** True se il documento KB è una nota di invalidazione scenario. */
export function isInvalidationKbDocument(doc: StagedKbDocument): boolean {
  return doc.kbDocumentKind === KB_DOCUMENT_KIND_INVALIDATION;
}

/** Trova il documento KB collegato a uno use case invalidato. */
export function findInvalidationKbDocumentForUseCase(
  documents: readonly StagedKbDocument[],
  useCaseId: string
): StagedKbDocument | undefined {
  const id = String(useCaseId ?? '').trim();
  if (!id) return undefined;
  return documents.find(
    (d) => isInvalidationKbDocument(d) && String(d.linkedUseCaseId ?? '').trim() === id
  );
}

/** Markdown RAG-friendly: documento negativo (cosa evitare). */
export function buildInvalidationKbMarkdown(params: {
  useCaseLabel: string;
  scenarioText: string;
  note: string;
}): string {
  const label = String(params.useCaseLabel ?? '').trim() || 'Scenario';
  const scenario = String(params.scenarioText ?? '').trim();
  const note = String(params.note ?? '').trim();
  const scenarioBlock = scenario ? `\n**Descrizione scenario:** ${scenario}\n` : '';
  return `# Criterio di esclusione — scenario invalidato

**Scenario:** ${label}
${scenarioBlock}
## Perché non è valido (cosa evitare)

${note}

---

Documento di conoscenza negativa (${USE_CASE_INVALIDATION_KB_CATEGORY}): non generare use case simili e rispetta i criteri sopra.`;
}

function resolveScenarioText(useCase: AIAgentUseCase): string {
  return String(
    useCase.payoff || useCase.scenario?.llm || useCase.scenario?.descrittivo || ''
  ).trim();
}

/** Costruisce un documento KB pronto per persistenza e retrieval. */
export function buildInvalidationKbStagedDocument(params: {
  id?: string;
  useCase: AIAgentUseCase;
  note: string;
}): StagedKbDocument {
  const note = String(params.note ?? '').trim();
  if (!note) {
    throw new Error('buildInvalidationKbStagedDocument: note cannot be empty');
  }
  const useCase = params.useCase;
  const id = String(params.id ?? useCase.invalidationKbDocumentId ?? '').trim() || newKbDocumentId();
  const label = String(useCase.label ?? '').trim() || useCase.id;
  const scenarioText = resolveScenarioText(useCase);
  const markdown = buildInvalidationKbMarkdown({
    useCaseLabel: label,
    scenarioText,
    note,
  });
  const name = `${USE_CASE_INVALIDATION_KB_CATEGORY} — ${label.slice(0, 80)}`;
  const now = new Date().toISOString();
  return {
    id,
    name,
    size: note.length,
    mimeType: 'text/markdown',
    addedAt: now,
    file: new File([], name, { type: 'text/markdown' }),
    parseStatus: 'ready',
    variables: [],
    variableDictionary: {},
    howToUseText: `Documento negativo: scenario use case invalidato. Categoria: ${USE_CASE_INVALIDATION_KB_CATEGORY}. Usare in fase Prompts per evitare scenari simili.`,
    markdownSnippet: markdown,
    documentAnalysisMarkdown: markdown,
    agentAnalysisBaselineMarkdown: markdown,
    kbDocumentKind: KB_DOCUMENT_KIND_INVALIDATION,
    linkedUseCaseId: useCase.id,
  };
}

/** Inserisce o aggiorna la nota KB per uno use case invalidato. */
export function upsertInvalidationKbInDocuments(
  documents: readonly StagedKbDocument[],
  params: { useCase: AIAgentUseCase; note: string }
): { documents: StagedKbDocument[]; docId: string } {
  const note = String(params.note ?? '').trim();
  if (!note) {
    throw new Error('upsertInvalidationKbInDocuments: note cannot be empty');
  }
  if (!isUseCaseInvalidated(params.useCase)) {
    throw new Error('upsertInvalidationKbInDocuments: use case is not invalidated');
  }
  const existing = findInvalidationKbDocumentForUseCase(documents, params.useCase.id);
  const docId =
    String(params.useCase.invalidationKbDocumentId ?? existing?.id ?? '').trim() ||
    newKbDocumentId();
  const staged = buildInvalidationKbStagedDocument({
    id: docId,
    useCase: params.useCase,
    note,
  });
  const withoutDupes = documents.filter(
    (d) =>
      !(
        isInvalidationKbDocument(d) &&
        String(d.linkedUseCaseId ?? '').trim() === params.useCase.id &&
        d.id !== docId
      )
  );
  const hasDoc = withoutDupes.some((d) => d.id === docId);
  return {
    documents: hasDoc
      ? withoutDupes.map((d) => (d.id === docId ? staged : d))
      : [...withoutDupes, staged],
    docId,
  };
}

/** Rimuove tutti i documenti KB di invalidazione collegati a uno use case. */
export function removeInvalidationKbFromDocuments(
  documents: readonly StagedKbDocument[],
  useCaseId: string
): StagedKbDocument[] {
  const id = String(useCaseId ?? '').trim();
  if (!id) return [...documents];
  return documents.filter(
    (d) => !(isInvalidationKbDocument(d) && String(d.linkedUseCaseId ?? '').trim() === id)
  );
}

/** Documenti KB utilizzabili nel contesto generatore use case (upload + note invalidazione). */
export function kbDocumentsEligibleForUseCaseContext(
  docs: readonly StagedKbDocument[]
): readonly StagedKbDocument[] {
  return docs.filter((d) => {
    if (d.parseStatus !== 'ready') return false;
    if (isInvalidationKbDocument(d)) {
      return Boolean(String(d.documentAnalysisMarkdown ?? d.markdownSnippet ?? '').trim());
    }
    return Boolean(String(d.repositoryDocumentId ?? '').trim());
  });
}
