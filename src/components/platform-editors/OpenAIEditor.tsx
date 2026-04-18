/**
 * Read-only OpenAI Assistants–style layout: Instructions, Tools, Examples, Retrieval, Metadata.
 */

import React from 'react';
import type { PlatformPromptOpenAI } from '@domain/agentPrompt';

const TABS = [
  { id: 'instructions', label: 'Instructions', field: 'instructions' as const },
  { id: 'tools', label: 'Tools', field: 'tools' as const },
  { id: 'examples', label: 'Examples', field: 'examples' as const },
  { id: 'retrieval', label: 'Retrieval', field: 'retrieval' as const },
  { id: 'metadata', label: 'Metadata', field: 'metadata' as const },
];

export function OpenAIEditor({ output }: { output: PlatformPromptOpenAI }) {
  const [tab, setTab] = React.useState<string>('instructions');
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  const text = output[active.field];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded px-2 py-1 text-[11px] font-medium ${
              tab === t.id
                ? 'bg-violet-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        readOnly
        value={text}
        aria-label={active.label}
        className="min-h-[120px] flex-1 resize-y rounded-md border border-slate-700 bg-[#0a1018] p-2 text-xs font-mono text-slate-200"
        spellCheck={false}
      />
    </div>
  );
}
