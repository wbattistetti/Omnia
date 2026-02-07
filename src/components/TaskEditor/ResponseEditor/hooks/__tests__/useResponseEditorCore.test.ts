// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResponseEditorCore } from '@responseEditor/hooks/useResponseEditorCore';
import type { TaskTree, Task } from '@types/taskTypes';

/**
 * Tests for useResponseEditorCore
 *
 * This hook combines all core logic for ResponseEditor.
 * We test observable behaviors: hook composition, derived values, handlers.
 *
 * WHAT WE TEST:
 * - All core hooks are initialized
 * - Derived values are calculated correctly
 * - Handlers are created and returned
 * - Integration between hooks works
 *
 * WHY IT'S IMPORTANT:
 * - Core hook orchestrates entire ResponseEditor logic
 * - Derived values affect UI rendering
 * - Handlers manage user interactions
 *
 * MOCKS:
 * - All context hooks (useTaskTreeManager, useProjectDataUpdate, etc.)
 * - All feature hooks (useNodeSelection, useParserHandlers, etc.)
 * - All utility functions (getTaskMeta, etc.)
 */

// Mock all context hooks
vi.mock('@context/DDTManagerContext', () => ({
  useTaskTreeManager: vi.fn(() => ({
    replaceSelectedTaskTree: vi.fn(),
  })),
}));

vi.mock('@context/ProjectDataContext', () => ({
  useProjectDataUpdate: vi.fn(() => ({})),
}));

vi.mock('@context/FontContext', () => ({
  useFontContext: vi.fn(() => ({
    combinedClass: 'test-class',
  })),
}));

vi.mock('@context/AIProviderContext', () => ({
  useAIProvider: vi.fn(() => ({
    provider: 'groq',
    model: 'llama-3.1-70b-versatile',
  })),
}));

// Mock state hooks
vi.mock('@responseEditor/core/state', () => ({
  useTaskTreeVersion: vi.fn(() => 1),
  useTaskTreeFromStore: vi.fn(() => null),
  useTaskTreeStore: vi.fn(() => ({
    setTaskTree: vi.fn(),
    incrementVersion: vi.fn(),
    taskTree: null,
    taskTreeVersion: 0,
  })),
}));

vi.mock('@responseEditor/hooks/useResponseEditorState', () => ({
  useResponseEditorState: vi.fn(() => ({
    serviceUnavailable: null,
    setServiceUnavailable: vi.fn(),
    showContractDialog: false,
    setShowContractDialog: vi.fn(),
    pendingContractChange: null,
    setPendingContractChange: vi.fn(),
    escalationTasks: [],
    setEscalationTasks: vi.fn(),
    pendingEditorOpen: null,
    setPendingEditorOpen: vi.fn(),
    showSynonyms: false,
    setShowSynonyms: vi.fn(),
    showMessageReview: false,
    setShowMessageReview: vi.fn(),
    selectedIntentIdForTraining: null,
    setSelectedIntentIdForTraining: vi.fn(),
    showContractWizard: false,
    setShowContractWizard: vi.fn(),
    selectedNode: null,
    setSelectedNode: vi.fn(),
    selectedNodePath: null,
    setSelectedNodePath: vi.fn(),
    taskTreeVersion: 0,
    setTaskTreeVersion: vi.fn(),
    leftPanelMode: 'actions',
    setLeftPanelMode: vi.fn(),
    testPanelMode: 'none',
    setTestPanelMode: vi.fn(),
    tasksPanelMode: 'none',
    setTasksPanelMode: vi.fn(),
    sidebarManualWidth: null,
    setSidebarManualWidth: vi.fn(),
    isDraggingSidebar: false,
    setIsDraggingSidebar: vi.fn(),
    draggingPanel: null,
    setDraggingPanel: vi.fn(),
  })),
}));

