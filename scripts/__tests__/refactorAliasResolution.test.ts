/**
 * Verifies @domain/* and @omnia/* imports resolve to package modules, not legacy src copies.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getScenarioText } from '@domain/aiAgentUseCase/scenarioText';
import { summarizeUseCaseActionLabel } from '@omnia/domain-core/usecase/logic/useCaseActionSummary';
import { parseAgentReviewDocument } from '@domain/agentReviewChannel/reviewDocument';
import { ReviewPortalStepper } from '@omnia/domain-components';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('refactor alias resolution', () => {
  it('@domain/aiAgentUseCase/scenarioText resolves to domain-core package export', async () => {
    const direct = await import(
      '../../packages/omnia-domain-core/src/usecase/logic/scenarioText.ts'
    );
    expect(getScenarioText).toBe(direct.getScenarioText);
  });

  it('@domain/agentReviewChannel/reviewDocument resolves to domain-core package export', async () => {
    const direct = await import('../../packages/omnia-domain-core/src/review/reviewDocument.ts');
    expect(parseAgentReviewDocument).toBe(direct.parseAgentReviewDocument);
  });

  it('@omnia/domain-core subpath resolves to package export', async () => {
    const direct = await import(
      '../../packages/omnia-domain-core/src/usecase/logic/useCaseActionSummary.ts'
    );
    expect(summarizeUseCaseActionLabel).toBe(direct.summarizeUseCaseActionLabel);
  });

  it('@omnia/domain-components resolves to package index', async () => {
    const direct = await import('../../packages/omnia-domain-components/src/index.ts');
    expect(ReviewPortalStepper).toBe(direct.ReviewPortalStepper);
  });

  it('vite.config maps @domain/useCaseBundle to packages/omnia-domain-core', () => {
    const viteConfigPath = path.join(repoRoot, 'vite.config.ts');
    const text = fs.readFileSync(viteConfigPath, 'utf8');
    expect(text).toContain('packages/omnia-domain-core/src/usecase/bundle');
    expect(text).toContain('packages/omnia-domain-core/src/usecase/logic');
  });
});

describe('refactor module identity', () => {
  it('summarizeUseCaseActionLabel uses domain-core implementation', () => {
    expect(
      summarizeUseCaseActionLabel({ id: '1', label: '  Saluta  ', type: 1 })
    ).toBe('Saluta');
  });

  it('getScenarioText reads scenario.llm from use case', () => {
    expect(
      getScenarioText({
        id: 'uc',
        label: 'L',
        parent_id: null,
        sort_order: 0,
        refinement_prompt: '',
        dialogue: [],
        notes: { behavior: '', tone: '' },
        bubble_notes: {},
        scenario: { llm: 'Scenario canonico', descrittivo: '' },
      })
    ).toBe('Scenario canonico');
  });
});
