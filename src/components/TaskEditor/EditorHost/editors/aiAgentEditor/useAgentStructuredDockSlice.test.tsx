/**
 * Tests for structured dock slice resolution (legacy nested vs unified editor context).
 */

import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { AGENT_STRUCTURED_SECTION_IDS } from './agentStructuredSectionIds';
import {
  AIAgentStructuredSectionsDockProvider,
  type AIAgentStructuredSectionsDockContextValue,
} from './AIAgentStructuredSectionsDockContext';
import { createInitialStructuredSectionsState } from './structuredSectionsRevisionReducer';
import { useAgentStructuredDockSlice } from './useAgentStructuredDockSlice';

function emptySectionBases(): Record<(typeof AGENT_STRUCTURED_SECTION_IDS)[number], string> {
  return Object.fromEntries(AGENT_STRUCTURED_SECTION_IDS.map((id) => [id, ''])) as Record<
    (typeof AGENT_STRUCTURED_SECTION_IDS)[number],
    string
  >;
}

const noop = () => {};

function structuredFixture(): AIAgentStructuredSectionsDockContextValue {
  return {
    instanceIdSuffix: 'test-task',
    runtimeMarkdown: 'composed',
    sectionsState: createInitialStructuredSectionsState(emptySectionBases()),
    readOnly: false,
    onApplyRevisionOps: noop,
    iaRevisionDiffBySection: null,
    onDismissIaRevisionForSection: noop,
  };
}

describe('useAgentStructuredDockSlice', () => {
  it('throws when no dock context is mounted', () => {
    expect(() => renderHook(() => useAgentStructuredDockSlice())).toThrow(
      /AIAgentStructuredSectionsDockProvider or AIAgentEditorDockProvider/
    );
  });

  it('returns structured provider value when nested dock is used', () => {
    const fixture = structuredFixture();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AIAgentStructuredSectionsDockProvider value={fixture}>{children}</AIAgentStructuredSectionsDockProvider>
    );
    const { result } = renderHook(() => useAgentStructuredDockSlice(), { wrapper });
    expect(result.current.instanceIdSuffix).toBe('test-task');
    expect(result.current.runtimeMarkdown).toBe('composed');
    expect(result.current.readOnly).toBe(false);
  });
});
