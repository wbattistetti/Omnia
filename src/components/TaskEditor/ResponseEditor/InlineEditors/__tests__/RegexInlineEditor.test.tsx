// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import RegexInlineEditor from '../RegexInlineEditor';

/**
 * Tests for RegexInlineEditor - Regression Tests
 *
 * This component uses the consolidated useRegex hook.
 * We test observable behaviors: component mounting, hook integration.
 *
 * WHAT WE TEST:
 * - Component mounts without errors
 * - No "Cannot access generatingRegex before initialization" error
 * - useRegex hook is used correctly
 *
 * WHY IT'S IMPORTANT:
 * - Regression test for hook order fix
 * - Ensures consolidation works in component context
 *
 * MOCKS:
 * - All hook dependencies (useRegex, useRegexAIGeneration, etc.)
 * - EditorPanel component
 * - EditorHeader component
 */

// Mock all hooks
vi.mock('@responseEditor/hooks/useRegex', () => ({
  useRegex: vi.fn(() => ({
    baselineRegex: '',
    currentText: '',
    isDirty: false,
    updateBaseline: vi.fn(),
    updateCurrentText: vi.fn(),
    validationResult: null,
    shouldShowValidation: false,
    setShouldShowValidation: vi.fn(),
  })),
}));

vi.mock('@responseEditor/hooks/useRegexAIGeneration', () => ({
  useRegexAIGeneration: vi.fn(() => ({
    generatingRegex: false,
    regexBackup: '',
    generateRegex: vi.fn(),
  })),
}));

vi.mock('@responseEditor/hooks/useRegexButtonMode', () => ({
  useRegexButtonMode: vi.fn(() => ({
    buttonCaption: 'Create code',
    buttonEnabled: false,
    isCreateMode: true,
  })),
}));

vi.mock('@responseEditor/hooks/usePlaceholderSelection', () => ({
  usePlaceholderSelection: vi.fn(() => ({
    editorRef: { current: null },
    hasEverWrittenRef: { current: false },
    selectPlaceholderIfNeeded: vi.fn(),
    markAsWritten: vi.fn(),
    hasEverWritten: vi.fn(() => false),
  })),
}));

vi.mock('@responseEditor/features/step-management/stores/notesStore', () => ({
  useNotesStore: vi.fn(() => ({
    getNote: vi.fn(),
  })),
}));

vi.mock('@responseEditor/testingState', () => ({
  getIsTesting: vi.fn(() => false),
}));

// Mock components
vi.mock('@components/CodeEditor/EditorPanel', () => ({
  default: ({ code, onChange, onEditorMount }: any) => (
    <div data-testid="editor-panel">
      <textarea
        data-testid="editor-textarea"
        value={code}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => onEditorMount?.({ current: null })}
      />
    </div>
  ),
}));

vi.mock('@responseEditor/InlineEditors/shared/EditorHeader', () => ({
  default: ({ title, onClose }: any) => (
    <div data-testid="editor-header">
      <span>{title}</span>
      <button data-testid="close-button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

vi.mock('@responseEditor/utils/regexGroupUtils', () => ({
  generateBaseRegexWithNamedGroups: vi.fn(() => ''),
  generateBaseRegexSimple: vi.fn(() => ''),
}));

vi.mock('@responseEditor/core/domain/nodeStrict', () => ({
  getSubNodesStrict: vi.fn(() => []),
}));

describe('RegexInlineEditor - Regression Tests', () => {
  let mockSetRegex: ReturnType<typeof vi.fn>;
  let mockOnClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetRegex = vi.fn();
    mockOnClose = vi.fn();
  });

  it('should not throw "Cannot access generatingRegex before initialization"', () => {
    expect(() => {
      render(
        <RegexInlineEditor
          regex=""
          setRegex={mockSetRegex}
          onClose={mockOnClose}
        />
      );
    }).not.toThrow();
  });

  it('should mount correctly with minimal props', () => {
    const { getByTestId } = render(
      <RegexInlineEditor
        regex=""
        setRegex={mockSetRegex}
        onClose={mockOnClose}
      />
    );

    expect(getByTestId('editor-panel')).toBeInTheDocument();
    expect(getByTestId('editor-header')).toBeInTheDocument();
  });

  it('should mount correctly with all props', () => {
    const mockNode = {
      id: 'node-1',
      label: 'Test Node',
      subNodes: [{ id: 'sub-1', label: 'Sub 1' }],
    };

    const mockProfile = {
      regex: 'test-regex',
      kind: 'text',
      testCases: ['test case 1'],
    };

    expect(() => {
      render(
        <RegexInlineEditor
          regex="test-regex"
          setRegex={mockSetRegex}
          onClose={mockOnClose}
          node={mockNode}
          kind="text"
          profile={mockProfile}
          testCases={['test case 1']}
          setTestCases={vi.fn()}
          onProfileUpdate={vi.fn()}
          onButtonRender={vi.fn()}
          onErrorRender={vi.fn()}
          examplesList={['example 1']}
          rowResults={[]}
        />
      );
    }).not.toThrow();
  });

  it('should handle close button click', () => {
    const { getByTestId } = render(
      <RegexInlineEditor
        regex=""
        setRegex={mockSetRegex}
        onClose={mockOnClose}
      />
    );

    const closeButton = getByTestId('close-button');
    closeButton.click();

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
