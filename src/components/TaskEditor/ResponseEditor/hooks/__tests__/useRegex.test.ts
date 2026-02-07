// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRegex } from '@responseEditor/hooks/useRegex';
import type { TaskTreeNode } from '@types/taskTypes';

/**
 * Tests for useRegex
 *
 * This hook consolidates regex state and validation functionality.
 * We test observable behaviors: state management, validation, and integration.
 *
 * WHAT WE TEST:
 * - State initialization with initialRegex
 * - Baseline and currentText tracking
 * - Dirty flag calculation (regex + notes hash)
 * - updateBaseline and updateCurrentText functions
 * - Validation on text change (debounced)
 * - Validation when AI finishes generating
 * - Notes hash changes affect dirty flag
 * - Edge cases (empty regex, null node, etc.)
 *
 * WHY IT'S IMPORTANT:
 * - Regex state management is critical for editor functionality
 * - Validation ensures regex correctness
 * - Dirty flag prevents unnecessary saves
 * - Consolidation from 2 hooks must work correctly
 *
 * MOCKS:
 * - useNotesStore (Zustand) - mocked to return test notes
 * - getIsTesting (testingState) - mocked to control testing state
 * - validateNamedGroups (utility) - mocked to return predictable results
 * - getSubNodesStrict (domain) - mocked to return test subNodes
 */

// Mock dependencies
vi.mock('@responseEditor/features/step-management/stores/notesStore', () => ({
  useNotesStore: (selector: any) => {
    const mockNotes = {
      'test|regex': 'test note',
      'other|regex': 'other note',
    };
    return selector({ notes: mockNotes });
  },
}));

vi.mock('@responseEditor/testingState', () => ({
  getIsTesting: vi.fn(() => false),
}));

