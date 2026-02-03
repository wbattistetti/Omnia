// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ResponseEditor from '../index';
import type { Task, TaskTree } from '../../../../types/taskTypes';

// Import real providers for integration testing
import { ProjectDataProvider } from '../../../../context/ProjectDataContext';
import { DDTManagerProvider } from '../../../../context/DDTManagerContext';
import { AIProviderProvider } from '../../../../context/AIProviderContext';
import { ProjectTranslationsProvider } from '../../../../context/ProjectTranslationsContext';

// Mock services that ProjectDataProvider depends on
vi.mock('../../../../services/ProjectDataService', () => ({
  ProjectDataService: {
    loadProjectData: vi.fn(() => Promise.resolve({
      name: '',
      industry: '',
      agentActs: [],
      userActs: [],
      backendActions: [],
      tasks: [],
      conditions: [],
      macroTasks: [],
    })),
    addCategory: vi.fn(),
    deleteCategory: vi.fn(),
    updateCategory: vi.fn(),
    addItem: vi.fn(),
    deleteItem: vi.fn(),
    updateItem: vi.fn(),
  },
}));

vi.mock('../../../../state/runtime', () => ({
  setCurrentProjectId: vi.fn(),
}));

// Mock child components to avoid deep rendering
vi.mock('../components/ResponseEditorContent', () => ({
  ResponseEditorContent: ({ normalEditorLayout }: any) => (
    <div data-testid="response-editor-content">
      {normalEditorLayout}
    </div>
  ),
}));

vi.mock('../components/ResponseEditorNormalLayout', () => ({
  ResponseEditorNormalLayout: () => (
    <div data-testid="response-editor-normal-layout">Normal Layout</div>
  ),
}));

vi.mock('../components/ServiceUnavailableModal', () => ({
  ServiceUnavailableModal: () => <div data-testid="service-unavailable-modal" />,
}));

vi.mock('../ContractUpdateDialog', () => ({
  ContractUpdateDialog: () => <div data-testid="contract-update-dialog" />,
}));

vi.mock('../../common/EditorHeader', () => ({
  default: () => <div data-testid="editor-header" />,
}));

vi.mock('../TaskDragLayer', () => ({
  default: () => <div data-testid="task-drag-layer" />,
}));

/**
 * Light integration tests for ResponseEditor
 *
 * These tests verify that the component integrates correctly with providers
 * and renders without crashing when given valid data.
 *
 * WHAT WE TEST:
 * - Component mounts correctly with valid task and taskTree
 * - Component doesn't crash when all providers are present
 * - Basic rendering scenarios with valid data
 *
 * WHY IT'S IMPORTANT:
 * - Verifies integration with context providers
 * - Catches critical mounting/rendering issues
 * - Ensures component works in realistic scenarios
 */

// Helper to render component with all required providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ProjectDataProvider>
      <DDTManagerProvider>
        <AIProviderProvider>
          <ProjectTranslationsProvider>
            {ui}
          </ProjectTranslationsProvider>
        </AIProviderProvider>
      </DDTManagerProvider>
    </ProjectDataProvider>
  );
};

describe('ResponseEditor - Integration Tests', () => {
  let mockTaskTree: TaskTree;
  let mockTask: Task;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTaskTree = {
      label: 'Test TaskTree',
      nodes: [{ id: 'node-1', templateId: 'tpl-1', label: 'Node 1' }],
      steps: {},
    } as TaskTree;

    mockTask = {
      id: 'task-1',
      type: 1,
      label: 'Test Task',
      templateId: 'template-1', // Required for getTaskMeta to return non-null
    } as Task;
  });

  it('should mount correctly with valid task and taskTree', () => {
    expect(() => {
      renderWithProviders(<ResponseEditor taskTree={mockTaskTree} task={mockTask} />);
    }).not.toThrow();

    expect(screen.getByTestId('response-editor-content')).toBeInTheDocument();
  });

  it('should not crash when all providers are present', () => {
    expect(() => {
      renderWithProviders(<ResponseEditor taskTree={mockTaskTree} task={mockTask} />);
    }).not.toThrow();
  });

  it('should render with valid task only', () => {
    renderWithProviders(<ResponseEditor task={mockTask} />);

    expect(screen.getByTestId('response-editor-content')).toBeInTheDocument();
  });

  it('should render with valid taskTree and task', () => {
    renderWithProviders(<ResponseEditor taskTree={mockTaskTree} task={mockTask} />);

    expect(screen.getByTestId('response-editor-content')).toBeInTheDocument();
    expect(screen.getByTestId('response-editor-normal-layout')).toBeInTheDocument();
  });

  it('should render with hideHeader prop', () => {
    renderWithProviders(<ResponseEditor taskTree={mockTaskTree} task={mockTask} hideHeader={true} />);

    expect(screen.getByTestId('response-editor-content')).toBeInTheDocument();
    expect(screen.queryByTestId('editor-header')).not.toBeInTheDocument();
  });

  it('should handle optional props without crashing', () => {
    expect(() => {
      renderWithProviders(
        <ResponseEditor
          taskTree={mockTaskTree}
          task={mockTask}
          onClose={undefined}
          onWizardComplete={undefined}
          isTaskTreeLoading={undefined}
          hideHeader={undefined}
          onToolbarUpdate={undefined}
          tabId={undefined}
          setDockTree={undefined}
          registerOnClose={undefined}
        />
      );
    }).not.toThrow();

    expect(screen.getByTestId('response-editor-content')).toBeInTheDocument();
  });
});
