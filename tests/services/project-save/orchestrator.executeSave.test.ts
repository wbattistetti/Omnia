// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectSaveOrchestrator } from '../../../src/services/project-save/ProjectSaveOrchestrator';
import type { SaveProjectRequest } from '../../../src/services/project-save/SaveProjectRequest';

describe('ProjectSaveOrchestrator - executeSave Tests', () => {
  let orchestrator: ProjectSaveOrchestrator;
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockTranslationsContext: any;
  let mockFlowState: any;
  let mockTaskRepository: any;
  let mockVariableService: any;
  let mockDialogueTaskService: any;
  let mockProjectDataService: any;

  beforeEach(() => {
    orchestrator = new ProjectSaveOrchestrator();

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock translations context
    mockTranslationsContext = {
      saveAllTranslations: vi.fn().mockResolvedValue(undefined),
    };

    // Mock flow state
    mockFlowState = {
      flushFlowPersist: vi.fn().mockResolvedValue(undefined),
      getFlowById: vi.fn().mockReturnValue({
        nodes: [{ id: 'node-1', data: {} }],
        edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2' }],
      }),
      getNodes: vi.fn().mockReturnValue([{ id: 'node-1', data: {} }]),
      getEdges: vi.fn().mockReturnValue([{ id: 'edge-1', source: 'node-1', target: 'node-2' }]),
      transformNodesToSimplified: vi.fn((nodes) => nodes),
      transformEdgesToSimplified: vi.fn((edges) => edges),
    };

    // Mock task repository
    mockTaskRepository = {
      saveAllTasksToDatabase: vi.fn().mockResolvedValue(true),
    };

    // Mock variable service
    mockVariableService = {
      saveToDatabase: vi.fn().mockResolvedValue(true),
    };

    // Mock dialogue task service
    mockDialogueTaskService = {
      saveAllGrammarFlowFromStore: vi.fn().mockResolvedValue(undefined),
      markTemplateAsModified: vi.fn(),
      saveModifiedTemplates: vi.fn().mockResolvedValue({ saved: 2, failed: 0 }),
    };

    // Mock project data service
    mockProjectDataService = {
      saveProjectConditionsToDb: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should execute all save operations successfully', async () => {
    const request: SaveProjectRequest = {
      version: '1.0',
      projectId: 'test-project',
      catalog: {
        projectId: 'test-project',
        ownerCompany: 'Test Company',
        ownerClient: 'Test Client',
      },
      tasks: {
        items: [{ id: 'task-1', type: 0, templateId: null }],
        source: 'Project',
      },
      flow: {
        flowId: 'main',
        flow: {
          id: 'main',
          title: 'Main Flow',
          nodes: [],
          edges: [],
        },
      },
      variables: {
        projectId: 'test-project',
        variables: [{ id: 'var-1', name: 'Variable 1' }],
      },
      templates: [
        {
          templateId: 'template-1',
          template: { id: 'template-1', label: 'Template 1' },
          isFactory: false,
        },
      ],
      conditions: {
        items: [{ id: 'cond-1', label: 'Condition 1', description: '', expression: { script: 'true' } }],
      },
    };

    // Mock successful fetch responses
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });

    const result = await orchestrator.executeSave(request, {
      translationsContext: mockTranslationsContext,
      flowState: mockFlowState,
      taskRepository: mockTaskRepository,
      variableService: mockVariableService,
      dialogueTaskService: mockDialogueTaskService,
      projectDataService: mockProjectDataService,
      projectData: { conditions: [] },
    });

    // Verify all operations were called
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/projects/catalog/update-timestamp',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.catalog),
      })
    );
    expect(mockTranslationsContext.saveAllTranslations).toHaveBeenCalled();
    expect(mockFlowState.flushFlowPersist).toHaveBeenCalled();
    expect(mockTaskRepository.saveAllTasksToDatabase).toHaveBeenCalledWith('test-project', request.tasks.items);
    expect(mockVariableService.saveToDatabase).toHaveBeenCalledWith('test-project');
    expect(mockDialogueTaskService.saveAllGrammarFlowFromStore).toHaveBeenCalled();
    expect(mockDialogueTaskService.saveModifiedTemplates).toHaveBeenCalledWith('test-project');
    expect(mockProjectDataService.saveProjectConditionsToDb).toHaveBeenCalled();

    // Verify result
    expect(result.success).toBe(true);
    expect(result.projectId).toBe('test-project');
    expect(result.results.catalog?.success).toBe(true);
    expect(result.results.translations?.success).toBe(true);
    expect(result.results.flow?.success).toBe(true);
    expect(result.results.tasks?.success).toBe(true);
    expect(result.results.variables?.success).toBe(true);
    expect(result.results.templates?.success).toBe(true);
    expect(result.results.conditions?.success).toBe(true);
  });

  it('should handle catalog save failure', async () => {
    const request: SaveProjectRequest = {
      version: '1.0',
      projectId: 'test-project',
      catalog: { projectId: 'test-project' },
      tasks: { items: [], source: 'Project' },
      flow: { flowId: 'main', flow: { id: 'main', title: 'Main', nodes: [], edges: [] } },
      variables: { projectId: 'test-project', variables: [] },
      templates: [],
      conditions: { items: [] },
    };

    // Mock failed fetch
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const result = await orchestrator.executeSave(request, {
      translationsContext: mockTranslationsContext,
      flowState: mockFlowState,
      taskRepository: mockTaskRepository,
      variableService: mockVariableService,
      dialogueTaskService: mockDialogueTaskService,
      projectDataService: mockProjectDataService,
      projectData: { conditions: [] },
    });

    expect(result.success).toBe(false);
    expect(result.results.catalog?.success).toBe(false);
    expect(result.results.catalog?.error).toContain('Catalog save failed');
    expect(result.errors?.some((e) => e.includes('Catalog:'))).toBe(true);
  });

  it('should handle missing translations context gracefully', async () => {
    const request: SaveProjectRequest = {
      version: '1.0',
      projectId: 'test-project',
      catalog: { projectId: 'test-project' },
      tasks: { items: [], source: 'Project' },
      flow: { flowId: 'main', flow: { id: 'main', title: 'Main', nodes: [], edges: [] } },
      variables: { projectId: 'test-project', variables: [] },
      templates: [],
      conditions: { items: [] },
    };

    mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

    const result = await orchestrator.executeSave(request, {
      translationsContext: undefined, // Missing context
      flowState: mockFlowState,
      taskRepository: mockTaskRepository,
      variableService: mockVariableService,
      dialogueTaskService: mockDialogueTaskService,
      projectDataService: mockProjectDataService,
      projectData: { conditions: [] },
    });

    expect(result.results.translations?.success).toBe(false);
    expect(result.results.translations?.error).toContain('Translations context not available');
  });

  it('should handle task repository save failure', async () => {
    const request: SaveProjectRequest = {
      version: '1.0',
      projectId: 'test-project',
      catalog: { projectId: 'test-project' },
      tasks: {
        items: [{ id: 'task-1', type: 0, templateId: null }],
        source: 'Project',
      },
      flow: { flowId: 'main', flow: { id: 'main', title: 'Main', nodes: [], edges: [] } },
      variables: { projectId: 'test-project', variables: [] },
      templates: [],
      conditions: { items: [] },
    };

    mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    mockTaskRepository.saveAllTasksToDatabase.mockResolvedValue(false); // Failure

    const result = await orchestrator.executeSave(request, {
      translationsContext: mockTranslationsContext,
      flowState: mockFlowState,
      taskRepository: mockTaskRepository,
      variableService: mockVariableService,
      dialogueTaskService: mockDialogueTaskService,
      projectDataService: mockProjectDataService,
      projectData: { conditions: [] },
    });

    expect(result.results.tasks?.success).toBe(false);
    expect(result.results.tasks?.saved).toBe(0);
    expect(result.results.tasks?.failed).toBe(1);
    expect(result.errors?.some((e) => e.includes('Tasks:'))).toBe(true);
  });

  it('should handle template save partial failure', async () => {
    const request: SaveProjectRequest = {
      version: '1.0',
      projectId: 'test-project',
      catalog: { projectId: 'test-project' },
      tasks: { items: [], source: 'Project' },
      flow: { flowId: 'main', flow: { id: 'main', title: 'Main', nodes: [], edges: [] } },
      variables: { projectId: 'test-project', variables: [] },
      templates: [
        { templateId: 'template-1', template: { id: 'template-1' }, isFactory: false },
        { templateId: 'template-2', template: { id: 'template-2' }, isFactory: false },
      ],
      conditions: { items: [] },
    };

    mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    mockDialogueTaskService.saveModifiedTemplates.mockResolvedValue({ saved: 1, failed: 1 }); // Partial failure

    const result = await orchestrator.executeSave(request, {
      translationsContext: mockTranslationsContext,
      flowState: mockFlowState,
      taskRepository: mockTaskRepository,
      variableService: mockVariableService,
      dialogueTaskService: mockDialogueTaskService,
      projectDataService: mockProjectDataService,
      projectData: { conditions: [] },
    });

    expect(result.results.templates?.success).toBe(false);
    expect(result.results.templates?.saved).toBe(1);
    expect(result.results.templates?.failed).toBe(1);
  });

  it('should calculate duration correctly', async () => {
    const request: SaveProjectRequest = {
      version: '1.0',
      projectId: 'test-project',
      catalog: { projectId: 'test-project' },
      tasks: { items: [], source: 'Project' },
      flow: { flowId: 'main', flow: { id: 'main', title: 'Main', nodes: [], edges: [] } },
      variables: { projectId: 'test-project', variables: [] },
      templates: [],
      conditions: { items: [] },
    };

    mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

    const result = await orchestrator.executeSave(request, {
      translationsContext: mockTranslationsContext,
      flowState: mockFlowState,
      taskRepository: mockTaskRepository,
      variableService: mockVariableService,
      dialogueTaskService: mockDialogueTaskService,
      projectDataService: mockProjectDataService,
      projectData: { conditions: [] },
    });

    // Duration should be >= 0 (can be 0 if operations are very fast/synchronous)
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(typeof result.duration).toBe('number');
  });
});
