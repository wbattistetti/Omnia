/**
 * Read-only ElevenLabs: single short prompt field.
 */

import React from 'react';
import type { PlatformPromptElevenLabs } from '@domain/agentPrompt';

export function ElevenLabsEditor({ output }: { output: PlatformPromptElevenLabs }) {
  return (
    <textarea
      readOnly
      value={output.prompt}
      aria-label="ElevenLabs prompt"
      className="min-h-0 w-full flex-1 resize-y rounded-md border border-slate-700 bg-[#0a1018] p-2 text-xs font-mono text-slate-200"
      spellCheck={false}
    />
  );
}
