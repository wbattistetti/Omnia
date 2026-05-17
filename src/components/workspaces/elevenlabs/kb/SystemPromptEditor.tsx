/**
 * Reusable Markdown system-prompt editor with Analyze and optional KB aggregate.
 */

import React from 'react';
import { Loader2, Sparkles, Layers } from 'lucide-react';
import { KbMarkdownMonaco } from './KbMarkdownMonaco';

export type SystemPromptEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  onAnalyze: () => void | Promise<void>;
  analyzeBusy?: boolean;
  analyzeDisabled?: boolean;
  onAggregateKb?: () => void | Promise<void>;
  aggregateBusy?: boolean;
  aggregateDisabled?: boolean;
  aggregateSnippetCount?: number;
  error?: string | null;
  placeholder?: string;
  editorHeightPx?: number;
};

export function SystemPromptEditor({
  value,
  onChange,
  onAnalyze,
  analyzeBusy = false,
  analyzeDisabled = false,
  onAggregateKb,
  aggregateBusy = false,
  aggregateDisabled = false,
  aggregateSnippetCount = 0,
  error = null,
  editorHeightPx = 280,
}: SystemPromptEditorProps): React.ReactElement {
  const canAnalyze = !analyzeDisabled && !analyzeBusy;
  const showAnalyze = value.trim().length > 0 || analyzeBusy;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {onAggregateKb ? (
          <button
            type="button"
            disabled={aggregateDisabled || aggregateBusy}
            onClick={() => void onAggregateKb()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-violet-500/60 hover:text-violet-100 disabled:opacity-50"
          >
            {aggregateBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Layers className="h-3.5 w-3.5" aria-hidden />
            )}
            Aggrega KB ({aggregateSnippetCount})
          </button>
        ) : null}
        {showAnalyze ? (
          <button
            type="button"
            disabled={!canAnalyze}
            onClick={() => void onAnalyze()}
            className="inline-flex items-center gap-1.5 rounded-md border border-violet-600/70 bg-violet-950/60 px-2.5 py-1 text-[11px] font-semibold text-violet-100 hover:bg-violet-900/50 disabled:opacity-50"
          >
            {analyzeBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            )}
            Analyze
          </button>
        ) : null}
      </div>
      <KbMarkdownMonaco
        value={value}
        onChange={onChange}
        heightPx={editorHeightPx}
        ariaLabel="System prompt Markdown"
      />
      {error ? <p className="text-[11px] text-rose-300">{error}</p> : null}
    </div>
  );
}
