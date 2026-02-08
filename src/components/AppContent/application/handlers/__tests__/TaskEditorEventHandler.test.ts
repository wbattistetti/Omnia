// Unit tests for TaskEditorEventHandler
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskEditorEventHandler } from '../TaskEditorEventHandler';
import { TaskType } from '@types/taskTypes';

// Mock dependencies
vi.mock('@services/TaskRepository', () => ({
  taskRepository: {
    getTask: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
  },
}));

vi.mock('@taskEditor/EditorHost/resolveKind', () => ({
  resolveEditorKind: vi.fn(({ type }) => {
    if (type === TaskType.SayMessage) return 'message';
    if (type === TaskType.DataRequest) return 'ddt';
    return 'backend';
  }),
}));

describe('TaskEditorEventHandler', () => {
  let handler: TaskEditorEventHandler;
  let mockPdUpdate: any;

  beforeEach(() => {
    mockPdUpdate = {
      getCurrentProjectId: vi.fn(() => 'test-project'),
    };
    handler = new TaskEditorEventHandler({
      currentProjectId: 'test-project',
      pdUpdate: mockPdUpdate,
    });
  });

  it('should validate event correctly', async () => {
    const validEvent = {
      id: 'test-id',
      type: TaskType.SayMessage,
      label: 'Test',
    };
    const result = await handler.handle(validEvent);
    expect(result).toBeDefined();
    expect(result.tabId).toBe('act_test-id');
    expect(result.dockTab.type).toBe('taskEditor');
  });

  it('should throw error for invalid event', async () => {
    const invalidEvent = { id: 'test-id' }; // Missing type
    await expect(handler.handle(invalidEvent as any)).rejects.toThrow();
  });

  it('should build TaskMeta correctly', async () => {
    const event = {
      id: 'test-id',
      type: TaskType.SayMessage,
      label: 'Test Task',
      instanceId: 'instance-1',
      taskWizardMode: 'full' as const,
    };
    const result = await handler.handle(event);
    expect(result.dockTab.task).toBeDefined();
    expect(result.dockTab.task?.taskWizardMode).toBe('full');
  });
});
