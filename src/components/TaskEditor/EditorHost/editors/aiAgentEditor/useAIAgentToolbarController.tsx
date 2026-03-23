/**
 * Dock toolbar + header chrome for the AI Agent editor.
 * When `hideHeader` is true, Create/Refine is mirrored into the main tab toolbar via `onToolbarUpdate`.
 */

import React from 'react';
import { Bot, Loader2, Sparkles } from 'lucide-react';
import type { ToolbarButton } from '../../../../../dock/types';
import type { EditorProps } from '../../types';
import { useHeaderToolbarContext } from '../../../ResponseEditor/context/HeaderToolbarContext';
import { LABEL_CREATE_AGENT, LABEL_REFINE_AGENT, AI_AGENT_HEADER_COLOR } from './constants';

export interface UseAIAgentToolbarControllerParams {
  task: EditorProps['task'];
  hideHeader: boolean | undefined;
  onToolbarUpdate: EditorProps['onToolbarUpdate'];
  hasAgentGeneration: boolean;
  showPrimaryAgentAction: boolean;
  generating: boolean;
  /** Create Agent / Refine — same handler as the in-editor primary button. */
  onPrimaryAgentAction: () => void;
}

export function useAIAgentToolbarController({
  task,
  hideHeader,
  onToolbarUpdate,
  hasAgentGeneration,
  showPrimaryAgentAction,
  generating,
  onPrimaryAgentAction,
}: UseAIAgentToolbarControllerParams) {
  const headerColor = AI_AGENT_HEADER_COLOR;
  const primaryAgentActionLabel = hasAgentGeneration ? LABEL_REFINE_AGENT : LABEL_CREATE_AGENT;

  const primaryToolbarButtons = React.useMemo<ToolbarButton[]>(() => {
    if (!showPrimaryAgentAction) {
      return [];
    }
    return [
      {
        icon: generating ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />,
        label: generating ? 'Generating…' : primaryAgentActionLabel,
        onClick: () => onPrimaryAgentAction(),
        disabled: generating,
        primary: true,
        title: primaryAgentActionLabel,
      },
    ];
  }, [showPrimaryAgentAction, generating, primaryAgentActionLabel, onPrimaryAgentAction]);

  React.useEffect(() => {
    if (hideHeader && onToolbarUpdate) {
      onToolbarUpdate(primaryToolbarButtons, headerColor);
      return () => {
        onToolbarUpdate([], headerColor);
      };
    }
  }, [hideHeader, onToolbarUpdate, headerColor, primaryToolbarButtons]);

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
