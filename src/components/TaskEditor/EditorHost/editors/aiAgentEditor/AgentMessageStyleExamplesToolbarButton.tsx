/**
 * Toolbar + pannello esempi frase stile (combinatoria, Magic polish/creative, persistenza).
 */

import React from 'react';
import { useAIProvider } from '@context/AIProviderContext';
import type { AIAgentPhraseStyleToken } from '@domain/useCaseBundle/schema';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { AgentMessageStyleExamplesPanel } from './AgentMessageStyleExamplesPanel';
import { resolveAiAgentOutputLanguage } from './resolveAiAgentOutputLanguage';
import { StylePhraseToolbarButtons } from './StylePhraseToolbarButtons';
import { useStylePhraseExamplesPanel } from './useStylePhraseExamplesPanel';

export type AgentMessageStyleExamplesWrapProps = {
  useCase: AIAgentUseCase;
  text: string;
  styleTokens: readonly AIAgentPhraseStyleToken[];
  onPatchUseCase: (updater: (uc: AIAgentUseCase) => AIAgentUseCase) => void;
  disabled?: boolean;
  iconSize?: number;
  panelClassName?: string;
  /** Pulsanti Magic (polish / creative) oltre alla lista combinazioni. */
  showMagic?: boolean;
  /** Toolbar sempre visibile (modifica inline). */
  toolbarAlwaysVisible?: boolean;
  children: (parts: {
    toolbarButton: React.ReactNode;
    panel: React.ReactNode;
    error: string | null;
  }) => React.ReactNode;
};

export function AgentMessageStyleExamplesWrap({
  useCase,
  text,
  styleTokens,
  onPatchUseCase,
  disabled = false,
  iconSize = 18,
  panelClassName = 'mt-2',
  showMagic = true,
  toolbarAlwaysVisible = false,
  children,
}: AgentMessageStyleExamplesWrapProps): React.ReactElement {
  const { provider, model } = useAIProvider();
  const outputLanguage = resolveAiAgentOutputLanguage().tag;

  const stylePanel = useStylePhraseExamplesPanel({
    useCase,
    messageText: text,
    styleTokens,
    onPatchUseCase,
    ai:
      provider && model
        ? { provider, model, outputLanguage }
        : null,
  });

  const styleBusy = disabled || stylePanel.generating !== null;

  const canRunCreative = text.trim().length > 0;

  const toolbarButton = (
    <StylePhraseToolbarButtons
      hasStyleTokens={stylePanel.hasStyleTokens}
      canRunCreative={canRunCreative}
      open={stylePanel.open}
      generating={stylePanel.generating}
      canUseAi={stylePanel.canUseAi}
      busy={styleBusy}
      showMagic={showMagic}
      iconSize={iconSize}
      alwaysVisible={toolbarAlwaysVisible}
      onLoadLocalCombinatorics={stylePanel.loadLocalCombinatorics}
      onRunPolish={() => void stylePanel.runPolish()}
      onRunCreative={() => void stylePanel.runCreative()}
    />
  );

  const panel =
    stylePanel.open && (stylePanel.hasStyleTokens || stylePanel.examples.length > 0) ? (
      <div className={panelClassName}>
        <AgentMessageStyleExamplesPanel
          examples={stylePanel.examples}
          truncated={stylePanel.truncated}
          busy={styleBusy}
          onClose={stylePanel.close}
          {...stylePanel.handlers}
        />
      </div>
    ) : null;

  return (
    <>
      {children({
        toolbarButton,
        panel,
        error: stylePanel.error,
      })}
    </>
  );
}

/** Solo pulsante toolbar (nessun pannello). */
export function AgentMessageStyleExamplesToolbarButton({
  useCase,
  text,
  styleTokens,
  onPatchUseCase,
  disabled = false,
  iconSize = 18,
  showMagic = true,
  toolbarAlwaysVisible = false,
}: Omit<AgentMessageStyleExamplesWrapProps, 'children' | 'panelClassName'>): React.ReactElement | null {
  return (
    <AgentMessageStyleExamplesWrap
      useCase={useCase}
      text={text}
      styleTokens={styleTokens}
      onPatchUseCase={onPatchUseCase}
      disabled={disabled}
      iconSize={iconSize}
      showMagic={showMagic}
      toolbarAlwaysVisible={toolbarAlwaysVisible}
    >
      {({ toolbarButton }) => <>{toolbarButton}</>}
    </AgentMessageStyleExamplesWrap>
  );
}
