/**
 * Read-only Anthropic-style layout: System, Policies, Workflow steps.
 */

import React from 'react';
import type { PlatformPromptAnthropic } from '@domain/agentPrompt';

const TABS = [
  { id: 'system', label: 'System', field: 'system' as const },
  { id: 'policies', label: 'Policies', field: 'policies' as const },
  { id: 'workflow', label: 'Workflow steps', field: 'workflowSteps' as const },
];

export function AnthropicEditor({ output }: { output: PlatformPromptAnthropic }) {
  const [tab, setTab] = React.useState('system');
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
                ? 'bg-orange-700 text-white'
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
