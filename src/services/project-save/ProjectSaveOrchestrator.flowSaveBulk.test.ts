/**
 * FLOW.SAVE-BULK REFACTOR — Integration: global translations flush runs before flow-document PUTs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectSaveOrchestrator } from './ProjectSaveOrchestrator';
import type { SaveProjectRequest } from './SaveProjectRequest';

const saveFlowDocumentMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../flows/flowDocumentPersistence', () => ({
  saveFlowDocument: (...args: unknown[]) => saveFlowDocumentMock(...args),
}));

function minimalRequest(projectId: string): SaveProjectRequest {
  return {
    version: '1.0',
    projectId,
    catalog: { projectId },
    tasks: { items: [], source: 'Project' },
    flow: {
      flowId: 'main',
      flow: { id: 'main', title: 'Main', nodes: [], edges: [] },
    },
    variables: { projectId, variables: [] },
    templates: [],
    conditions: { items: [] },
  };
}

describe('ProjectSaveOrchestrator.executeSave (FLOW.SAVE-BULK)', () => {
  const callOrder: string[] = [];

  beforeEach(() => {
    callOrder.length = 0;
    saveFlowDocumentMock.mockClear();
    saveFlowDocumentMock.mockImplementation(async () => {
      callOrder.push('saveFlowDocument');
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      })
    );
  });

  it('awaits saveAllTranslations before any saveFlowDocument', async () => {
    const saveAllTranslations = vi.fn(async () => {
      callOrder.push('saveAllTranslations');
    });

    const orchestrator = new ProjectSaveOrchestrator();
    const request = minimalRequest('proj_flow_bulk_1');

    const result = await orchestrator.executeSave(request, {
      translationsContext: { saveAllTranslations },
      flowState: {
        getFlowById: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
        getNodes: vi.fn().mockReturnValue([]),
        getEdges: vi.fn().mockReturnValue([]),
        flushFlowPersist: vi.fn().mockResolvedValue(undefined),
      },
      flowsById: {
        main: {
          nodes: [],
          edges: [],
          hasLocalChanges: true,
          meta: { translations: { 'task:550e8400-e29b-41d4-a716-446655440099': 'hello' } },
        },
      },
      variableService: { saveToDatabase: vi.fn().mockResolvedValue(true) },
      dialogueTaskService: {
        saveAllGrammarFlowFromStore: vi.fn().mockResolvedValue(undefined),
        markTemplateAsModified: vi.fn(),
        saveModifiedTemplates: vi.fn().mockResolvedValue({ saved: 0, failed: 0 }),
      },
      projectDataService: {
        saveProjectConditionsToDb: vi.fn().mockResolvedValue(undefined),
      },
      projectData: {},
      taskRepository: { saveAllTasksToDatabase: vi.fn().mockResolvedValue(true) },
    });

    expect(result.success).toBe(true);
    expect(saveAllTranslations).toHaveBeenCalledTimes(1);
    expect(saveFlowDocumentMock).toHaveBeenCalled();

    const trIdx = callOrder.indexOf('saveAllTranslations');
    const flowIdx = callOrder.indexOf('saveFlowDocument');
    expect(trIdx).toBeGreaterThanOrEqual(0);
    expect(flowIdx).toBeGreaterThan(trIdx);
  });
});
