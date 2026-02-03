// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContractUpdateDialog } from '../useContractUpdateDialog';

/**
 * Tests for useContractUpdateDialog
 *
 * This hook provides handlers for ContractUpdateDialog (handleKeep, handleDiscard, handleCancel).
 * We test observable behaviors: dialog closing, contract restoration, tab closing, and ref updates.
 *
 * WHAT WE TEST:
 * - handleKeep: closes dialog, resets pendingContractChange, resets contractChangeRef, closes tab
 * - handleDiscard: restores original contract, closes dialog, resets pendingContractChange, resets contractChangeRef, closes tab
 * - handleCancel: closes dialog, resets pendingContractChange, does NOT reset contractChangeRef
 * - Edge cases (pendingContractChange null, tabId/setDockTree not available, onClose fallback)
 *
 * WHY IT'S IMPORTANT:
 * - Contract update dialog is critical for handling unsaved contract changes
 * - Incorrect handling can lead to data loss or inconsistent state
 * - Tab closing integration is essential for proper editor lifecycle
 * - Contract restoration must work correctly to prevent data corruption
 *
 * MOCKS:
 * - DialogueTaskService.getTemplate, clearModifiedTemplate - mocked to control template state
 * - mapNode, closeTab (dock/ops) - mocked to verify tab closing
 */

// Mock DialogueTaskService
vi.mock('../../../../../services/DialogueTaskService', () => ({
  default: {
    getTemplate: vi.fn(),
    clearModifiedTemplate: vi.fn(),
  },
}));

// Mock dock/ops
vi.mock('../../../../../dock/ops', () => ({
  mapNode: vi.fn(),
  closeTab: vi.fn((prev: any, tabId: string) => ({ ...prev, closedTab: tabId })),
}));

import DialogueTaskService from '../../../../../services/DialogueTaskService';
import { closeTab } from '../../../../../dock/ops';

