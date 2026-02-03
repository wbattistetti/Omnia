// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProfileUpdate } from '../useProfileUpdate';

/**
 * Tests for useProfileUpdate
 *
 * This hook provides handleProfileUpdate function for updating NLP profile.
 * We test observable behaviors: profile updates, override saving, and batch testing blocking.
 *
 * WHAT WE TEST:
 * - Updating nlpProfile with partialProfile
 * - Saving overrides in nlpContract
 * - Blocking updates during batch testing
 * - Updating node via updateSelectedNode
 * - Edge cases (null/undefined node, missing nlpProfile, batch testing active)
 * - All profile fields (regex, synonyms, kind, examples, testCases, formatHints, minConfidence, postProcess, waitingEsc1, waitingEsc2)
 *
 * WHY IT'S IMPORTANT:
 * - Profile updates are critical for NLP configuration
 * - Override saving in nlpContract ensures user changes persist
 * - Batch testing blocking prevents infinite re-render loops
 * - Incorrect profile updates can break extraction logic
 *
 * MOCKS:
 * - getIsTesting (testingState) - mocked to control batch testing state
 * - updateSelectedNode - mocked to verify calls and capture updater function
 */

// Mock testingState
vi.mock('../../testingState', () => ({
  getIsTesting: vi.fn(() => false),
}));

import { getIsTesting } from '../../testingState';

