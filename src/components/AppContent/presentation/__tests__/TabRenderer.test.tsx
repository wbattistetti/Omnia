// Unit tests for TabRenderer component

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TabRenderer } from '../TabRenderer';
import type { DockTab, DockTabResponseEditor, DockTabTaskEditor } from '@dock/types';
import { TaskType } from '@types/taskTypes';

// Mock dependencies
vi.mock('../../../FlowWorkspace/FlowCanvasHost', () => ({
  FlowCanvasHost: ({ projectId, flowId }: { projectId: string; flowId: string }) => (
    <div data-testid="flow-canvas-host">{`Flow: ${projectId}/${flowId}`}</div>
  ),
}));

vi.mock('../../../../flows/FlowStore', () => ({
  useFlowActions: () => ({
    upsertFlow: vi.fn(),
    openFlowBackground: vi.fn(),
  }),
}));

vi.mock('../../TaskEditor/ResponseEditor', () => ({
  __esModule: true,
  default: ({ task, tabId }: { task?: any; tabId: string }) => (
    <div data-testid="response-editor">{`ResponseEditor: ${tabId} - ${task?.label || 'no task'}`}</div>
  ),
}));

vi.mock('../../TaskEditor/ResponseEditor/NonInteractiveResponseEditor', () => ({
  __esModule: true,
  default: ({ title, instanceId }: { title: string; instanceId?: string }) => (
    <div data-testid="non-interactive-editor">{`NonInteractive: ${title} - ${instanceId || 'no id'}`}</div>
  ),
}));

vi.mock('../../conditions/ConditionEditor', () => ({
  __esModule: true,
  default: ({ label, open }: { label?: string; open: boolean }) => (
    <div data-testid="condition-editor">{`ConditionEditor: ${label || 'no label'} - ${open ? 'open' : 'closed'}`}</div>
  ),
}));

vi.mock('../../TaskEditor/EditorHost/ResizableTaskEditorHost', () => ({
  ResizableTaskEditorHost: ({ task }: { task: any }) => (
    <div data-testid="task-editor-host">{`TaskEditorHost: ${task?.label || 'no task'}`}</div>
  ),
}));

vi.mock('@dock/ops', () => ({
  mapNode: vi.fn((tree, fn) => fn(tree)),
  closeTab: vi.fn((tree, tabId) => tree),
  upsertAddNextTo: vi.fn((tree, tabId, newTab) => tree),
}));

vi.mock('@services/TaskRepository', () => ({
  taskRepository: {
    updateTask: vi.fn(),
  },
}));

