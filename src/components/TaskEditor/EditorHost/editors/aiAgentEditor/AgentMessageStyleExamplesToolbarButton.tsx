/**
 * Toolbar + pannello esempi frase (combinatoria varianti style token), stato condiviso.
 */

import React from 'react';
import { List } from 'lucide-react';
import { TOOLTIP_AGENT_MSG_GENERATE_STYLE_EXAMPLES } from './constants';
import { UC_AGENT_ROW_EDIT_BTN } from './useCaseComposerPresentation';
import { useAgentMessageStyleExamples } from './useAgentMessageStyleExamples';
import { AgentMessageStyleExamplesPanel } from './AgentMessageStyleExamplesPanel';
import type { AIAgentPhraseStyleToken } from '@domain/useCaseBundle/schema';

export type AgentMessageStyleExamplesWrapProps = {
  text: string;
  styleTokens: readonly AIAgentPhraseStyleToken[];
  disabled?: boolean;
  iconSize?: number;
  buttonClassName?: string;
  panelClassName?: string;
  children: (parts: {
    toolbarButton: React.ReactNode;
    panel: React.ReactNode;
  }) => React.ReactNode;
};

export function AgentMessageStyleExamplesWrap({
  text,
  styleTokens,
  disabled = false,
  iconSize = 18,
  buttonClassName = UC_AGENT_ROW_EDIT_BTN,
  panelClassName = 'mt-2',
  children,
}: AgentMessageStyleExamplesWrapProps): React.ReactElement {
  const ex = useAgentMessageStyleExamples({ text, styleTokens });

  const toolbarButton =
    ex.hasStyleTokens ? (
      <button
        type="button"
        disabled={disabled || !ex.canGenerate}
        aria-pressed={ex.open}
        title={TOOLTIP_AGENT_MSG_GENERATE_STYLE_EXAMPLES}
        className={`${buttonClassName} ${ex.open ? 'text-sky-300' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          ex.toggleOpen();
        }}
      >
        <List size={iconSize} aria-hidden />
      </button>
    ) : null;

  const panel =
    ex.open && ex.hasStyleTokens ? (
      <AgentMessageStyleExamplesPanel
        phrases={ex.phrases}
        truncated={ex.truncated}
        className={panelClassName}
      />
    ) : null;

  return <>{children({ toolbarButton, panel })}</>;
}

/** Solo pulsante toolbar (nessun pannello). */
export function AgentMessageStyleExamplesToolbarButton({
  text,
  styleTokens,
  disabled = false,
  iconSize = 18,
  buttonClassName = UC_AGENT_ROW_EDIT_BTN,
}: Omit<AgentMessageStyleExamplesWrapProps, 'children' | 'panelClassName'>): React.ReactElement | null {
  return (
    <AgentMessageStyleExamplesWrap
      text={text}
      styleTokens={styleTokens}
      disabled={disabled}
      iconSize={iconSize}
      buttonClassName={buttonClassName}
    >
      {({ toolbarButton }) => <>{toolbarButton}</>}
    </AgentMessageStyleExamplesWrap>
  );
}
