import { describe, expect, it } from 'vitest';
import {
  buildExternalAgentPromptSections,
  mergeExternalAgentPromptSections,
} from '../buildMergedExternalAgentPrompt';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

function minimalUseCase(): AIAgentUseCase {
  return {
    id: 'uc1',
    label: 'Saluto',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    dialogue: [
      {
        turn_id: 'a',
        role: 'assistant',
        content: 'Buongiorno, come posso aiutarla?',
        editable: true,
      },
    ],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  } as AIAgentUseCase;
}

describe('buildMergedExternalAgentPrompt', () => {
  it('mergeExternalAgentPromptSections joins non-empty blocks', () => {
    const merged = mergeExternalAgentPromptSections({
      useCases: '## UC\n\ncatalog',
      backends: '## USE OF BACKENDS:\n\n### API',
      knowledgeBase: '',
    });
    expect(merged).toContain('## UC');
    expect(merged).toContain('USE OF BACKENDS');
    expect(merged).toContain('---');
    expect(merged).not.toContain('KNOWLEDGE BASE');
  });

  it('buildExternalAgentPromptSections includes use case header', () => {
    const sections = buildExternalAgentPromptSections({
      useCases: [minimalUseCase()],
      agentTaskId: 'agent-1',
      knowledgeBaseDocuments: [],
    });
    expect(sections.useCases).toMatch(/Ruolo/);
    expect(sections.backends).toBe('');
    expect(sections.knowledgeBase).toBe('');
  });
});