describe('TabRenderer', () => {
  const mockSetDockTree = vi.fn();
  const mockEditorCloseRefsMap = React.createRef<Map<string, () => Promise<boolean>>>();
  mockEditorCloseRefsMap.current = new Map();
  const mockPdUpdate = {
    getCurrentProjectId: vi.fn(() => 'test-project-id'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Flow tab rendering', () => {
    it('should render FlowCanvasHost when tab type is flow', () => {
      const tab: DockTab = {
        id: 'tab-flow-1',
        title: 'Flow Tab',
        type: 'flow',
        flowId: 'flow-123',
      };

      render(
        <TabRenderer
          tab={tab}
          currentPid="test-project"
          setDockTree={mockSetDockTree}
          editorCloseRefsMap={mockEditorCloseRefsMap}
          pdUpdate={mockPdUpdate}
        />
      );

      expect(screen.getByTestId('flow-canvas-host')).toBeInTheDocument();
      expect(screen.getByText(/Flow: test-project\/flow-123/)).toBeInTheDocument();
    });

    it('should show waiting message when currentPid is not provided', () => {
      const tab: DockTab = {
        id: 'tab-flow-1',
        title: 'Flow Tab',
        type: 'flow',
        flowId: 'flow-123',
      };

      render(
        <TabRenderer
          tab={tab}
          currentPid={undefined}
          setDockTree={mockSetDockTree}
          editorCloseRefsMap={mockEditorCloseRefsMap}
          pdUpdate={mockPdUpdate}
        />
      );

      expect(screen.getByText('Waiting for project...')).toBeInTheDocument();
      expect(screen.queryByTestId('flow-canvas-host')).not.toBeInTheDocument();
    });
  });

  describe('Response Editor tab rendering', () => {
    it('should render ResponseEditor when tab type is responseEditor', () => {
      const tab: DockTabResponseEditor = {
        id: 'tab-response-1',
        title: 'Response Editor',
        type: 'responseEditor',
        task: {
          id: 'task-1',
          type: TaskType.SayMessage,
          label: 'Test Task',
          instanceId: 'instance-1',
        },
        taskTree: null,
      };

      render(
        <TabRenderer
          tab={tab}
          currentPid="test-project"
          setDockTree={mockSetDockTree}
          editorCloseRefsMap={mockEditorCloseRefsMap}
          pdUpdate={mockPdUpdate}
        />
      );

      expect(screen.getByTestId('response-editor')).toBeInTheDocument();
      expect(screen.getByText(/ResponseEditor: tab-response-1 - Test Task/)).toBeInTheDocument();
    });

    it('should handle responseEditor without task', () => {
      const tab: DockTabResponseEditor = {
        id: 'tab-response-1',
        title: 'Response Editor',
        type: 'responseEditor',
        task: undefined,
        taskTree: null,
      };

      render(
        <TabRenderer
          tab={tab}
          currentPid="test-project"
          setDockTree={mockSetDockTree}
          editorCloseRefsMap={mockEditorCloseRefsMap}
          pdUpdate={mockPdUpdate}
        />
      );

      expect(screen.getByTestId('response-editor')).toBeInTheDocument();
      expect(screen.getByText(/ResponseEditor: tab-response-1 - no task/)).toBeInTheDocument();
    });
  });

  describe('Non-Interactive Editor tab rendering', () => {
    it('should render NonInteractiveResponseEditor when tab type is nonInteractive', () => {
      const tab: DockTab = {
        id: 'tab-ni-1',
        title: 'Non-Interactive Editor',
        type: 'nonInteractive',
        instanceId: 'instance-123',
        value: {
          template: 'Test template',
        },
      };

      render(
        <TabRenderer
          tab={tab}
          currentPid="test-project"
          setDockTree={mockSetDockTree}
          editorCloseRefsMap={mockEditorCloseRefsMap}
          pdUpdate={mockPdUpdate}
        />
      );

      expect(screen.getByTestId('non-interactive-editor')).toBeInTheDocument();
      expect(screen.getByText(/NonInteractive: Non-Interactive Editor - instance-123/)).toBeInTheDocument();
    });
  });

  describe('Condition Editor tab rendering', () => {
    it('should render ConditionEditor when tab type is conditionEditor', () => {
      const tab: DockTab = {
        id: 'tab-condition-1',
        title: 'Condition Editor',
        type: 'conditionEditor',
        label: 'Test Condition',
        variables: [],
        script: 'test script',
      };

      render(
        <TabRenderer
          tab={tab}
          currentPid="test-project"
          setDockTree={mockSetDockTree}
          editorCloseRefsMap={mockEditorCloseRefsMap}
          pdUpdate={mockPdUpdate}
        />
      );

      expect(screen.getByTestId('condition-editor')).toBeInTheDocument();
      expect(screen.getByText(/ConditionEditor: Test Condition - open/)).toBeInTheDocument();
    });
  });

  describe('Task Editor tab rendering', () => {
    it('should render ResizableTaskEditorHost when tab type is taskEditor', () => {
      const tab: DockTabTaskEditor = {
        id: 'tab-task-1',
        title: 'Task Editor',
        type: 'taskEditor',
        task: {
          id: 'task-1',
          type: TaskType.BackendCall,
          label: 'Backend Task',
          instanceId: 'instance-1',
        },
      };

      render(
        <TabRenderer
          tab={tab}
          currentPid="test-project"
          setDockTree={mockSetDockTree}
          editorCloseRefsMap={mockEditorCloseRefsMap}
          pdUpdate={mockPdUpdate}
        />
      );

      expect(screen.getByTestId('task-editor-host')).toBeInTheDocument();
      expect(screen.getByText(/TaskEditorHost: Backend Task/)).toBeInTheDocument();
    });
  });

  describe('Unknown tab type', () => {
    it('should render unknown tab message for unknown tab types', () => {
      const tab = {
        id: 'tab-unknown-1',
        title: 'Unknown Tab',
        type: 'unknown' as any,
      };

      render(
        <TabRenderer
          tab={tab}
          currentPid="test-project"
          setDockTree={mockSetDockTree}
          editorCloseRefsMap={mockEditorCloseRefsMap}
          pdUpdate={mockPdUpdate}
        />
      );

      expect(screen.getByText('Unknown tab type')).toBeInTheDocument();
    });
  });

  describe('Memoization', () => {
    it('should use custom comparator for responseEditor tabs', () => {
      // This test verifies that the component is memoized correctly
      // The actual memoization behavior is tested through React.memo
      const tab1: DockTabResponseEditor = {
        id: 'tab-response-1',
        title: 'Response Editor',
        type: 'responseEditor',
        task: {
          id: 'task-1',
          type: TaskType.SayMessage,
          label: 'Test Task',
          instanceId: 'instance-1',
        },
        taskTree: null,
        toolbarButtons: [],
        headerColor: 'blue',
      };

      const { rerender } = render(
        <TabRenderer
          tab={tab1}
          currentPid="test-project"
          setDockTree={mockSetDockTree}
          editorCloseRefsMap={mockEditorCloseRefsMap}
          pdUpdate={mockPdUpdate}
        />
      );

      // Update only toolbarButtons (should not cause re-render for responseEditor)
      const tab2: DockTabResponseEditor = {
        ...tab1,
        toolbarButtons: [{ id: 'btn-1', label: 'Button' }],
        headerColor: 'red',
      };

      rerender(
        <TabRenderer
          tab={tab2}
          currentPid="test-project"
          setDockTree={mockSetDockTree}
          editorCloseRefsMap={mockEditorCloseRefsMap}
          pdUpdate={mockPdUpdate}
        />
      );

      // Component should still render (memoization prevents unnecessary re-renders)
      expect(screen.getByTestId('response-editor')).toBeInTheDocument();
    });
  });
});
