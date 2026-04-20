/**
 * Read-only Omnia IR Markdown preview (canonical section layout + bracket placeholders).
 */

import React from 'react';
import type { PlatformPromptOmnia } from '@domain/agentPrompt';

export function OmniaEditor({ output }: { output: PlatformPromptOmnia }) {
  return (
    <textarea
      readOnly
      value={output.irMarkdown}
      aria-label="Omnia IR Markdown"
      className="min-h-0 w-full flex-1 resize-y rounded-md border border-slate-700 bg-[#0a1018] p-2 text-xs font-mono text-slate-200"
      spellCheck={false}
    />
  );
}
