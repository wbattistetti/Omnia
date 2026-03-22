/**
 * Dock toolbar + header chrome for the AI Agent editor.
 * Create/Refine actions live only in the editor body; the dock toolbar stays empty when hideHeader is used.
 */

import React from 'react';
import { Bot } from 'lucide-react';
import type { EditorProps } from '../../types';
import { useHeaderToolbarContext } from '../../../ResponseEditor/context/HeaderToolbarContext';
import { LABEL_CREATE_AGENT, LABEL_REFINE_AGENT, AI_AGENT_HEADER_COLOR } from './constants';

export interface UseAIAgentToolbarControllerParams {
  task: EditorProps['task'];
  hideHeader: boolean | undefined;
  onToolbarUpdate: EditorProps['onToolbarUpdate'];
  hasAgentGeneration: boolean;
}

export function useAIAgentToolbarController({
  task,
  hideHeader,
  onToolbarUpdate,
  hasAgentGeneration,
}: UseAIAgentToolbarControllerParams) {
  const headerColor = AI_AGENT_HEADER_COLOR;
  const primaryAgentActionLabel = hasAgentGeneration ? LABEL_REFINE_AGENT : LABEL_CREATE_AGENT;

  React.useEffect(() => {
    if (hideHeader && onToolbarUpdate) {
      onToolbarUpdate([], headerColor);
      return () => {
        onToolbarUpdate([], headerColor);
      };
    }
  }, [hideHeader, onToolbarUpdate, headerColor]);

  const headerContext = useHeaderToolbarContext();
  React.useEffect(() => {
    if (headerContext) {
      headerContext.setIcon(<Bot size={18} style={{ color: headerColor }} />);
      headerContext.setTitle(String(task?.label || 'AI Agent'));
      return () => {
        headerContext.setIcon(null);
        headerContext.setTitle(null);
      };
    }
  }, [headerContext, task?.label, headerColor]);

  return { headerColor, primaryAgentActionLabel };
}
