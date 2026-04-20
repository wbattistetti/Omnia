/**
 * Dock toolbar + header chrome for the AI Agent editor.
 * When `hideHeader` is true, Create/Refine is mirrored into the main tab toolbar via `onToolbarUpdate`.
 */

import React from 'react';
import { Bot, Loader2, Sparkles } from 'lucide-react';
import type { ToolbarButton } from '../../../../../dock/types';
import type { EditorProps } from '../../types';
import { useHeaderToolbarContext } from '../../../ResponseEditor/context/HeaderToolbarContext';
import {
  LABEL_CREATE_AGENT,
  LABEL_REFINE_AGENT,
  LABEL_GENERATE_USE_CASES,
  LABEL_GENERATING_IA_AGENT,
  AI_AGENT_HEADER_COLOR,
} from './constants';

export interface UseAIAgentToolbarControllerParams {
  task: EditorProps['task'];
  hideHeader: boolean | undefined;
  onToolbarUpdate: EditorProps['onToolbarUpdate'];
  hasAgentGeneration: boolean;
  /** Same as dock `showRightPanel`: enables Dati / Use case column and Generate use case action. */
  showRightPanel: boolean;
  showPrimaryAgentAction: boolean;
  generating: boolean;
  useCaseComposerBusy: boolean;
  /** Create Agent / Refine — same handler as the in-editor primary button. */
  onPrimaryAgentAction: () => void;
  /** IA bundle for use cases — mirrored into tab toolbar when header is hidden. */
  onGenerateUseCaseBundle: () => void | Promise<void>;
}

export function useAIAgentToolbarController({
  task,
  hideHeader,
  onToolbarUpdate,
  hasAgentGeneration,
  showRightPanel,
  showPrimaryAgentAction,
  generating,
  useCaseComposerBusy,
  onPrimaryAgentAction,
  onGenerateUseCaseBundle,
}: UseAIAgentToolbarControllerParams) {
  const headerColor = AI_AGENT_HEADER_COLOR;
  const primaryAgentActionLabel = hasAgentGeneration ? LABEL_REFINE_AGENT : LABEL_CREATE_AGENT;

  const showGenerateUseCaseAction = hasAgentGeneration && showRightPanel;

  const primaryToolbarButtons = React.useMemo<ToolbarButton[]>(() => {
    const buttons: ToolbarButton[] = [];
    if (showPrimaryAgentAction) {
      buttons.push({
        icon: generating ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />,
        label: generating ? LABEL_GENERATING_IA_AGENT : primaryAgentActionLabel,
        onClick: () => onPrimaryAgentAction(),
        disabled: generating,
        primary: true,
        title: primaryAgentActionLabel,
      });
    }
    if (showGenerateUseCaseAction) {
      const genBusy = useCaseComposerBusy || generating;
      buttons.push({
        icon: useCaseComposerBusy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />,
        label: useCaseComposerBusy ? 'Generazione scenari…' : LABEL_GENERATE_USE_CASES,
        onClick: () => void onGenerateUseCaseBundle(),
        disabled: genBusy,
        primary: false,
        title: LABEL_GENERATE_USE_CASES,
      });
    }
    return buttons;
  }, [
    showPrimaryAgentAction,
    showGenerateUseCaseAction,
    generating,
    useCaseComposerBusy,
    primaryAgentActionLabel,
    onPrimaryAgentAction,
    onGenerateUseCaseBundle,
  ]);

  React.useEffect(() => {
    if (hideHeader && onToolbarUpdate) {
      onToolbarUpdate(primaryToolbarButtons, headerColor);
      return () => {
        onToolbarUpdate([], headerColor);
      };
    }
  }, [hideHeader, onToolbarUpdate, headerColor, primaryToolbarButtons]);

  const headerContext = useHeaderToolbarContext();
  const setHeaderIcon = headerContext?.setIcon;
  const setHeaderTitle = headerContext?.setTitle;

  React.useEffect(() => {
    if (!setHeaderIcon || !setHeaderTitle) return;
    setHeaderIcon(<Bot size={18} style={{ color: headerColor }} />);
    setHeaderTitle(String(task?.label || 'AI Agent'));
    return () => {
      setHeaderIcon(null);
      setHeaderTitle(null);
    };
  }, [setHeaderIcon, setHeaderTitle, task?.label, headerColor]);

  return { headerColor, primaryAgentActionLabel };
}
