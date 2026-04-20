/**
 * Read-only Meta / OSS: free-form compiled prompt.
 */

import React from 'react';
import type { PlatformPromptMeta } from '@domain/agentPrompt';

export function MetaEditor({ output }: { output: PlatformPromptMeta }) {
  return (
    <textarea
      readOnly
      value={output.prompt}
      aria-label="Meta / OSS prompt"
      className="min-h-0 w-full flex-1 resize-y rounded-md border border-slate-700 bg-[#0a1018] p-2 text-xs font-mono text-slate-200"
      spellCheck={false}
    />
  );
}
