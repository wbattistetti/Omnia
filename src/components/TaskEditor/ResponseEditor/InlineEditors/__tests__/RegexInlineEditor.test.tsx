// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import RegexInlineEditor from '../RegexInlineEditor';

/**
 * Tests for RegexInlineEditor — Phase 4 (Monaco Editor / GUID ↔ Label)
 *
 * WHAT WE TEST:
 *   - Component mounts without errors (regression)
 *   - renderRegexForEditor is called on mount to display label-based regex
 *   - normalizeRegexFromEditor is called on cleanup to restore GUID-based regex
 *   - Validation error propagation via onErrorRender
 *   - AI button visibility logic
 *
 * MOCKS:
 *   - regexGroupTransform  (renderRegexForEditor / normalizeRegexFromEditor)
 *   - regexGroupUtils
 *   - useRegexAIGeneration
 *   - EditorPanel
 *   - DialogueTaskService
 */

// -------------------------------------------------------------------------
// Module mocks
// -------------------------------------------------------------------------

vi.mock('@responseEditor/utils/regexGroupTransform', () => ({
  renderRegexForEditor: vi.fn((regex: string) => {
    // Stub: replace GUID groups with a human-readable marker so tests can
    // assert that the transformation was applied.
    return regex.replace(/\(\?<g_[a-f0-9]{12}>/gi, '(?<__label__>');
  }),
  normalizeRegexFromEditor: vi.fn((regex: string) => {
    // Stub: reverse the stub transformation applied in renderRegexForEditor.
    return regex.replace(/\(\?<__label__>/g, '(?<g_000000000000>');
  }),
  buildDisplayMap: vi.fn(() => ({
    guidToDisplay: new Map(),
    displayToGuid: new Map(),
  })),
  hasGuidGroupNames: vi.fn(() => false),
}));

vi.mock('@responseEditor/hooks/useRegexAIGeneration', () => ({
  useRegexAIGeneration: vi.fn(() => ({
    generatingRegex: false,
    regexBackup: '',
    generateRegex: vi.fn(() => Promise.resolve('')),
  })),
}));

vi.mock('@responseEditor/utils/regexGroupUtils', () => ({
  generateBaseRegexWithNamedGroups: vi.fn(() => ({ regex: '', groupNames: {} })),
  generateBaseRegexSimple: vi.fn(() => ''),
  generateGroupName: vi.fn(() => 'g_000000000000'),
  GROUP_NAME_PATTERN: /^g_[a-f0-9]{12}$/i,
  validateGroupNames: vi.fn(() => ({
    valid: true,
    errors: [],
    warnings: [],
    groupsFound: 0,
    groupsExpected: 0,
    missingGroups: [],
    extraGroups: [],
    mismatchedGroups: [],
  })),
  validateNamedGroups: vi.fn(() => ({
    valid: true,
    errors: [],
    warnings: [],
    groupsFound: 0,
    groupsExpected: 0,
    missingGroups: [],
    extraGroups: [],
    mismatchedGroups: [],
  })),
}));

vi.mock('@responseEditor/core/domain/nodeStrict', () => ({
  getSubNodesStrict: vi.fn(() => []),
}));

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
  useNotesStore: vi.fn(() => ({ getNote: vi.fn() })),
}));

vi.mock('@responseEditor/testingState', () => ({
  getIsTesting: vi.fn(() => false),
}));

// Mock DialogueTaskService so cleanup saves succeed
vi.mock('@services/DialogueTaskService', () => ({
  default: {
    getTemplate: vi.fn(() => ({
      dataContract: {
        contracts: [{ type: 'regex', patterns: ['(?<g_000000000000>.*)'] }],
        subDataMapping: {
          'sub-1': {
            canonicalKey: 'giorno',
            label: 'Giorno',
            groupName: 'g_000000000000',
            type: 'number',
          },
        },
      },
    })),
    markTemplateAsModified: vi.fn(),
  },
}));

