/**
 * Single KB chat row: avatar + speech-bubble styling for bot vs designer.
 */

import React from 'react';
import type { KbChatMessage } from '@domain/knowledgeBase/kbRuleTypes';
import {
  KB_MSG_ANALYZING,
  KB_MSG_ANALYZING_ACK,
} from '@domain/knowledgeBase/kbChatCopy';
import {
  KB_MSG_VERIFYING_HYPOTHESIS,
  KB_MSG_AI_ANALYZE_DOC,
} from '@domain/knowledgeBase/kbChatInteractive';
import { Loader2, Smile, Sparkles } from 'lucide-react';
import {
  KbChatInteractiveBlock,
  type KbChatInteractiveAction,
} from './KbChatInteractiveBlock';

function isKbWorkingMessage(m: KbChatMessage): boolean {
  if (m.tone === 'working') return true;
  const c = m.content.trim();
  return (
    c === KB_MSG_ANALYZING_ACK ||
    c === KB_MSG_ANALYZING ||
    c === KB_MSG_VERIFYING_HYPOTHESIS ||
    c === KB_MSG_AI_ANALYZE_DOC
  );
}

function KbBotAvatar({ working }: { working?: boolean }): React.ReactElement {
  return (
    <span
      className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-500/40 bg-gradient-to-br from-violet-600/90 to-indigo-800/90 shadow-md shadow-violet-950/50"
      aria-hidden
    >
      {working ? (
        <span className="absolute inset-0 rounded-full bg-violet-400/20 animate-ping" />
      ) : null}
      <Sparkles className="relative h-4 w-4 text-violet-50" strokeWidth={2} />
    </span>
  );
}

function KbUserAvatar(): React.ReactElement {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-500/35 bg-gradient-to-br from-sky-700/80 to-slate-700/90 shadow-md shadow-slate-950/40"
      aria-hidden
    >
      <Smile className="h-4 w-4 text-sky-50" strokeWidth={2} />
    </span>
  );
}

type BubbleTone = 'bot' | 'user' | 'error' | 'working';

function bubbleClass(tone: BubbleTone, opaqueSurface: boolean): string {
  const base = 'relative max-w-full px-3 py-2 text-sm leading-relaxed shadow-sm ';
  switch (tone) {
    case 'user':
      return (
        base +
        'rounded-2xl rounded-br-md border border-violet-500/35 ' +
        (opaqueSurface ? 'bg-violet-900/90' : 'bg-violet-950/75') +
        ' text-violet-50'
      );
    case 'error':
      return (
        base +
        'rounded-2xl rounded-bl-md border border-rose-600/45 bg-rose-950/70 text-rose-50'
      );
    case 'working':
      return (
        base +
        'rounded-2xl rounded-bl-md border border-violet-500/45 bg-violet-950/80 text-violet-100 ' +
        'shadow-[0_0_14px_rgba(139,92,246,0.15)]'
      );
    case 'bot':
    default:
      return (
        base +
        'rounded-2xl rounded-bl-md border border-slate-600/50 ' +
        (opaqueSurface ? 'bg-slate-800/95' : 'bg-slate-800/85') +
        ' text-slate-200'
      );
  }
}

export type KbChatMessageRowProps = {
  message: KbChatMessage;
  opaqueSurface: boolean;
  interactiveActive: boolean;
  busy: boolean;
  onInteractiveAction?: (action: KbChatInteractiveAction) => void;
};

export function KbChatMessageRow({
  message,
  opaqueSurface,
  interactiveActive,
  busy,
  onInteractiveAction,
}: KbChatMessageRowProps): React.ReactElement {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end gap-2 pl-6" role="listitem">
        <div className={bubbleClass('user', opaqueSurface)} aria-label="Messaggio designer">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <KbUserAvatar />
      </div>
    );
  }

  const working = isKbWorkingMessage(message);
  const error = message.tone === 'error';
  const tone: BubbleTone = error ? 'error' : working ? 'working' : 'bot';

  return (
    <div className="flex justify-start gap-2 pr-6" role="listitem">
      <KbBotAvatar working={working} />
      <div
        className={bubbleClass(tone, opaqueSurface)}
        role={working ? 'status' : undefined}
        aria-live={working ? 'polite' : undefined}
        aria-label="Messaggio assistente"
      >
        {working ? (
          <div className="flex items-start gap-2">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-violet-300" aria-hidden />
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}
        {message.interactive && onInteractiveAction ? (
          <KbChatInteractiveBlock
            interactive={message.interactive}
            active={interactiveActive}
            busy={busy}
            onAction={onInteractiveAction}
          />
        ) : null}
      </div>
    </div>
  );
}