vi.mock('@responseEditor/hooks/useResponseEditorRefs', () => ({
  useResponseEditorRefs: vi.fn(() => ({
    prevInstanceRef: { current: null },
    contractChangeRef: { current: null },
    rootRef: { current: null },
    preAssembledTaskTreeCache: { current: null },
    wizardOwnsDataRef: { current: false },
    sidebarStartWidthRef: { current: 200 },
    sidebarStartXRef: { current: 100 },
    tasksStartWidthRef: { current: 0 },
    tasksStartXRef: { current: 0 },
  })),
}));

// Mock feature hooks
vi.mock('@responseEditor/features/node-editing/hooks', () => ({
  useNodeSelection: vi.fn(() => ({
    selectedMainIndex: 0,
    selectedSubIndex: null,
    selectedRoot: null,
    sidebarRef: { current: null },
    setSelectedMainIndex: vi.fn(),
    setSelectedSubIndex: vi.fn(),
    setSelectedRoot: vi.fn(),
    handleSelectMain: vi.fn(),
    handleSelectSub: vi.fn(),
    handleSelectAggregator: vi.fn(),
  })),
  useNodeFinder: vi.fn(() => vi.fn()),
  useNodeLoading: vi.fn(),
  useUpdateSelectedNode: vi.fn(() => vi.fn()),
}));

vi.mock('@responseEditor/hooks/useTaskTreeDerived', () => ({
  useTaskTreeDerived: vi.fn(() => ({
    mainList: [],
    isAggregatedAtomic: false,
    introduction: null,
  })),
}));

vi.mock('@responseEditor/hooks/useResponseEditorDerived', () => ({
  useResponseEditorDerived: vi.fn(() => ({
    needsIntentMessages: false,
    taskType: '1',
    headerTitle: 'Test Task',
    icon: () => null,
    iconColor: '#000000',
    rightMode: 'none',
  })),
}));

vi.mock('@responseEditor/hooks/useResponseEditorInitialization', () => ({
  useResponseEditorInitialization: vi.fn(() => ({
    replaceSelectedTaskTree: vi.fn(),
    handleGenerateAll: vi.fn(),
    handleContractWizardClose: vi.fn(),
    handleContractWizardNodeUpdate: vi.fn(),
    handleContractWizardComplete: vi.fn(),
    saveLeftPanelMode: vi.fn(),
    saveTestPanelMode: vi.fn(),
    saveTasksPanelMode: vi.fn(),
    saveRightMode: vi.fn(),
    toolbarButtons: [],
  })),
}));

vi.mock('@responseEditor/hooks/usePanelModes', () => ({
  usePanelModes: vi.fn(() => ({
    leftPanelMode: 'actions',
    testPanelMode: 'none',
    tasksPanelMode: 'none',
  })),
}));

vi.mock('@responseEditor/hooks/usePanelWidths', () => ({
  usePanelWidths: vi.fn(() => ({
    rightWidth: 300,
    setRightWidth: vi.fn(),
    testPanelWidth: 400,
    setTestPanelWidth: vi.fn(),
    tasksPanelWidth: 500,
    setTasksPanelWidth: vi.fn(),
  })),
}));

vi.mock('@responseEditor/features/step-management/hooks', () => ({
  useParserHandlers: vi.fn(() => ({
    handleParserCreate: vi.fn(),
    handleParserModify: vi.fn(),
    handleEngineChipClick: vi.fn(),
  })),
  useProfileUpdate: vi.fn(() => vi.fn()),
}));

vi.mock('@responseEditor/hooks/useIntentMessagesHandler', () => ({
  useIntentMessagesHandler: vi.fn(() => vi.fn()),
}));

vi.mock('@responseEditor/hooks/useGeneralizabilityCheck', () => ({
  useGeneralizabilityCheck: vi.fn(() => ({
    isGeneralizable: false,
    generalizationReason: null,
    isLoading: false,
  })),
}));

// Mock utility functions
vi.mock('@responseEditor/utils/responseEditorUtils', () => ({
  getTaskMeta: vi.fn((task: any) => ({
    id: task?.id || 'task-1',
    type: task?.type || 1,
    label: task?.label || 'Test Task',
  })),
}));

vi.mock('@responseEditor/core/domain', () => ({
  getStepsForNode: vi.fn(),
  getStepsAsArray: vi.fn(),
}));

