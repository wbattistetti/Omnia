// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResponseEditorContent } from '../ResponseEditorContent';
import type { Task, TaskTree } from '../../../../../types/taskTypes';

// Mock child components
vi.mock('../../ContractWizard/ContractWizard', () => ({
  default: ({ onClose, onNodeUpdate, onComplete }: any) => (
    <div data-testid="contract-wizard">
      <button onClick={onClose}>Close</button>
      <button onClick={() => onNodeUpdate('node-1')}>Update Node</button>
      <button onClick={() => onComplete({})}>Complete</button>
    </div>
  ),
}));

// NOTE: TaskWizard is now external, no need to mock it here

vi.mock('../IntentMessagesBuilder', () => ({
  default: ({ onComplete }: any) => (
    <div data-testid="intent-messages-builder">
      <button onClick={() => onComplete({})}>Complete</button>
    </div>
  ),
}));

/**
 * Tests for ResponseEditorContent
 *
 * This component handles conditional rendering of different content states.
 * We test observable behaviors: conditional rendering, priority of states, and prop passing.
 *
 * WHAT WE TEST:
 * - Renders loading state when isInferring is true
 * - Renders ContractWizard when showContractWizard is true
 * - Renders TaskWizard when showWizard is true
 * - Renders loading state when showWizard is true and shouldShowInferenceLoading is true
 * - Renders IntentMessagesBuilder when needsIntentMessages is true
 * - Renders normalEditorLayout when none of the above conditions are true
 * - Priority of states (isInferring > showContractWizard > showWizard > needsIntentMessages > normalEditorLayout)
 * - Props are passed correctly to child components
 * - Edge cases (null/undefined task, taskTree)
 *
 * WHY IT'S IMPORTANT:
 * - Conditional rendering is critical for UX
 * - Priority of states ensures correct content is shown
 * - Props must be passed correctly to child components
 * - Edge cases must be handled gracefully
 */

