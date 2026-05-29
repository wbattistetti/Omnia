import { describe, expect, it } from 'vitest';
import { TaskType, type Task } from '@types/taskTypes';
import { createEmptyBackendAnalysisDocumentV2 } from '../backendAnalysisDocumentV2';
import {
  collectParamKeysFromBackendCallTask,
  realignBackendParametersFromOpenApiTask,
} from '../realignBackendParametersFromOpenApiTask';

describe('realignBackendParametersFromOpenApiTask', () => {
  it('collectParamKeysFromBackendCallTask prefers apiParam and apiField', () => {
    const task = {
      type: TaskType.BackendCall,
      id: 'b1',
      inputs: [{ internalName: 'forbidden_months', apiParam: 'forbiddenMonths', variable: '' }],
      outputs: [{ internalName: 'slot_id', apiField: 'slotId', variable: '' }],
    } as Task;
    expect(collectParamKeysFromBackendCallTask(task)).toEqual([
      { paramKey: 'forbiddenMonths', direction: 'input' },
      { paramKey: 'slotId', direction: 'output' },
    ]);
  });

  it('drops stale params and preserves analysis for survivors', () => {
    const doc = createEmptyBackendAnalysisDocumentV2();
    doc.backends['b1'] = {
      catalogEntryId: 'b1',
      displayLabel: 'NextWindow',
      howToUseMarkdown: 'how',
      parameters: {
        days: {
          paramKey: 'days',
          direction: 'input',
          kind: 'required',
          role: 'vecchio',
          descriptionShort: '',
          analysisSummary: 'old import',
          analysisDetailMarkdown: '',
        },
        schemaVersion: {
          paramKey: 'schemaVersion',
          direction: 'input',
          kind: 'required',
          role: '',
          descriptionShort: '',
          analysisSummary: '',
          analysisDetailMarkdown: '',
        },
      },
      suggestedFeatures: [],
    };

    const task = {
      type: TaskType.BackendCall,
      id: 'b1',
      inputs: [
        { internalName: 'forbiddenMonths', apiParam: 'forbiddenMonths', variable: '' },
        { internalName: 'projectId', apiParam: 'projectId', variable: '' },
      ],
      outputs: [],
    } as Task;

    const next = realignBackendParametersFromOpenApiTask(doc, 'b1', task, 'NextWindow');
    expect(Object.keys(next.backends.b1!.parameters).sort()).toEqual(['forbiddenMonths', 'projectId']);
    expect(next.backends.b1!.parameters.forbiddenMonths?.role).toBe('');
    expect(next.backends.b1!.parameters.projectId?.paramKey).toBe('projectId');
    expect(next.backends.b1!.parameters.days).toBeUndefined();
    expect(next.backends.b1!.howToUseMarkdown).toBe('how');
  });
});
