// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResponseEditorHandlers } from '@responseEditor/hooks/useResponseEditorHandlers';
import type { TaskTree, Task } from '@types/taskTypes';

/**
 * Tests for useResponseEditorHandlers
 *
 * This hook combines all handlers for ResponseEditor.
 * We test observable behaviors: sidebar integration, editor close, contract dialog.
 *
 * WHAT WE TEST:
 * - Sidebar hook is used correctly
 * - Editor close handler is created
 * - Contract dialog handlers are created
 * - All handlers are returned correctly
 *
 * WHY IT'S IMPORTANT:
 * - Handlers orchestrate all user interactions
 * - Sidebar integration must work after consolidation
 * - Editor close logic is critical
 *
 * MOCKS:
 * - useSidebar (consolidated hook)
 * - useResponseEditorClose
 * - useContractUpdateDialog
 * - useResponseEditorSideEffects
 */

// Mock all dependencies
vi.mock('@responseEditor/hooks/useSidebar', () => ({
  useSidebar: vi.fn(() => ({
    handleSidebarResizeStart: vi.fn(),
    onChangeSubRequired: vi.fn(),
    onReorderSub: vi.fn(),
    onAddMain: vi.fn(),
    onRenameMain: vi.fn(),
    onDeleteMain: vi.fn(),
    onAddSub: vi.fn(),
    onRenameSub: vi.fn(),
    onDeleteSub: vi.fn(),
  })),
}));

vi.mock('@responseEditor/hooks/useResponseEditorClose', () => ({
  useResponseEditorClose: vi.fn(() => vi.fn()),
}));

vi.mock('@responseEditor/hooks/useContractUpdateDialog', () => ({
  useContractUpdateDialog: vi.fn(() => ({
    handleContractChange: vi.fn(),
    handleContractAccept: vi.fn(),
    handleContractReject: vi.fn(),
  })),
}));

vi.mock('@responseEditor/hooks/useResponseEditorSideEffects', () => ({
  useResponseEditorSideEffects: vi.fn(),
}));

import { useSidebar } from '@responseEditor/hooks/useSidebar';
import { useResponseEditorClose } from '@responseEditor/hooks/useResponseEditorClose';
import { useContractUpdateDialog } from '@responseEditor/hooks/useContractUpdateDialog';

