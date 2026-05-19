/**
 * Inline interactive controls inside KB chat bubbles (Sì/No on hypothesis question).
 */

import React from 'react';
import type { KbChatInteractive } from '@domain/knowledgeBase/kbChatInteractive';

export type KbChatInteractiveAction =
  | { type: 'hypothesis_yes' }
  | { type: 'hypothesis_no' };

export type KbChatInteractiveBlockProps = {
  interactive: KbChatInteractive;
  active: boolean;
  busy?: boolean;
  onAction: (action: KbChatInteractiveAction) => void;
};

export function KbChatInteractiveBlock({
  interactive,
  active,
  busy = false,
  onAction,
}: KbChatInteractiveBlockProps): React.ReactElement | null {
  if (interactive.kind !== 'hypothesis_choice') return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={!active || busy}
        onClick={() => onAction({ type: 'hypothesis_yes' })}
        className="rounded-md border border-violet-600/70 bg-violet-950/60 px-3 py-1.5 text-sm text-violet-100 hover:bg-violet-900/50 disabled:opacity-50"
      >
        Sì
      </button>
      <button
        type="button"
        disabled={!active || busy}
        onClick={() => onAction({ type: 'hypothesis_no' })}
        className="rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
      >
        No
      </button>
    </div>
  );
}
