import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  computeRuntimeDistillSourceHash,
  resolveKbRuntimeDistillText,
} from '../analysisRuntimeDistill';
import { distillKbDocumentAnalysisForRuntime } from '@domain/knowledgeBase/kbAnalysisRuntimeSynthesis';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';

vi.mock('../analysisRuntimeDistillApi', () => ({
  distillKbDocumentAnalysisRuntime: vi.fn(),
  distillBackendAnalysisRuntime: vi.fn(),
}));

import { distillKbDocumentAnalysisRuntime } from '../analysisRuntimeDistillApi';

function sampleDoc(overrides: Partial<StagedKbDocument> = {}): StagedKbDocument {
  return {
    id: 'd1',
    name: 'KB.md',
    size: 1,
    mimeType: 'text/markdown',
    addedAt: '',
    file: new File([], 'x'),
    parseStatus: 'ready',
    variables: [],
    variableDictionary: {},
    howToUseText: '',
    markdownSnippet: '',
    documentAnalysisMarkdown:
      '## Type: MIXED\n\n### Regole di dialogo\n- regola — Fonte: «test»',
    agentAnalysisBaselineMarkdown: 'baseline',
    ...overrides,
  };
}

describe('analysisRuntimeDistill', () => {
  beforeEach(() => {
    vi.mocked(distillKbDocumentAnalysisRuntime).mockReset();
  });

  it('uses cached LLM distill when hash matches', async () => {
    const analysis =
      '## Type: MIXED\n\n### Regole di dialogo\n- regola — Fonte: «test»';
    const heuristic = distillKbDocumentAnalysisForRuntime(analysis);
    const hash = computeRuntimeDistillSourceHash(heuristic);
    const doc = sampleDoc({
      documentAnalysisRuntimeDistillMarkdown: '**cached** distill',
      documentAnalysisRuntimeDistillSourceHash: hash,
    });
    const result = await resolveKbRuntimeDistillText(doc, 4_000, undefined, undefined);
    expect(result.text).toBe('**cached** distill');
    expect(result.usedCache).toBe(true);
    expect(distillKbDocumentAnalysisRuntime).not.toHaveBeenCalled();
  });

  it('calls LLM distill when cache missing and AI params provided', async () => {
    vi.mocked(distillKbDocumentAnalysisRuntime).mockResolvedValue({
      runtimeDistilledMarkdown: '**llm** compact',
    });
    const patches: unknown[] = [];
    const result = await resolveKbRuntimeDistillText(
      sampleDoc(),
      4_000,
      { provider: 'openai', model: 'gpt-4o-mini' },
      {
        applyKbDocumentPatch: (_id, patch) => {
          patches.push(patch);
        },
      }
    );
    expect(result.usedLlmDistill).toBe(true);
    expect(result.text).toContain('llm');
    expect(distillKbDocumentAnalysisRuntime).toHaveBeenCalled();
    expect(patches.length).toBeGreaterThan(0);
  });
});