vi.mock('@hooks/useDDTTranslations', () => ({
  useDDTTranslations: vi.fn(() => ({})),
}));

describe('useResponseEditorCore', () => {
  let mockTaskTree: TaskTree;
  let mockTask: Task;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTaskTree = {
      label: 'Test TaskTree',
      nodes: [],
      steps: {},
    } as TaskTree;

    mockTask = {
      id: 'task-1',
      type: 1,
      label: 'Test Task',
    } as Task;
  });

  it('should initialize all core hooks', () => {
    const { result } = renderHook(() =>
      useResponseEditorCore({
        taskTree: mockTaskTree,
        task: mockTask,
        currentProjectId: 'project-1',
      })
    );

    expect(result.current.state).toBeDefined();
    expect(result.current.refs).toBeDefined();
    expect(result.current.nodeSelection).toBeDefined();
    expect(result.current.panelModes).toBeDefined();
    expect(result.current.panelWidths).toBeDefined();
  });

  it('should return taskMeta', () => {
    const { result } = renderHook(() =>
      useResponseEditorCore({
        taskTree: mockTaskTree,
        task: mockTask,
        currentProjectId: 'project-1',
      })
    );

    expect(result.current.taskMeta).toBeDefined();
    expect(result.current.taskMeta.id).toBe('task-1');
    expect(result.current.taskMeta.label).toBe('Test Task');
  });

  it('should return derived values', () => {
    const { result } = renderHook(() =>
      useResponseEditorCore({
        taskTree: mockTaskTree,
        task: mockTask,
        currentProjectId: 'project-1',
      })
    );

    expect(result.current.mainList).toBeDefined();
    expect(result.current.isAggregatedAtomic).toBeDefined();
    expect(result.current.needsIntentMessages).toBeDefined();
    expect(result.current.taskType).toBeDefined();
    expect(result.current.headerTitle).toBeDefined();
    expect(result.current.icon).toBeDefined();
    expect(result.current.iconColor).toBeDefined();
  });

  it('should return handlers', () => {
    const { result } = renderHook(() =>
      useResponseEditorCore({
        taskTree: mockTaskTree,
        task: mockTask,
        currentProjectId: 'project-1',
      })
    );

    expect(result.current.handleParserCreate).toBeDefined();
    expect(result.current.handleParserModify).toBeDefined();
    expect(result.current.handleEngineChipClick).toBeDefined();
    expect(result.current.updateSelectedNode).toBeDefined();
    expect(result.current.handleProfileUpdate).toBeDefined();
    expect(result.current.handleIntentMessagesComplete).toBeDefined();
  });

  it('should handle null taskTree gracefully', () => {
    const { result } = renderHook(() =>
      useResponseEditorCore({
        taskTree: null,
        task: mockTask,
        currentProjectId: 'project-1',
      })
    );

    expect(result.current.state).toBeDefined();
    expect(result.current.refs).toBeDefined();
  });

  it('should handle missing task gracefully', () => {
    const { result } = renderHook(() =>
      useResponseEditorCore({
        taskTree: mockTaskTree,
        task: undefined,
        currentProjectId: 'project-1',
      })
    );

    expect(result.current.taskMeta).toBeDefined();
  });

  it('should return initialization handlers', () => {
    const { result } = renderHook(() =>
      useResponseEditorCore({
        taskTree: mockTaskTree,
        task: mockTask,
        currentProjectId: 'project-1',
      })
    );

    expect(result.current.initialization).toBeDefined();
    expect(result.current.initialization.replaceSelectedTaskTree).toBeDefined();
    expect(result.current.initialization.handleGenerateAll).toBeDefined();
  });

  it('should return generalizability check results', () => {
    const { result } = renderHook(() =>
      useResponseEditorCore({
        taskTree: mockTaskTree,
        task: mockTask,
        currentProjectId: 'project-1',
      })
    );

    expect(result.current.isGeneralizable).toBeDefined();
    expect(result.current.generalizationReason).toBeDefined();
    expect(result.current.isCheckingGeneralizability).toBeDefined();
  });
});