describe('ResponseEditorContent', () => {
  let mockTask: Task;
  let mockTaskTree: TaskTree;
  let mockTaskTreeRef: React.MutableRefObject<TaskTree | null | undefined>;
  let mockHandlers: {
    handleContractWizardClose: ReturnType<typeof vi.fn>;
    handleContractWizardNodeUpdate: ReturnType<typeof vi.fn>;
    handleContractWizardComplete: ReturnType<typeof vi.fn>;
    getInitialDDT: ReturnType<typeof vi.fn>;
    onIntentMessagesComplete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockTask = {
      id: 'task-1',
      type: 1,
      label: 'Test Task',
    } as Task;

    mockTaskTree = {
      label: 'Test TaskTree',
      nodes: [],
      steps: {},
    } as TaskTree;

    mockTaskTreeRef = {
      current: mockTaskTree,
    };

    mockHandlers = {
      handleContractWizardClose: vi.fn(),
      handleContractWizardNodeUpdate: vi.fn(),
      handleContractWizardComplete: vi.fn(),
      getInitialDDT: vi.fn(() => mockTaskTree),
      onIntentMessagesComplete: vi.fn(),
    };
  });

  // NOTE: Loading state (isInferring) and TaskWizard tests removed - TaskWizard is now external

  describe('Contract Wizard', () => {
    it('should render ContractWizard when showContractWizard is true', () => {
      render(
        <ResponseEditorContent
          showContractWizard={true}
          needsIntentMessages={false}
          task={mockTask}
          taskTree={mockTaskTree}
          taskTreeRef={mockTaskTreeRef}
          {...mockHandlers}
          normalEditorLayout={<div data-testid="normal-layout">Normal Layout</div>}
        />
      );

      expect(screen.getByTestId('contract-wizard')).toBeInTheDocument();
      expect(screen.queryByTestId('intent-messages-builder')).not.toBeInTheDocument();
      expect(screen.queryByTestId('normal-layout')).not.toBeInTheDocument();
    });

    it('should prioritize showContractWizard over showWizard and needsIntentMessages', () => {
      render(
        <ResponseEditorContent
          isInferring={false}
          showContractWizard={true}
          showWizard={true}
          shouldShowInferenceLoading={false}
          needsIntentMessages={true}
          task={mockTask}
          taskTree={mockTaskTree}
          taskTreeRef={mockTaskTreeRef}
          {...mockHandlers}
          normalEditorLayout={<div data-testid="normal-layout">Normal Layout</div>}
        />
      );

      expect(screen.getByTestId('contract-wizard')).toBeInTheDocument();
      expect(screen.queryByTestId('intent-messages-builder')).not.toBeInTheDocument();
    });
  });

  describe('Task Wizard', () => {
    it('should render loading state when showWizard is true and shouldShowInferenceLoading is true', () => {
      render(
        <ResponseEditorContent
          isInferring={false}
          showContractWizard={false}
          showWizard={true}
          shouldShowInferenceLoading={true}
          needsIntentMessages={false}
          task={mockTask}
          taskTree={mockTaskTree}
          taskTreeRef={mockTaskTreeRef}
          {...mockHandlers}
          normalEditorLayout={<div data-testid="normal-layout">Normal Layout</div>}
        />
      );

      expect(screen.getByText(/Sto cercando se ho già un modello/i)).toBeInTheDocument();
    });

    it('should render TaskWizard when showWizard is true and shouldShowInferenceLoading is false', () => {
      render(
        <ResponseEditorContent
          isInferring={false}
          showContractWizard={false}
          showWizard={true}
          shouldShowInferenceLoading={false}
          needsIntentMessages={false}
          task={mockTask}
          taskTree={mockTaskTree}
          taskTreeRef={mockTaskTreeRef}
          {...mockHandlers}
          normalEditorLayout={<div data-testid="normal-layout">Normal Layout</div>}
        />
      );

      expect(screen.getByTestId('task-wizard')).toBeInTheDocument();
      expect(screen.queryByTestId('contract-wizard')).not.toBeInTheDocument();
      expect(screen.queryByTestId('intent-messages-builder')).not.toBeInTheDocument();
      expect(screen.queryByTestId('normal-layout')).not.toBeInTheDocument();
    });

    it('should prioritize showWizard over needsIntentMessages', () => {
      render(
        <ResponseEditorContent
          isInferring={false}
          showContractWizard={false}
          showWizard={true}
          shouldShowInferenceLoading={false}
          needsIntentMessages={true}
          task={mockTask}
          taskTree={mockTaskTree}
          taskTreeRef={mockTaskTreeRef}
          {...mockHandlers}
          normalEditorLayout={<div data-testid="normal-layout">Normal Layout</div>}
        />
      );

      expect(screen.getByTestId('task-wizard')).toBeInTheDocument();
      expect(screen.queryByTestId('intent-messages-builder')).not.toBeInTheDocument();
    });
  });

  describe('Intent Messages Builder', () => {
    it('should render IntentMessagesBuilder when needsIntentMessages is true', () => {
      render(
        <ResponseEditorContent
          showContractWizard={false}
          needsIntentMessages={true}
          task={mockTask}
          taskTree={mockTaskTree}
          taskTreeRef={mockTaskTreeRef}
          {...mockHandlers}
          normalEditorLayout={<div data-testid="normal-layout">Normal Layout</div>}
        />
      );

      expect(screen.getByTestId('intent-messages-builder')).toBeInTheDocument();
      expect(screen.queryByTestId('contract-wizard')).not.toBeInTheDocument();
      expect(screen.queryByTestId('normal-layout')).not.toBeInTheDocument();
    });
  });

  describe('normal editor layout', () => {
    it('should render normalEditorLayout when none of the conditions are true', () => {
      render(
        <ResponseEditorContent
          showContractWizard={false}
          needsIntentMessages={false}
          task={mockTask}
          taskTree={mockTaskTree}
          taskTreeRef={mockTaskTreeRef}
          {...mockHandlers}
          normalEditorLayout={<div data-testid="normal-layout">Normal Layout</div>}
        />
      );

      expect(screen.getByTestId('normal-layout')).toBeInTheDocument();
      expect(screen.queryByTestId('contract-wizard')).not.toBeInTheDocument();
      expect(screen.queryByTestId('intent-messages-builder')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle null task', () => {
      render(
        <ResponseEditorContent
          showContractWizard={false}
          needsIntentMessages={false}
          task={null}
          taskTree={mockTaskTree}
          taskTreeRef={mockTaskTreeRef}
          {...mockHandlers}
          normalEditorLayout={<div data-testid="normal-layout">Normal Layout</div>}
        />
      );

      expect(screen.getByTestId('normal-layout')).toBeInTheDocument();
    });

    it('should handle undefined task', () => {
      render(
        <ResponseEditorContent
          showContractWizard={false}
          needsIntentMessages={false}
          task={undefined}
          taskTree={mockTaskTree}
          taskTreeRef={mockTaskTreeRef}
          {...mockHandlers}
          normalEditorLayout={<div data-testid="normal-layout">Normal Layout</div>}
        />
      );

      expect(screen.getByTestId('normal-layout')).toBeInTheDocument();
    });

    it('should handle null taskTree', () => {
      render(
        <ResponseEditorContent
          showContractWizard={false}
          needsIntentMessages={false}
          task={mockTask}
          taskTree={null}
          taskTreeRef={mockTaskTreeRef}
          {...mockHandlers}
          normalEditorLayout={<div data-testid="normal-layout">Normal Layout</div>}
        />
      );

      expect(screen.getByTestId('normal-layout')).toBeInTheDocument();
    });

    it('should handle undefined taskTree', () => {
      render(
        <ResponseEditorContent
          showContractWizard={false}
          needsIntentMessages={false}
          task={mockTask}
          taskTree={undefined}
          taskTreeRef={mockTaskTreeRef}
          {...mockHandlers}
          normalEditorLayout={<div data-testid="normal-layout">Normal Layout</div>}
        />
      );

      expect(screen.getByTestId('normal-layout')).toBeInTheDocument();
    });

    it('should handle null taskTreeRef.current', () => {
      const nullTaskTreeRef = {
        current: null,
      };

      render(
        <ResponseEditorContent
          showContractWizard={true}
          needsIntentMessages={false}
          task={mockTask}
          taskTree={mockTaskTree}
          taskTreeRef={nullTaskTreeRef}
          {...mockHandlers}
          normalEditorLayout={<div data-testid="normal-layout">Normal Layout</div>}
        />
      );

      expect(screen.getByTestId('contract-wizard')).toBeInTheDocument();
    });
  });
});