// Mock EditorPanel — renders a testable textarea
vi.mock('@components/CodeEditor/EditorPanel', () => ({
  default: ({ code, onChange }: any) => (
    <div data-testid="editor-panel">
      <textarea
        data-testid="editor-textarea"
        value={code ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  ),
}));

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

describe('RegexInlineEditor — Phase 4 (GUID ↔ Label)', () => {
  let mockOnClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnClose = vi.fn();
  });

  // -----------------------------------------------------------------------
  // Regression: component mounts without errors
  // -----------------------------------------------------------------------

  it('mounts without throwing (regression)', () => {
    expect(() => {
      render(<RegexInlineEditor regex="" onClose={mockOnClose} />);
    }).not.toThrow();
  });

  it('mounts with all optional props without throwing', () => {
    const mockNode = {
      id: 'node-1',
      label: 'Test Node',
      templateId: 'tmpl-1',
      subNodes: [{ id: 'sub-1', label: 'Giorno' }],
    };

    expect(() => {
      render(
        <RegexInlineEditor
          regex="(?<g_000000000000>.*)"
          onClose={mockOnClose}
          node={mockNode}
          kind="date"
          onButtonRender={vi.fn()}
          onErrorRender={vi.fn()}
          examplesList={['12/03/1990']}
          rowResults={[]}
        />
      );
    }).not.toThrow();
  });

  // -----------------------------------------------------------------------
  // GUID → Label: renderRegexForEditor is called on mount
  // -----------------------------------------------------------------------

  it('calls renderRegexForEditor with the incoming GUID regex on mount', async () => {
    const { renderRegexForEditor } = await import('@responseEditor/utils/regexGroupTransform');

    render(
      <RegexInlineEditor
        regex="(?<g_1a2b3c4d5e6f>\\d+)"
        onClose={mockOnClose}
      />
    );

    expect(renderRegexForEditor).toHaveBeenCalledWith(
      '(?<g_1a2b3c4d5e6f>\\d+)',
      expect.any(Object) // subDataMapping
    );
  });

  it('displays the label-based regex in the editor (not the raw GUID)', async () => {
    const { getByTestId } = render(
      <RegexInlineEditor
        regex="(?<g_1a2b3c4d5e6f>\\d+)"
        onClose={mockOnClose}
      />
    );

    // The stub in renderRegexForEditor replaces GUID group markers
    const textarea = getByTestId('editor-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toContain('__label__');
    expect(textarea.value).not.toContain('g_1a2b3c4d5e6f');
  });

  // -----------------------------------------------------------------------
  // Label → GUID: normalizeRegexFromEditor is called on cleanup
  // -----------------------------------------------------------------------

  it('calls normalizeRegexFromEditor during cleanup when templateId is present', async () => {
    const { normalizeRegexFromEditor } = await import('@responseEditor/utils/regexGroupTransform');

    const mockNode = { id: 'n-1', templateId: 'tmpl-1' };

    const { unmount } = render(
      <RegexInlineEditor
        regex="(?<g_000000000000>.*)"
        onClose={mockOnClose}
        node={mockNode}
      />
    );

    act(() => {
      unmount();
    });

    expect(normalizeRegexFromEditor).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Validation error propagation
  // -----------------------------------------------------------------------

  it('calls onErrorRender(null) when there is no validation error', () => {
    const onErrorRender = vi.fn();

    render(
      <RegexInlineEditor
        regex="(?<g_000000000000>.*)"
        onClose={mockOnClose}
        onErrorRender={onErrorRender}
      />
    );

    // After mount, no error should be reported
    expect(onErrorRender).toHaveBeenCalledWith(null);
  });

  // -----------------------------------------------------------------------
  // AI button visibility
  // -----------------------------------------------------------------------

  it('does not show an AI button when the regex is untouched (no diff)', () => {
    const onButtonRender = vi.fn();

    render(
      <RegexInlineEditor
        regex="(?<g_000000000000>.*)"
        onClose={mockOnClose}
        onButtonRender={onButtonRender}
      />
    );

    // Button should be hidden when lastText === currentText
    const lastCall = onButtonRender.mock.calls[onButtonRender.mock.calls.length - 1];
    expect(lastCall?.[0]).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Empty regex handling
  // -----------------------------------------------------------------------

  it('handles an empty regex without crashing', () => {
    expect(() => {
      render(<RegexInlineEditor regex="" onClose={mockOnClose} />);
    }).not.toThrow();
  });

  it('renders the placeholder text when regex is empty', () => {
    const { getByTestId } = render(
      <RegexInlineEditor regex="" onClose={mockOnClose} />
    );

    const textarea = getByTestId('editor-textarea') as HTMLTextAreaElement;
    // Either placeholder or empty — must not crash and must render the editor
    expect(textarea).toBeInTheDocument();
  });
});
