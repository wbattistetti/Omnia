/**
 * Rules for excluding project template definitions from POST /tasks/bulk.
 */
import { describe, expect, it } from 'vitest';
import { TaskType, TemplateSource } from '@types/taskTypes';
import type { Task } from '@types/taskTypes';
import { isProjectTemplateDefinitionRowForTemplateEndpointOnly } from '../projectBulkTaskRules';

describe('isProjectTemplateDefinitionRowForTemplateEndpointOnly', () => {
  it('is true for project catalogue template row (null templateId, no subTasks)', () => {
    const task = {
      id: 'a',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
    } as Task;
    expect(isProjectTemplateDefinitionRowForTemplateEndpointOnly(task)).toBe(true);
  });

  it('is false for instance rows', () => {
    const task = {
      id: 'b',
      type: TaskType.UtteranceInterpretation,
      templateId: '00000000-0000-4000-8000-000000000002',
    } as Task;
    expect(isProjectTemplateDefinitionRowForTemplateEndpointOnly(task)).toBe(false);
  });

  it('is false for Factory template rows', () => {
    const task = {
      id: 'c',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
      source: TemplateSource.Factory,
    } as Task;
    expect(isProjectTemplateDefinitionRowForTemplateEndpointOnly(task)).toBe(false);
  });

  it('is false for standalone materialized rows', () => {
    const task = {
      id: 'd',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
      kind: 'standalone' as const,
    } as Task;
    expect(isProjectTemplateDefinitionRowForTemplateEndpointOnly(task)).toBe(false);
  });

  it('is false when subTasks graph is on the row', () => {
    const task = {
      id: 'e',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
      subTasks: [{ id: 'n1' } as any],
    } as Task;
    expect(isProjectTemplateDefinitionRowForTemplateEndpointOnly(task)).toBe(false);
  });
});
