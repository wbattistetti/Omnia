/**
 * Flow debugger header actions: Play (idle only), Clear, Restart — order is deterministic by state.
 */
import React from 'react';
import { Eraser, Play, RotateCcw } from 'lucide-react';
import type { DebuggerSessionState } from './DebuggerStateMachine';

export function DebuggerToolbar(props: {
  state: DebuggerSessionState;
  isRestarting: boolean;
  onPlay: () => void;
  onClear: () => void;
  onRestart: () => void;
}) {
  const { state, isRestarting, onPlay, onClear, onRestart } = props;
  const showPlay = state === 'idle';

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {showPlay ? (
        <button
          type="button"
          onClick={() => {
            void onPlay();
          }}
          disabled={isRestarting}
          className="p-1.5 rounded bg-slate-900 text-lime-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
          title="Avvia sessione debugger"
          aria-label="Avvia sessione debugger"
        >
          <Play size={16} />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          void onClear();
        }}
        disabled={isRestarting}
        className="p-1.5 rounded bg-slate-900 text-lime-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
        title="Pulisci log e highlight (senza riavviare)"
        aria-label="Pulisci log debugger"
      >
        <Eraser size={16} />
      </button>
      <button
        type="button"
        onClick={() => {
          void onRestart();
        }}
        disabled={isRestarting}
        className="p-1.5 rounded bg-slate-900 text-lime-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
        title="Riavvia esecuzione"
        aria-label="Riavvia esecuzione"
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
}
