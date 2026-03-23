/**
 * Resolves structured-section dock data from either the legacy nested Dockview provider
 * or the unified AI Agent editor Dockview (editor context).
 */

import React from 'react';
import { AIAgentEditorDockContext } from './AIAgentEditorDockContext';
import {
  AIAgentStructuredSectionsDockContext,
  type AIAgentStructuredSectionsDockContextValue,
} from './AIAgentStructuredSectionsDockContext';

/**
 * @throws If neither structured nor editor dock context is available.
 */
export function useAgentStructuredDockSlice(): AIAgentStructuredSectionsDockContextValue {
  const structured = React.useContext(AIAgentStructuredSectionsDockContext);
  if (structured) {
    return structured;
  }
  const editor = React.useContext(AIAgentEditorDockContext);
  if (editor) {
    return {
      instanceIdSuffix: editor.instanceId ?? 'default',
      runtimeMarkdown: editor.composedRuntimeMarkdown,
      sectionsState: editor.structuredSectionsState,
      readOnly: editor.generating,
      onApplyRevisionOps: editor.onApplyRevisionOps,
      onApplyOtCommit: editor.onApplyOtCommit,
      structuredOtEnabled: editor.structuredOtEnabled,
      iaRevisionDiffBySection: editor.iaRevisionDiffBySection,
      onDismissIaRevisionForSection: editor.onDismissIaRevisionForSection,
    };
  }
  throw new Error(
    'useAgentStructuredDockSlice must run inside AIAgentStructuredSectionsDockProvider or AIAgentEditorDockProvider'
  );
}
