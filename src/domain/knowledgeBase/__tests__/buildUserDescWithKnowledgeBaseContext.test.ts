import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildUserDescWithKnowledgeBaseContext,
  kbDocumentsEligibleForUseCaseContext,
} from '../buildUserDescWithKnowledgeBaseContext';
import type { StagedKbDocument } from '../kbDocumentTypes';

vi.mock('@services/kbDocumentRepositoryApi', () => ({
  fetchKbDocumentContent: vi.fn(),
}));

import { fetchKbDocumentContent } from '@services/kbDocumentRepositoryApi';

function stubDoc(overrides: Partial<StagedKbDocument> = {}): StagedKbDocument {
  return {
    id: 'd1',
    name: 'KB_test.md',
    size: 100,
    mimeType: 'text/markdown',
    addedAt: '2026-01-01',
    file: new File(['x'], 'KB_test.md'),
    parseStatus: 'ready',
    repositoryDocumentId: 'repo-1',
    variables: [],
    variableDictionary: {},
    howToUseText: '',
    markdownSnippet: '',
    documentAnalysisMarkdown: '',
    agentAnalysisBaselineMarkdown: '',
    documentRestructuredMarkdown: '',
    agentRestructuredBaselineMarkdown: '',
    documentRestructureNotesMarkdown: '',
    agentRestructureNotesBaselineMarkdown: '',
    ...overrides,
  };
}

describe('kbDocumentsEligibleForUseCaseContext', () => {
  it('includes ready upload docs with repository id and invalidation notes', () => {
    const docs = [
      stubDoc(),
      stubDoc({ id: 'd2', parseStatus: 'parsing', repositoryDocumentId: 'r2' }),
      stubDoc({ id: 'd3', repositoryDocumentId: '' }),
      stubDoc({
        id: 'd4',
        kbDocumentKind: 'invalidated_use_case_note',
        linkedUseCaseId: 'uc-1',
        documentAnalysisMarkdown: '# neg',
        repositoryDocumentId: undefined,
      }),
    ];
    expect(kbDocumentsEligibleForUseCaseContext(docs)).toHaveLength(2);
  });
});

describe('buildUserDescWithKnowledgeBaseContext', () => {
  beforeEach(() => {
    vi.mocked(fetchKbDocumentContent).mockReset();
  });

  it('appends KB section when content is fetched', async () => {
    vi.mocked(fetchKbDocumentContent).mockResolvedValue({
      success: true,
      meta: {} as never,
      text: '# Regole\n- item',
      truncated: false,
      totalChars: 20,
    });

    const { userDesc, kbDocCount } = await buildUserDescWithKnowledgeBaseContext({
      projectId: 'proj-1',
      baseUserDesc: 'Descrizione task lunga abbastanza per il test.',
      documents: [stubDoc()],
    });

    expect(kbDocCount).toBe(1);
    expect(userDesc).toContain('analisi documenti');
    expect(userDesc).toContain('KB_test.md');
    expect(userDesc).toContain('# Regole');
    expect(userDesc).toContain('testo grezzo');
  });

  it('prefers document analysis over repository fetch when baseline exists', async () => {
    const analysis = [
      '## Type: MIXED',
      '',
      '### Regole di dialogo',
      '- Chiedere branca. — Fonte: «visita cardiologica»',
    ].join('\n');

    const { userDesc, kbWarnings } = await buildUserDescWithKnowledgeBaseContext({
      projectId: 'proj-1',
      baseUserDesc: 'Descrizione task.',
      documents: [
        stubDoc({
          documentAnalysisMarkdown: analysis,
          agentAnalysisBaselineMarkdown: analysis,
        }),
      ],
    });

    expect(fetchKbDocumentContent).not.toHaveBeenCalled();
    expect(userDesc).toContain('sintesi analisi documento');
    expect(userDesc).toContain('Regole di dialogo');
    expect(kbWarnings.some((w) => w.includes('grezzo'))).toBe(false);
  });

  it('returns base only without projectId for upload docs', async () => {
    const base = 'Solo descrizione senza progetto collegato.';
    const { userDesc, kbDocCount } = await buildUserDescWithKnowledgeBaseContext({
      projectId: undefined,
      baseUserDesc: base,
      documents: [stubDoc()],
    });
    expect(kbDocCount).toBe(0);
    expect(userDesc).toBe(base);
    expect(fetchKbDocumentContent).not.toHaveBeenCalled();
  });

  it('includes invalidation KB docs even without projectId', async () => {
    const base = 'Descrizione task.';
    const { userDesc, kbDocCount } = await buildUserDescWithKnowledgeBaseContext({
      projectId: undefined,
      baseUserDesc: base,
      documents: [
        stubDoc({
          id: 'inv-1',
          name: 'Note di correzione scenari — test',
          kbDocumentKind: 'invalidated_use_case_note',
          linkedUseCaseId: 'uc-1',
          documentAnalysisMarkdown: '# Criterio di esclusione',
          repositoryDocumentId: undefined,
        }),
      ],
    });
    expect(kbDocCount).toBe(1);
    expect(userDesc).toContain('KNOWLEDGE BASE');
    expect(userDesc).toContain('Criterio di esclusione');
    expect(fetchKbDocumentContent).not.toHaveBeenCalled();
  });
});