describe('useContractUpdateDialog', () => {
  let setShowContractDialog: ReturnType<typeof vi.fn>;
  let setPendingContractChange: ReturnType<typeof vi.fn>;
  let contractChangeRef: React.MutableRefObject<{
    hasUnsavedChanges: boolean;
    modifiedContract: any;
    originalContract: any;
    nodeTemplateId: string | undefined;
    nodeLabel: string | undefined;
  }>;
  let setDockTree: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setShowContractDialog = vi.fn();
    setPendingContractChange = vi.fn();
    contractChangeRef = {
      current: {
        hasUnsavedChanges: true,
        modifiedContract: { type: 'modified' },
        originalContract: { type: 'original' },
        nodeTemplateId: 'template-1',
        nodeLabel: 'Node Label',
      },
    };
    setDockTree = vi.fn((updater: (prev: any) => any) => {
      const prev = { tabs: [] };
      updater(prev);
    });
    onClose = vi.fn();
    (DialogueTaskService.getTemplate as any).mockReturnValue(null);
    (DialogueTaskService.clearModifiedTemplate as any).mockImplementation(() => {});
  });

  describe('handleKeep', () => {
    it('should close dialog and reset pendingContractChange', () => {
      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        })
      );

      act(() => {
        result.current.handleKeep();
      });

      expect(setShowContractDialog).toHaveBeenCalledWith(false);
      expect(setPendingContractChange).toHaveBeenCalledWith(null);
    });

    it('should reset contractChangeRef', () => {
      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        })
      );

      act(() => {
        result.current.handleKeep();
      });

      expect(contractChangeRef.current.hasUnsavedChanges).toBe(false);
      expect(contractChangeRef.current.modifiedContract).toBeNull();
      expect(contractChangeRef.current.originalContract).toBeNull();
      expect(contractChangeRef.current.nodeTemplateId).toBeUndefined();
      expect(contractChangeRef.current.nodeLabel).toBeUndefined();
    });

    it('should close tab via setDockTree when tabId and setDockTree are available', () => {
      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        })
      );

      act(() => {
        result.current.handleKeep();
      });

      expect(setDockTree).toHaveBeenCalledWith(expect.any(Function));
      expect(closeTab).toHaveBeenCalledWith(expect.anything(), 'tab-1');
    });

    it('should use onClose fallback when tabId or setDockTree are not available', () => {
      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: undefined,
          setDockTree: undefined,
          onClose,
        })
      );

      act(() => {
        result.current.handleKeep();
      });

      expect(onClose).toHaveBeenCalled();
      expect(setDockTree).not.toHaveBeenCalled();
    });

    it('should prefer setDockTree over onClose when both are available', () => {
      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
          onClose,
        })
      );

      act(() => {
        result.current.handleKeep();
      });

      expect(setDockTree).toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('handleDiscard', () => {
    it('should restore original contract from DialogueTaskService', () => {
      const template = {
        id: 'template-1',
        dataContract: { type: 'current' },
      };
      (DialogueTaskService.getTemplate as any).mockReturnValue(template);

      const originalContract = { type: 'original', fields: ['field1'] };
      contractChangeRef.current.originalContract = originalContract;

      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        })
      );

      act(() => {
        result.current.handleDiscard();
      });

      expect(DialogueTaskService.getTemplate).toHaveBeenCalledWith('template-1');
      expect(template.dataContract).toEqual(originalContract);
    });

    it('should not restore contract when template is not found', () => {
      (DialogueTaskService.getTemplate as any).mockReturnValue(null);

      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        })
      );

      act(() => {
        result.current.handleDiscard();
      });

      expect(DialogueTaskService.getTemplate).toHaveBeenCalledWith('template-1');
      expect(DialogueTaskService.clearModifiedTemplate).not.toHaveBeenCalled();
    });

    it('should not restore contract when originalContract is undefined', () => {
      const template = {
        id: 'template-1',
        dataContract: { type: 'current' },
      };
      (DialogueTaskService.getTemplate as any).mockReturnValue(template);
      contractChangeRef.current.originalContract = undefined;

      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        })
      );

      act(() => {
        result.current.handleDiscard();
      });

      expect(template.dataContract).toEqual({ type: 'current' }); // Unchanged
      expect(DialogueTaskService.clearModifiedTemplate).not.toHaveBeenCalled();
    });

    it('should clear modified template when contract is restored', () => {
      const template = {
        id: 'template-1',
        dataContract: { type: 'current' },
      };
      (DialogueTaskService.getTemplate as any).mockReturnValue(template);
      contractChangeRef.current.originalContract = { type: 'original' };

      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        })
      );

      act(() => {
        result.current.handleDiscard();
      });

      expect(DialogueTaskService.clearModifiedTemplate).toHaveBeenCalledWith('template-1');
    });

    it('should handle null originalContract (restore to null)', () => {
      const template = {
        id: 'template-1',
        dataContract: { type: 'current' },
      };
      (DialogueTaskService.getTemplate as any).mockReturnValue(template);
      contractChangeRef.current.originalContract = null;

      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        })
      );

      act(() => {
        result.current.handleDiscard();
      });

      expect(template.dataContract).toBeNull();
      expect(DialogueTaskService.clearModifiedTemplate).toHaveBeenCalledWith('template-1');
    });

    it('should close dialog and reset pendingContractChange', () => {
      const template = {
        id: 'template-1',
        dataContract: { type: 'current' },
      };
      (DialogueTaskService.getTemplate as any).mockReturnValue(template);
      contractChangeRef.current.originalContract = { type: 'original' };

      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        })
      );

      act(() => {
        result.current.handleDiscard();
      });

      expect(setShowContractDialog).toHaveBeenCalledWith(false);
      expect(setPendingContractChange).toHaveBeenCalledWith(null);
    });

    it('should reset contractChangeRef', () => {
      const template = {
        id: 'template-1',
        dataContract: { type: 'current' },
      };
      (DialogueTaskService.getTemplate as any).mockReturnValue(template);
      contractChangeRef.current.originalContract = { type: 'original' };

      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        })
      );

      act(() => {
        result.current.handleDiscard();
      });

      expect(contractChangeRef.current.hasUnsavedChanges).toBe(false);
      expect(contractChangeRef.current.modifiedContract).toBeNull();
      expect(contractChangeRef.current.originalContract).toBeNull();
      expect(contractChangeRef.current.nodeTemplateId).toBeUndefined();
      expect(contractChangeRef.current.nodeLabel).toBeUndefined();
    });

    it('should close tab via setDockTree when available', () => {
      const template = {
        id: 'template-1',
        dataContract: { type: 'current' },
      };
      (DialogueTaskService.getTemplate as any).mockReturnValue(template);
      contractChangeRef.current.originalContract = { type: 'original' };

      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        })
      );

      act(() => {
        result.current.handleDiscard();
      });

      expect(setDockTree).toHaveBeenCalled();
      expect(closeTab).toHaveBeenCalledWith(expect.anything(), 'tab-1');
    });

    it('should use onClose fallback when tabId or setDockTree are not available', () => {
      const template = {
        id: 'template-1',
        dataContract: { type: 'current' },
      };
      (DialogueTaskService.getTemplate as any).mockReturnValue(template);
      contractChangeRef.current.originalContract = { type: 'original' };

      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: undefined,
          setDockTree: undefined,
          onClose,
        })
      );

      act(() => {
        result.current.handleDiscard();
      });

      expect(onClose).toHaveBeenCalled();
      expect(setDockTree).not.toHaveBeenCalled();
    });
  });

  describe('handleCancel', () => {
    it('should close dialog and reset pendingContractChange', () => {
      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        })
      );

      act(() => {
        result.current.handleCancel();
      });

      expect(setShowContractDialog).toHaveBeenCalledWith(false);
      expect(setPendingContractChange).toHaveBeenCalledWith(null);
    });

    it('should NOT reset contractChangeRef (so dialog can reappear if user tries to close again)', () => {
      const originalRef = { ...contractChangeRef.current };

      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        })
      );

      act(() => {
        result.current.handleCancel();
      });

      // contractChangeRef should remain unchanged
      expect(contractChangeRef.current.hasUnsavedChanges).toBe(originalRef.hasUnsavedChanges);
      expect(contractChangeRef.current.modifiedContract).toEqual(originalRef.modifiedContract);
      expect(contractChangeRef.current.originalContract).toEqual(originalRef.originalContract);
      expect(contractChangeRef.current.nodeTemplateId).toBe(originalRef.nodeTemplateId);
      expect(contractChangeRef.current.nodeLabel).toBe(originalRef.nodeLabel);
    });

    it('should NOT close tab or call onClose', () => {
      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
          onClose,
        })
      );

      act(() => {
        result.current.handleCancel();
      });

      expect(setDockTree).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle null pendingContractChange in handleDiscard', () => {
      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: null,
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        })
      );

      act(() => {
        result.current.handleDiscard();
      });

      expect(DialogueTaskService.getTemplate).toHaveBeenCalledWith('');
      expect(setShowContractDialog).toHaveBeenCalledWith(false);
      expect(setPendingContractChange).toHaveBeenCalledWith(null);
    });

    it('should handle undefined tabId', () => {
      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: undefined,
          setDockTree: undefined,
          onClose,
        })
      );

      act(() => {
        result.current.handleKeep();
      });

      expect(onClose).toHaveBeenCalled();
    });

    it('should handle undefined setDockTree', () => {
      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree: undefined,
          onClose,
        })
      );

      act(() => {
        result.current.handleKeep();
      });

      expect(onClose).toHaveBeenCalled();
    });

    it('should handle missing onClose when tabId and setDockTree are not available', () => {
      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: undefined,
          setDockTree: undefined,
          onClose: undefined,
        })
      );

      // Should not throw
      expect(() => {
        act(() => {
          result.current.handleKeep();
        });
      }).not.toThrow();
    });

    it('should handle deep clone of originalContract in handleDiscard', () => {
      const template = {
        id: 'template-1',
        dataContract: { type: 'current' },
      };
      (DialogueTaskService.getTemplate as any).mockReturnValue(template);
      const originalContract = {
        type: 'original',
        nested: { value: 'test' },
      };
      contractChangeRef.current.originalContract = originalContract;

      const { result } = renderHook(() =>
        useContractUpdateDialog({
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        })
      );

      act(() => {
        result.current.handleDiscard();
      });

      // Should be deep cloned (not same reference)
      expect(template.dataContract).toEqual(originalContract);
      expect(template.dataContract).not.toBe(originalContract);
      if (template.dataContract && typeof template.dataContract === 'object') {
        expect((template.dataContract as any).nested).not.toBe(originalContract.nested);
      }
    });
  });

  describe('callback stability', () => {
    it('should return stable callbacks when dependencies do not change', () => {
      const pendingContractChange = {
        templateId: 'template-1',
        templateLabel: 'Template Label',
        modifiedContract: { type: 'modified' },
      };

      const { result, rerender } = renderHook(
        ({ params }) => useContractUpdateDialog(params),
        {
          initialProps: {
            params: {
              showContractDialog: true,
              setShowContractDialog,
              pendingContractChange,
              setPendingContractChange,
              contractChangeRef,
              tabId: 'tab-1',
              setDockTree,
            },
          },
        }
      );

      const firstHandleKeep = result.current.handleKeep;
      const firstHandleDiscard = result.current.handleDiscard;
      const firstHandleCancel = result.current.handleCancel;

      // Use same object reference for pendingContractChange
      rerender({
        params: {
          showContractDialog: true,
          setShowContractDialog,
          pendingContractChange, // Same reference
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        },
      });

      expect(result.current.handleKeep).toBe(firstHandleKeep);
      expect(result.current.handleDiscard).toBe(firstHandleDiscard);
      expect(result.current.handleCancel).toBe(firstHandleCancel);
    });

    it('should return new callbacks when dependencies change', () => {
      const { result, rerender } = renderHook(
        ({ params }) => useContractUpdateDialog(params),
        {
          initialProps: {
            params: {
              showContractDialog: true,
              setShowContractDialog,
              pendingContractChange: {
                templateId: 'template-1',
                templateLabel: 'Template Label',
                modifiedContract: { type: 'modified' },
              },
              setPendingContractChange,
              contractChangeRef,
              tabId: 'tab-1',
              setDockTree,
            },
          },
        }
      );

      const firstHandleKeep = result.current.handleKeep;

      rerender({
        params: {
          showContractDialog: true,
          setShowContractDialog: vi.fn(), // New function
          pendingContractChange: {
            templateId: 'template-1',
            templateLabel: 'Template Label',
            modifiedContract: { type: 'modified' },
          },
          setPendingContractChange,
          contractChangeRef,
          tabId: 'tab-1',
          setDockTree,
        },
      });

      expect(result.current.handleKeep).not.toBe(firstHandleKeep);
    });
  });
});
