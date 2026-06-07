/**
 * Pulsante «Test»: apre il debugger Omnia e avvia il dialogo per questo agente.
 * Prerequisito: Deploy ConvAI già eseguito (link agente sul task).
 */

import React from 'react';
import { Loader2, Play } from 'lucide-react';
import { flushAiAgentEditorsBeforeProjectSave } from '../aiAgentProjectSaveFlush';
import { OMNIA_EXIT_AI_AGENT_EDITOR_FULLSCREEN } from '../aiAgentDockPanelIds';
import { openAgentTestDebugger } from '@domain/aiAgentDebugger/openAgentTestDebuggerBridge';

export interface AIAgentTestButtonProps {
  readonly agentTaskId: string;
  readonly taskLabel: string;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  readonly compilePhrasesBusy?: boolean;
}

export function AIAgentTestButton({
  agentTaskId,
  taskLabel,
  disabled = false,
  disabledReason,
  compilePhrasesBusy = false,
}: AIAgentTestButtonProps): React.ReactElement {
  const [busy, setBusy] = React.useState(false);
  const isDisabled = disabled || compilePhrasesBusy || busy || !agentTaskId.trim();

  const handleClick = React.useCallback(() => {
    if (isDisabled) return;
    setBusy(true);
    try {
      flushAiAgentEditorsBeforeProjectSave();
      document.dispatchEvent(
        new CustomEvent(OMNIA_EXIT_AI_AGENT_EDITOR_FULLSCREEN, { bubbles: true })
      );
      openAgentTestDebugger({ agentTaskId, taskLabel });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`Test agente non avviato:\n\n${msg}`);
    } finally {
      window.setTimeout(() => setBusy(false), 300);
    }
  }, [agentTaskId, isDisabled, taskLabel]);

  const title =
    disabledReason ??
    (compilePhrasesBusy
      ? 'Attendi la compilazione in corso'
      : 'Apre il debugger chat a destra e avvia il dialogo (Deploy già eseguito)');

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      title={title}
      aria-busy={busy || compilePhrasesBusy}
      className={[
        'inline-flex items-center gap-1.5 rounded-md border border-emerald-500/70 bg-emerald-700/85 px-2.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 disabled:cursor-not-allowed disabled:opacity-45',
        busy || compilePhrasesBusy ? 'cursor-wait' : '',
      ].join(' ')}
    >
      {busy || compilePhrasesBusy ? (
        <Loader2 size={13} aria-hidden className="animate-spin" />
      ) : (
        <Play size={13} aria-hidden />
      )}
      <span>{compilePhrasesBusy ? 'Compilazione…' : 'Test'}</span>
    </button>
  );
}
