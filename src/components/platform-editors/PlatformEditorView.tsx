/**
 * Routes structured {@link PlatformPromptOutput} to the correct read-only platform editor.
 */

import React from 'react';
import { AgentPlatform, type PlatformPromptOutput } from '@domain/agentPrompt';
import { OmniaEditor } from './OmniaEditor';
import { OpenAIEditor } from './OpenAIEditor';
import { AnthropicEditor } from './AnthropicEditor';
import { GoogleEditor } from './GoogleEditor';
import { AmazonEditor } from './AmazonEditor';
import { ElevenLabsEditor } from './ElevenLabsEditor';
import { MetaEditor } from './MetaEditor';
import { ReadOnlyPlatformBanner } from './ReadOnlyPlatformBanner';

export function PlatformEditorView({ output }: { output: PlatformPromptOutput }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <ReadOnlyPlatformBanner />
      {output.platform === AgentPlatform.Omnia ? (
        <OmniaEditor output={output} />
      ) : output.platform === AgentPlatform.OpenAI ? (
        <OpenAIEditor output={output} />
      ) : output.platform === AgentPlatform.Anthropic ? (
        <AnthropicEditor output={output} />
      ) : output.platform === AgentPlatform.Google ? (
        <GoogleEditor output={output} />
      ) : output.platform === AgentPlatform.Amazon ? (
        <AmazonEditor output={output} />
      ) : output.platform === AgentPlatform.ElevenLabs ? (
        <ElevenLabsEditor output={output} />
      ) : (
        <MetaEditor output={output} />
      )}
    </div>
  );
}