describe('useResponseEditorHandlers', () => {
  let mockTaskTree: TaskTree;
  let mockTask: Task;
  let mockState: any;
  let mockRefs: any;
  let mockNodeSelection: any;
  let mockPanelWidths: any;
  let mockInitialization: any;
  let mockUpdateSelectedNode: ReturnType<typeof vi.fn>;
  let mockHandleProfileUpdate: ReturnType<typeof vi.fn>;

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

    mockState = {
      selectedNode: null,
      selectedNodePath: null,
      selectedRoot: null,
      isDraggingSidebar: false,
      setIsDraggingSidebar: vi.fn(),
      draggingPanel: null,
      setDraggingPanel: vi.fn(),
      rightWidth: 300,
      setRightWidth: vi.fn(),
      testPanelWidth: 400,
      setTestPanelWidth: vi.fn(),
      tasksPanelWidth: 500,
      setTasksPanelWidth: vi.fn(),
      tasksPanelMode: 'none',
      testPanelMode: 'none',
      showContractDialog: false,
      setShowContractDialog: vi.fn(),
      pendingContractChange: null,
      setPendingContractChange: vi.fn(),
      serviceUnavailable: null,
      setServiceUnavailable: vi.fn(),
      escalationTasks: [],
      setEscalationTasks: vi.fn(),
      pendingEditorOpen: null,
      showSynonyms: false,
      setPendingEditorOpen: vi.fn(),
      sidebarManualWidth: null,
      setSidebarManualWidth: vi.fn(),
      taskTreeVersion: 0,
      setTaskTreeVersion: vi.fn(),
    };

    mockRefs = {
      contractChangeRef: { current: null },
      sidebarRef: { current: document.createElement('div') },
      sidebarStartWidthRef: { current: 200 },
      sidebarStartXRef: { current: 100 },
      prevInstanceRef: { current: null },
      tasksStartWidthRef: { current: 0 },
      tasksStartXRef: { current: 0 },
    };

    mockNodeSelection = {
      selectedRoot: null,
      sidebarRef: { current: document.createElement('div') },
    };

    mockPanelWidths = {
      rightWidth: 300,
      testPanelWidth: 400,
      tasksPanelWidth: 500,
    };

    mockInitialization = {
      replaceSelectedTaskTree: vi.fn(),
      toolbarButtons: [],
    };

    mockUpdateSelectedNode = vi.fn();
    mockHandleProfileUpdate = vi.fn();
  });

  it('should use useSidebar hook correctly', () => {
    renderHook(() =>
      useResponseEditorHandlers({
        taskTree: mockTaskTree,
        task: mockTask,
        currentProjectId: 'project-1',
        state: mockState,
        refs: mockRefs,
        nodeSelection: mockNodeSelection,
        panelWidths: mockPanelWidths,
        initialization: mockInitialization,
        updateSelectedNode: mockUpdateSelectedNode,
        handleProfileUpdate: mockHandleProfileUpdate,
      })
    );

    expect(useSidebar).toHaveBeenCalledWith({
      isDraggingSidebar: false,
      setIsDraggingSidebar: mockState.setIsDraggingSidebar,
      sidebarStartWidthRef: mockRefs.sidebarStartWidthRef,
      sidebarStartXRef: mockRefs.sidebarStartXRef,
      setSidebarManualWidth: mockState.setSidebarManualWidth,
      sidebarRef: mockNodeSelection.sidebarRef,
      taskTree: mockTaskTree,
      replaceSelectedTaskTree: mockInitialization.replaceSelectedTaskTree,
    });
  });

  it('should return sidebar handlers', () => {
    const { result } = renderHook(() =>
      useResponseEditorHandlers({
        taskTree: mockTaskTree,
        task: mockTask,
        currentProjectId: 'project-1',
        state: mockState,
        refs: mockRefs,
        nodeSelection: mockNodeSelection,
        panelWidths: mockPanelWidths,
        initialization: mockInitialization,
        updateSelectedNode: mockUpdateSelectedNode,
        handleProfileUpdate: mockHandleProfileUpdate,
      })
    );

    expect(result.current.sidebar).toBeDefined();
    expect(result.current.sidebar.handleSidebarResizeStart).toBeDefined();
    expect(result.current.sidebar.onChangeSubRequired).toBeDefined();
  });

  it('should create editor close handler', () => {
    renderHook(() =>
      useResponseEditorHandlers({
        taskTree: mockTaskTree,
        task: mockTask,
        currentProjectId: 'project-1',
        state: mockState,
        refs: mockRefs,
        nodeSelection: mockNodeSelection,
        panelWidths: mockPanelWidths,
        initialization: mockInitialization,
        updateSelectedNode: mockUpdateSelectedNode,
        handleProfileUpdate: mockHandleProfileUpdate,
      })
    );

    expect(useResponseEditorClose).toHaveBeenCalledWith({
      contractChangeRef: mockRefs.contractChangeRef,
      setPendingContractChange: mockState.setPendingContractChange,
      setShowContractDialog: mockState.setShowContractDialog,
      selectedNode: mockState.selectedNode,
      selectedNodePath: mockState.selectedNodePath,
      selectedRoot: mockState.selectedRoot,
      task: mockTask,
      currentProjectId: 'project-1',
      tabId: undefined,
      setDockTree: undefined,
      onClose: undefined,
      replaceSelectedTaskTree: mockInitialization.replaceSelectedTaskTree,
    });
  });

  it('should return editor close handler', () => {
    const { result } = renderHook(() =>
      useResponseEditorHandlers({
        taskTree: mockTaskTree,
        task: mockTask,
        currentProjectId: 'project-1',
        state: mockState,
        refs: mockRefs,
        nodeSelection: mockNodeSelection,
        panelWidths: mockPanelWidths,
        initialization: mockInitialization,
        updateSelectedNode: mockUpdateSelectedNode,
        handleProfileUpdate: mockHandleProfileUpdate,
      })
    );

    expect(result.current.handleEditorClose).toBeDefined();
    expect(typeof result.current.handleEditorClose).toBe('function');
  });

  it('should create contract dialog handlers', () => {
    renderHook(() =>
      useResponseEditorHandlers({
        taskTree: mockTaskTree,
        task: mockTask,
        currentProjectId: 'project-1',
        state: mockState,
        refs: mockRefs,
        nodeSelection: mockNodeSelection,
        panelWidths: mockPanelWidths,
        initialization: mockInitialization,
        updateSelectedNode: mockUpdateSelectedNode,
        handleProfileUpdate: mockHandleProfileUpdate,
      })
    );

    expect(useContractUpdateDialog).toHaveBeenCalledWith({
      showContractDialog: mockState.showContractDialog,
      setShowContractDialog: mockState.setShowContractDialog,
      pendingContractChange: mockState.pendingContractChange,
      setPendingContractChange: mockState.setPendingContractChange,
      contractChangeRef: mockRefs.contractChangeRef,
      tabId: undefined,
      setDockTree: undefined,
      onClose: undefined,
    });
  });

  it('should return contract dialog handlers', () => {
    const { result } = renderHook(() =>
      useResponseEditorHandlers({
        taskTree: mockTaskTree,
        task: mockTask,
        currentProjectId: 'project-1',
        state: mockState,
        refs: mockRefs,
        nodeSelection: mockNodeSelection,
        panelWidths: mockPanelWidths,
        initialization: mockInitialization,
        updateSelectedNode: mockUpdateSelectedNode,
        handleProfileUpdate: mockHandleProfileUpdate,
      })
    );

    expect(result.current.contractDialogHandlers).toBeDefined();
    expect(result.current.contractDialogHandlers.handleContractChange).toBeDefined();
    expect(result.current.contractDialogHandlers.handleContractAccept).toBeDefined();
    expect(result.current.contractDialogHandlers.handleContractReject).toBeDefined();
  });

  it('should pass optional props correctly', () => {
    const mockOnClose = vi.fn();
    const mockSetDockTree = vi.fn();
    const mockTabId = 'tab-1';

    renderHook(() =>
      useResponseEditorHandlers({
        taskTree: mockTaskTree,
        task: mockTask,
        currentProjectId: 'project-1',
        state: mockState,
        refs: mockRefs,
        nodeSelection: mockNodeSelection,
        panelWidths: mockPanelWidths,
        initialization: mockInitialization,
        updateSelectedNode: mockUpdateSelectedNode,
        handleProfileUpdate: mockHandleProfileUpdate,
        tabId: mockTabId,
        setDockTree: mockSetDockTree,
        onClose: mockOnClose,
      })
    );

    expect(useResponseEditorClose).toHaveBeenCalledWith(
      expect.objectContaining({
        tabId: mockTabId,
        setDockTree: mockSetDockTree,
        onClose: mockOnClose,
      })
    );
  });
});
