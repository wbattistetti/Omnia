/**
 * Toolbar use case: schema v2, compila frasi, Agent Behavior, link pannelli verifica.
 */

import React from 'react';
import { Layers, Sparkles, BookOpen, Eye } from 'lucide-react';
import { getBundleSchemaVersionFromRaw } from '@domain/useCaseBundle/parseSerializeBundle';
import type { AgentBehaviorMode } from '@domain/useCaseGeneratorWizard/buildConversationalPrompt';

const BEHAVIOR_LABELS: Record<AgentBehaviorMode, string> = {
  A: 'A — UKS + risposta libera',
  B: 'B — UKS + ripeti',
  C: 'C — UKS + operatore (2 tentativi)',
};

export interface UseCaseBundleToolsStripProps {
  agentUseCasesJson: string;
  agentBehavior: AgentBehaviorMode;
  onAgentBehaviorChange: (mode: AgentBehaviorMode) => void;
  onCompilePhrases: () => void;
  compileBusy: boolean;
  onOpenLexiconPanel: () => void;
  onOpenCompiledInspector: () => void;
  lexiconConflictCount: number;
  stalePhraseCount: number;
}

export function UseCaseBundleToolsStrip({
  agentUseCasesJson,
  agentBehavior,
  onAgentBehaviorChange,
  onCompilePhrases,
  compileBusy,
  onOpenLexiconPanel,
  onOpenCompiledInspector,
  lexiconConflictCount,
  stalePhraseCount,
}: UseCaseBundleToolsStripProps): React.ReactElement {
  const schemaVersion = getBundleSchemaVersionFromRaw(agentUseCasesJson) ?? 1;
  const [behaviorOpen, setBehaviorOpen] = React.useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-700/80 bg-slate-900/60 px-2 py-1.5 text-xs">
      <span
        className="inline-flex items-center gap-1 rounded bg-violet-900/50 px-2 py-0.5 font-medium text-violet-200"
        title="Versione schema bundle use case persistito"
      >
        <Layers className="h-4 w-4" />
        Schema v{schemaVersion}
      </span>

      <button
        type="button"
        disabled={compileBusy}
        onClick={onCompilePhrases}
        className="inline-flex items-center gap-1 rounded bg-amber-900/40 px-2 py-0.5 text-amber-100 hover:bg-amber-800/50 disabled:opacity-50"
        title="Compila slot semantici (design-time)"
      >
        <Sparkles className="h-4 w-4" />
        {compileBusy ? 'Compilazione…' : 'Compila frasi'}
      </button>

      {stalePhraseCount > 0 ? (
        <span className="rounded bg-orange-900/50 px-2 py-0.5 text-orange-200">
          {stalePhraseCount} frase/i da ricompilare
        </span>
      ) : null}

      {lexiconConflictCount > 0 ? (
        <span className="rounded bg-red-900/50 px-2 py-0.5 text-red-200">
          {lexiconConflictCount} conflitto/i lessico
        </span>
      ) : null}

      <button
        type="button"
        onClick={onOpenCompiledInspector}
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-slate-300 hover:bg-slate-800"
      >
        <Eye className="h-4 w-4" />
        Vedi compilato
      </button>

      <button
        type="button"
        onClick={onOpenLexiconPanel}
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-slate-300 hover:bg-slate-800"
      >
        <BookOpen className="h-4 w-4" />
        Lessico progetto
      </button>

      <div className="relative ml-auto">
        <button
          type="button"
          onClick={() => setBehaviorOpen((o) => !o)}
          className="rounded border border-slate-600 px-2 py-0.5 text-slate-200 hover:bg-slate-800"
        >
          Agent Behavior: {agentBehavior}
        </button>
        {behaviorOpen ? (
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[220px] rounded border border-slate-600 bg-slate-900 py-1 shadow-lg">
            {(['A', 'B', 'C'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`block w-full px-3 py-1.5 text-left hover:bg-slate-800 ${
                  agentBehavior === mode ? 'text-amber-300' : 'text-slate-300'
                }`}
                onClick={() => {
                  onAgentBehaviorChange(mode);
                  setBehaviorOpen(false);
                }}
              >
                {BEHAVIOR_LABELS[mode]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
