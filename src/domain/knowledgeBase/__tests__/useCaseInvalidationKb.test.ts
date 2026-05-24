import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { StagedKbDocument } from '../kbDocumentTypes';
import {
  buildInvalidationKbMarkdown,
  findInvalidationKbDocumentForUseCase,
  isInvalidationKbDocument,
  kbDocumentsEligibleForUseCaseContext,
  removeInvalidationKbFromDocuments,
  upsertInvalidationKbInDocuments,
} from '../useCaseInvalidationKb';

function minimalUseCase(id: string): AIAgentUseCase {
  return {
    id,
    label: 'Prenotazione tavolo',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: 'Cliente chiede un tavolo fuori orario',
    dialogue: [{ turn_id: 't1', role: 'assistant', content: 'x' }],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
    designer_label_vote: 'down',
  };
}

function stubInvalidationDoc(useCaseId: string, id = 'kb-1'): StagedKbDocument {
  return {
    id,
    name: 'Note di correzione scenari — test',
    size: 10,
    mimeType: 'text/markdown',
    addedAt: '2026-01-01',
    file: new File(['x'], 'note.md'),
    parseStatus: 'ready',
    variables: [],
    variableDictionary: {},
    howToUseText: '',
    markdownSnippet: '# neg',
    documentAnalysisMarkdown: '# neg',
    agentAnalysisBaselineMarkdown: '# neg',
    kbDocumentKind: 'invalidated_use_case_note',
    linkedUseCaseId: useCaseId,
  };
}

describe('useCaseInvalidationKb', () => {
  it('buildInvalidationKbMarkdown includes negative knowledge framing', () => {
    const md = buildInvalidationKbMarkdown({
      useCaseLabel: 'Scenario A',
      scenarioText: 'Dettaglio scenario',
      note: 'Non copre il caso limite X',
    });
    expect(md).toContain('cosa evitare');
    expect(md).toContain('Non copre il caso limite X');
  });

  it('upserts one KB document per invalidated use case', () => {
    const uc = minimalUseCase('uc-1');
    const first = upsertInvalidationKbInDocuments([], { useCase: uc, note: 'Prima nota' });
    expect(first.documents).toHaveLength(1);
    expect(isInvalidationKbDocument(first.documents[0])).toBe(true);
    expect(first.documents[0].linkedUseCaseId).toBe('uc-1');

    const second = upsertInvalidationKbInDocuments(first.documents, {
      useCase: { ...uc, invalidationKbDocumentId: first.docId },
      note: 'Nota aggiornata',
    });
    expect(second.documents).toHaveLength(1);
    expect(second.documents[0].documentAnalysisMarkdown).toContain('Nota aggiornata');
  });

  it('removeInvalidationKbFromDocuments drops linked docs only', () => {
    const docs = [
      stubInvalidationDoc('uc-1', 'a'),
      stubInvalidationDoc('uc-2', 'b'),
    ];
    const next = removeInvalidationKbFromDocuments(docs, 'uc-1');
    expect(next).toHaveLength(1);
    expect(findInvalidationKbDocumentForUseCase(next, 'uc-2')?.id).toBe('b');
  });

  it('kbDocumentsEligibleForUseCaseContext includes invalidation docs without repository id', () => {
    const docs = [
      stubInvalidationDoc('uc-1'),
      {
        ...stubInvalidationDoc('uc-2', 'upload-1'),
        kbDocumentKind: 'upload',
        linkedUseCaseId: undefined,
        repositoryDocumentId: 'repo-1',
      },
    ];
    expect(kbDocumentsEligibleForUseCaseContext(docs)).toHaveLength(2);
  });
});