describe('useProfileUpdate', () => {
  let updateSelectedNode: ReturnType<typeof vi.fn>;
  let capturedUpdater: ((prev: any) => any) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedUpdater = null;
    updateSelectedNode = vi.fn((updater: (prev: any) => any, notifyProvider?: boolean) => {
      capturedUpdater = updater;
    });
    (getIsTesting as any).mockReturnValue(false);
  });

  describe('nlpProfile updates', () => {
    it('should update nlpProfile with partialProfile', () => {
      const node = {
        id: 'node-1',
        nlpProfile: {
          regex: 'old-regex',
          kind: 'date',
        },
      };

      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      act(() => {
        result.current({ regex: 'new-regex', kind: 'dateOfBirth' });
      });

      expect(updateSelectedNode).toHaveBeenCalledTimes(1);
      expect(updateSelectedNode).toHaveBeenCalledWith(expect.any(Function), true);

      const updated = capturedUpdater!(node);

      expect(updated.nlpProfile.regex).toBe('new-regex');
      expect(updated.nlpProfile.kind).toBe('dateOfBirth');
    });

    it('should merge partialProfile with existing nlpProfile', () => {
      const node = {
        id: 'node-1',
        nlpProfile: {
          regex: 'existing-regex',
          kind: 'date',
          synonyms: 'existing-synonyms',
        },
      };

      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      act(() => {
        result.current({ regex: 'updated-regex' });
      });

      const updated = capturedUpdater!(node);

      expect(updated.nlpProfile.regex).toBe('updated-regex');
      expect(updated.nlpProfile.kind).toBe('date'); // Preserved
      expect(updated.nlpProfile.synonyms).toBe('existing-synonyms'); // Preserved
    });

    it('should create nlpProfile if it does not exist', () => {
      const node = {
        id: 'node-1',
        // nlpProfile is missing
      };

      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      act(() => {
        result.current({ regex: 'new-regex' });
      });

      const updated = capturedUpdater!(node);

      expect(updated.nlpProfile).toBeDefined();
      expect(updated.nlpProfile.regex).toBe('new-regex');
    });
  });

  describe('nlpContract override saving', () => {
    it('should save overrides in nlpContract', () => {
      const node = {
        id: 'node-1',
        nlpProfile: { regex: 'profile-regex' },
        nlpContract: { kind: 'existing-kind' },
      };

      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      act(() => {
        result.current({ regex: 'override-regex', kind: 'new-kind' });
      });

      const updated = capturedUpdater!(node);

      expect(updated.nlpContract.regex).toBe('override-regex');
      expect(updated.nlpContract.kind).toBe('new-kind');
    });

    it('should create nlpContract if it does not exist', () => {
      const node = {
        id: 'node-1',
        nlpProfile: { regex: 'profile-regex' },
        // nlpContract is missing
      };

      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      act(() => {
        result.current({ regex: 'override-regex' });
      });

      const updated = capturedUpdater!(node);

      expect(updated.nlpContract).toBeDefined();
      expect(updated.nlpContract.regex).toBe('override-regex');
    });

    it('should preserve existing nlpContract values when partialProfile does not include them', () => {
      const node = {
        id: 'node-1',
        nlpProfile: { regex: 'profile-regex', kind: 'date' },
        nlpContract: {
          regex: 'existing-contract-regex',
          kind: 'existing-contract-kind',
        },
      };

      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      act(() => {
        result.current({ synonyms: 'new-synonyms' });
      });

      const updated = capturedUpdater!(node);

      // regex should be preserved from nlpContract (not in partialProfile)
      expect(updated.nlpContract.regex).toBe('existing-contract-regex');
      // kind should be preserved from nlpContract (not in partialProfile)
      expect(updated.nlpContract.kind).toBe('existing-contract-kind');
      // synonyms should be new
      expect(updated.nlpContract.synonyms).toBe('new-synonyms');
    });

    it('should handle all profile fields in nlpContract', () => {
      const node = {
        id: 'node-1',
        nlpProfile: {},
        nlpContract: {},
      };

      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      const partialProfile = {
        regex: 'test-regex',
        synonyms: 'test-synonyms',
        kind: 'date',
        examples: ['example1', 'example2'],
        testCases: [{ input: 'test', expected: 'result' }],
        formatHints: 'format-hint',
        minConfidence: 0.8,
        postProcess: 'post-process',
        waitingEsc1: true,
        waitingEsc2: false,
      };

      act(() => {
        result.current(partialProfile);
      });

      const updated = capturedUpdater!(node);

      expect(updated.nlpContract.regex).toBe('test-regex');
      expect(updated.nlpContract.synonyms).toBe('test-synonyms');
      expect(updated.nlpContract.kind).toBe('date');
      expect(updated.nlpContract.examples).toEqual(['example1', 'example2']);
      expect(updated.nlpContract.testCases).toEqual([{ input: 'test', expected: 'result' }]);
      expect(updated.nlpContract.formatHints).toBe('format-hint');
      expect(updated.nlpContract.minConfidence).toBe(0.8);
      expect(updated.nlpContract.postProcess).toBe('post-process');
      expect(updated.nlpContract.waitingEsc1).toBe(true);
      expect(updated.nlpContract.waitingEsc2).toBe(false);
    });

    it('should handle undefined values in partialProfile (preserve existing)', () => {
      const node = {
        id: 'node-1',
        nlpProfile: { regex: 'profile-regex' },
        nlpContract: {
          regex: 'contract-regex',
          synonyms: 'contract-synonyms',
        },
      };

      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      act(() => {
        result.current({ kind: 'date' }); // regex and synonyms are undefined
      });

      const updated = capturedUpdater!(node);

      // regex should be preserved from nlpContract (undefined in partialProfile)
      expect(updated.nlpContract.regex).toBe('contract-regex');
      // synonyms should be preserved from nlpContract (undefined in partialProfile)
      expect(updated.nlpContract.synonyms).toBe('contract-synonyms');
      // kind should be new
      expect(updated.nlpContract.kind).toBe('date');
    });
  });

  describe('batch testing blocking', () => {
    it('should block updates when batch testing is active', () => {
      (getIsTesting as any).mockReturnValue(true);
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      act(() => {
        result.current({ regex: 'new-regex' });
      });

      expect(updateSelectedNode).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('[handleProfileUpdate] Blocked: batch testing active');

      consoleLogSpy.mockRestore();
    });

    it('should allow updates when batch testing is not active', () => {
      (getIsTesting as any).mockReturnValue(false);

      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      act(() => {
        result.current({ regex: 'new-regex' });
      });

      expect(updateSelectedNode).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateSelectedNode integration', () => {
    it('should call updateSelectedNode with notifyProvider=true', () => {
      const node = {
        id: 'node-1',
        nlpProfile: {},
      };

      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      act(() => {
        result.current({ regex: 'new-regex' });
      });

      expect(updateSelectedNode).toHaveBeenCalledWith(expect.any(Function), true);
    });

    it('should pass updater function that handles null node', () => {
      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      act(() => {
        result.current({ regex: 'new-regex' });
      });

      const updated = capturedUpdater!(null);

      expect(updated).toBeNull();
    });

    it('should pass updater function that handles undefined node', () => {
      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      act(() => {
        result.current({ regex: 'new-regex' });
      });

      const updated = capturedUpdater!(undefined);

      expect(updated).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty partialProfile', () => {
      const node = {
        id: 'node-1',
        nlpProfile: { regex: 'existing-regex' },
        nlpContract: { regex: 'existing-contract-regex' },
      };

      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      act(() => {
        result.current({});
      });

      const updated = capturedUpdater!(node);

      // Should preserve existing values
      expect(updated.nlpProfile.regex).toBe('existing-regex');
      expect(updated.nlpContract.regex).toBe('existing-contract-regex');
    });

    it('should handle node with only id (no nlpProfile or nlpContract)', () => {
      const node = {
        id: 'node-1',
      };

      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      act(() => {
        result.current({ regex: 'new-regex' });
      });

      const updated = capturedUpdater!(node);

      expect(updated.nlpProfile).toBeDefined();
      expect(updated.nlpProfile.regex).toBe('new-regex');
      expect(updated.nlpContract).toBeDefined();
      expect(updated.nlpContract.regex).toBe('new-regex');
    });

    it('should handle partialProfile with null values', () => {
      const node = {
        id: 'node-1',
        nlpProfile: { regex: 'existing-regex' },
        nlpContract: { regex: 'existing-contract-regex' },
      };

      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      act(() => {
        result.current({ regex: null as any, kind: 'date' });
      });

      const updated = capturedUpdater!(node);

      // null should be treated as a value (not undefined)
      expect(updated.nlpProfile.regex).toBeNull();
      expect(updated.nlpContract.regex).toBeNull();
      expect(updated.nlpProfile.kind).toBe('date');
      expect(updated.nlpContract.kind).toBe('date');
    });

    it('should preserve other node properties', () => {
      const node = {
        id: 'node-1',
        label: 'Node Label',
        templateId: 'template-1',
        nlpProfile: { regex: 'existing-regex' },
      };

      const { result } = renderHook(() =>
        useProfileUpdate({
          updateSelectedNode,
        })
      );

      act(() => {
        result.current({ kind: 'date' });
      });

      const updated = capturedUpdater!(node);

      expect(updated.id).toBe('node-1');
      expect(updated.label).toBe('Node Label');
      expect(updated.templateId).toBe('template-1');
      expect(updated.nlpProfile.regex).toBe('existing-regex');
      expect(updated.nlpProfile.kind).toBe('date');
    });
  });

  describe('callback stability', () => {
    it('should return stable callback when updateSelectedNode does not change', () => {
      const { result, rerender } = renderHook(
        ({ updateSelectedNode }) =>
          useProfileUpdate({
            updateSelectedNode,
          }),
        {
          initialProps: { updateSelectedNode },
        }
      );

      const firstCallback = result.current;

      rerender({ updateSelectedNode });

      expect(result.current).toBe(firstCallback);
    });

    it('should return new callback when updateSelectedNode changes', () => {
      const updateSelectedNode1 = vi.fn();
      const updateSelectedNode2 = vi.fn();

      const { result, rerender } = renderHook(
        ({ updateSelectedNode }) =>
          useProfileUpdate({
            updateSelectedNode,
          }),
        {
          initialProps: { updateSelectedNode: updateSelectedNode1 },
        }
      );

      const firstCallback = result.current;

      rerender({ updateSelectedNode: updateSelectedNode2 });

      expect(result.current).not.toBe(firstCallback);
    });
  });
});