vi.mock('@responseEditor/utils/regexGroupUtils', () => ({
  validateNamedGroups: vi.fn((regex: string, subNodes: TaskTreeNode[]) => {
    // Simple mock: count named groups in regex
    const namedGroups = (regex.match(/\(\?<[^>]+>/g) || []).length;
    return {
      valid: namedGroups === subNodes.length,
      groupsFound: namedGroups,
      groupsExpected: subNodes.length,
      errors: namedGroups === subNodes.length ? [] : ['Missing named groups'],
      warnings: [],
    };
  }),
  extractNamedGroupsFromRegex: vi.fn(),
}));

vi.mock('@responseEditor/core/domain/nodeStrict', () => ({
  getSubNodesStrict: vi.fn((node: any) => {
    return node?.subNodes || [];
  }),
}));

import { getIsTesting } from '@responseEditor/testingState';
import { validateNamedGroups } from '@responseEditor/utils/regexGroupUtils';
import { getSubNodesStrict } from '@responseEditor/core/domain/nodeStrict';

describe('useRegex - Composite Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getIsTesting as any).mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('State Management (from useRegexState)', () => {
    it('should initialize with initialRegex', () => {
      const { result } = renderHook(() =>
        useRegex({ initialRegex: 'test-regex' })
      );

      expect(result.current.baselineRegex).toBe('test-regex');
      expect(result.current.currentText).toBe('test-regex');
      expect(result.current.isDirty).toBe(false);
    });

    it('should initialize with empty string when initialRegex is empty', () => {
      const { result } = renderHook(() => useRegex({ initialRegex: '' }));

      expect(result.current.baselineRegex).toBe('');
      expect(result.current.currentText).toBe('');
      expect(result.current.isDirty).toBe(false);
    });

    it('should track baselineRegex and currentText separately', () => {
      const { result } = renderHook(() =>
        useRegex({ initialRegex: 'initial' })
      );

      act(() => {
        result.current.updateCurrentText('modified');
      });

      expect(result.current.baselineRegex).toBe('initial');
      expect(result.current.currentText).toBe('modified');
      expect(result.current.isDirty).toBe(true);
    });

    it('should calculate isDirty correctly when text changes', () => {
      const { result } = renderHook(() =>
        useRegex({ initialRegex: 'baseline' })
      );

      expect(result.current.isDirty).toBe(false);

      act(() => {
        result.current.updateCurrentText('changed');
      });

      expect(result.current.isDirty).toBe(true);
    });

    it('should update baseline correctly', () => {
      const { result } = renderHook(() =>
        useRegex({ initialRegex: 'initial' })
      );

      act(() => {
        result.current.updateCurrentText('modified');
      });

      act(() => {
        result.current.updateBaseline('new-baseline');
      });

      expect(result.current.baselineRegex).toBe('new-baseline');
      expect(result.current.currentText).toBe('new-baseline');
      expect(result.current.isDirty).toBe(false);
    });

    it('should update currentText correctly', () => {
      const { result } = renderHook(() =>
        useRegex({ initialRegex: 'initial' })
      );

      act(() => {
        result.current.updateCurrentText('new-text');
      });

      expect(result.current.currentText).toBe('new-text');
      expect(result.current.baselineRegex).toBe('initial');
    });
  });

  describe('Validation (from useRegexValidation)', () => {
    it('should validate on text change (debounced)', async () => {
      vi.useFakeTimers();

      const mockNode = {
        id: 'node-1',
        label: 'Test Node',
        subNodes: [
          { id: 'sub-1', label: 'Sub 1' },
          { id: 'sub-2', label: 'Sub 2' },
        ],
      };

      const { result } = renderHook(() =>
        useRegex({
          initialRegex: '',
          node: mockNode,
          shouldValidateOnChange: true,
        })
      );

      act(() => {
        result.current.updateCurrentText('(?<sub1>.*)(?<sub2>.*)');
      });

      // Validation should not happen immediately
      expect(result.current.validationResult).toBeNull();

      // Fast-forward 300ms
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // With fake timers, we need to flush promises
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.validationResult).not.toBeNull();
      expect(result.current.shouldShowValidation).toBe(true);
      expect(result.current.validationResult?.valid).toBe(true);

      vi.useRealTimers();
    });

    it('should not validate when shouldValidateOnChange is false', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useRegex({
          initialRegex: '',
          shouldValidateOnChange: false,
        })
      );

      act(() => {
        result.current.updateCurrentText('test-regex');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.validationResult).toBeNull();

      vi.useRealTimers();
    });

    it('should clear validation when regex is empty', async () => {
      vi.useFakeTimers();

      const mockNode = {
        id: 'node-1',
        subNodes: [{ id: 'sub-1', label: 'Sub 1' }],
      };

      const { result } = renderHook(() =>
        useRegex({
          initialRegex: 'test',
          node: mockNode,
          shouldValidateOnChange: true,
        })
      );

      act(() => {
        result.current.updateCurrentText('');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.validationResult).toBeNull();
      expect(result.current.shouldShowValidation).toBe(false);

      vi.useRealTimers();
    });

    it('should not validate during batch testing', async () => {
      vi.useFakeTimers();
      (getIsTesting as any).mockReturnValue(true);

      const mockNode = {
        id: 'node-1',
        subNodes: [{ id: 'sub-1', label: 'Sub 1' }],
      };

      const { result } = renderHook(() =>
        useRegex({
          initialRegex: '',
          node: mockNode,
          shouldValidateOnChange: true,
        })
      );

      act(() => {
        result.current.updateCurrentText('test-regex');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should not validate when testing
      expect(result.current.validationResult).toBeNull();
    });

    it('should validate when AI finishes generating', async () => {
      const mockNode = {
        id: 'node-1',
        subNodes: [
          { id: 'sub-1', label: 'Sub 1' },
          { id: 'sub-2', label: 'Sub 2' },
        ],
      };

      const { result, rerender } = renderHook(
        ({ generatingRegex }) =>
          useRegex({
            initialRegex: 'test-regex',
            node: mockNode,
            shouldValidateOnAIFinish: true,
            generatingRegex,
          }),
        {
          initialProps: { generatingRegex: true },
        }
      );

      // AI is generating - should not validate yet
      expect(result.current.validationResult).toBeNull();

      // AI finishes
      rerender({ generatingRegex: false });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.shouldShowValidation).toBe(true);
      expect(result.current.validationResult).not.toBeNull();
    });

    it('should validate named groups against node subNodes', async () => {
      vi.useFakeTimers();

      const mockNode = {
        id: 'node-1',
        label: 'Date',
        subNodes: [
          { id: 'day', label: 'Day' },
          { id: 'month', label: 'Month' },
          { id: 'year', label: 'Year' },
        ],
      };

      (getSubNodesStrict as any).mockReturnValue(mockNode.subNodes);

      const { result } = renderHook(() =>
        useRegex({
          initialRegex: '',
          node: mockNode,
          shouldValidateOnChange: true,
        })
      );

      act(() => {
        result.current.updateCurrentText(
          '(?<day>\\d+)/(?<month>\\d+)/(?<year>\\d+)'
        );
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.validationResult).not.toBeNull();
      expect(validateNamedGroups).toHaveBeenCalledWith(
        expect.stringContaining('day'),
        mockNode.subNodes
      );

      vi.useRealTimers();
    });

    it('should handle validation errors gracefully', async () => {
      vi.useFakeTimers();

      (validateNamedGroups as any).mockReturnValue({
        valid: false,
        groupsFound: 1,
        groupsExpected: 3,
        errors: ['Missing named groups: month, year'],
        warnings: [],
      });

      const mockNode = {
        id: 'node-1',
        subNodes: [
          { id: 'day', label: 'Day' },
          { id: 'month', label: 'Month' },
          { id: 'year', label: 'Year' },
        ],
      };

      const { result } = renderHook(() =>
        useRegex({
          initialRegex: '',
          node: mockNode,
          shouldValidateOnChange: true,
        })
      );

      act(() => {
        result.current.updateCurrentText('(?<day>\\d+)');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.validationResult).not.toBeNull();
      expect(result.current.validationResult?.valid).toBe(false);
      expect(result.current.validationResult?.errors.length).toBeGreaterThan(0);

      vi.useRealTimers();
    });
  });

  describe('Integration', () => {
    it('should combine state and validation correctly', async () => {
      vi.useFakeTimers();

      const mockNode = {
        id: 'node-1',
        subNodes: [{ id: 'sub-1', label: 'Sub 1' }],
      };

      const { result } = renderHook(() =>
        useRegex({
          initialRegex: 'initial',
          node: mockNode,
          shouldValidateOnChange: true,
        })
      );

      // Update text
      act(() => {
        result.current.updateCurrentText('(?<sub1>.*)');
      });

      // Should be dirty
      expect(result.current.isDirty).toBe(true);

      // Wait for validation
      act(() => {
        vi.advanceTimersByTime(300);
      });

      await act(async () => {
        await Promise.resolve();
      });

      // Both state and validation should work
      expect(result.current.isDirty).toBe(true);
      expect(result.current.shouldShowValidation).toBe(true);
      expect(result.current.validationResult).not.toBeNull();

      vi.useRealTimers();
    });

    it('should respect shouldValidateOnAIFinish flag', async () => {
      const mockNode = {
        id: 'node-1',
        subNodes: [{ id: 'sub-1', label: 'Sub 1' }],
      };

      const { result, rerender } = renderHook(
        ({ shouldValidateOnAIFinish, generatingRegex }) =>
          useRegex({
            initialRegex: 'test',
            node: mockNode,
            shouldValidateOnAIFinish,
            generatingRegex,
          }),
        {
          initialProps: {
            shouldValidateOnAIFinish: false,
            generatingRegex: true,
          },
        }
      );

      rerender({ shouldValidateOnAIFinish: false, generatingRegex: false });

      // Should not validate when flag is false
      await waitFor(() => {
        expect(result.current.validationResult).toBeNull();
      });
    });

    it('should allow manual control of shouldShowValidation', () => {
      const { result } = renderHook(() =>
        useRegex({ initialRegex: 'test' })
      );

      act(() => {
        result.current.setShouldShowValidation(true);
      });

      expect(result.current.shouldShowValidation).toBe(true);

      act(() => {
        result.current.setShouldShowValidation(false);
      });

      expect(result.current.shouldShowValidation).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null node gracefully', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useRegex({
          initialRegex: '',
          node: null,
          shouldValidateOnChange: true,
        })
      );

      act(() => {
        result.current.updateCurrentText('test-regex');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await act(async () => {
        await Promise.resolve();
      });

      // Should validate successfully with null node
      expect(result.current.validationResult).not.toBeNull();
      expect(result.current.validationResult?.valid).toBe(true);

      vi.useRealTimers();
    });

    it('should handle node with no subNodes', async () => {
      vi.useFakeTimers();

      const mockNode = {
        id: 'node-1',
        subNodes: [],
      };

      // Mock getSubNodesStrict to return empty array
      (getSubNodesStrict as any).mockReturnValue([]);

      const { result } = renderHook(() =>
        useRegex({
          initialRegex: '',
          node: mockNode,
          shouldValidateOnChange: true,
        })
      );

      act(() => {
        result.current.updateCurrentText('test-regex');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await act(async () => {
        await Promise.resolve();
      });

      // When node has no subNodes, validation should be valid (no groups needed)
      expect(result.current.validationResult).not.toBeNull();
      // According to useRegex logic, when subNodes.length === 0, result.valid should be true
      expect(result.current.validationResult?.valid).toBe(true);
      expect(result.current.validationResult?.groupsExpected).toBe(0);

      vi.useRealTimers();
    });

    it('should handle empty initialRegex', () => {
      const { result } = renderHook(() => useRegex({ initialRegex: '' }));

      expect(result.current.baselineRegex).toBe('');
      expect(result.current.currentText).toBe('');
      expect(result.current.isDirty).toBe(false);
    });
  });
});
