/**
 * Single KB chat row: WhatsApp-style bubbles (sky = bot, emerald = user).
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
import { Bot, Loader2 } from 'lucide-react';
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

const BUBBLE_BASE =
  'relative max-w-[min(100%,28rem)] px-3 py-2 text-sm leading-relaxed shadow-sm ';

/** Bot / system bubble: washed sky blue, tail bottom-left. */
const BOT_BUBBLE =
  BUBBLE_BASE +
  'rounded-2xl rounded-bl-sm border border-sky-200/90 bg-sky-200/95 text-sky-950 ' +
  'shadow-sky-900/10 before:pointer-events-none before:absolute before:bottom-0 before:-left-1.5 ' +
  'before:h-3 before:w-3 before:rotate-45 before:border-b before:border-l before:border-sky-200/90 ' +
  'before:bg-sky-200/95 before:content-[""]';

const BOT_WORKING =
  BOT_BUBBLE +
  ' border-violet-300/50 bg-sky-100/95 before:border-violet-300/50 before:bg-sky-100/95';

const BOT_ERROR =
  BUBBLE_BASE +
  'rounded-2xl rounded-bl-sm border border-rose-300/80 bg-rose-50 text-rose-950 ' +
  'before:pointer-events-none before:absolute before:bottom-0 before:-left-1.5 ' +
  'before:h-3 before:w-3 before:rotate-45 before:border-b before:border-l before:border-rose-300/80 ' +
  'before:bg-rose-50 before:content-[""]';

/** User bubble: washed green, tail bottom-right, no avatar. */
const USER_BUBBLE =
  BUBBLE_BASE +
  'rounded-2xl rounded-br-sm border border-emerald-200/90 bg-emerald-200/95 text-emerald-950 ' +
  'shadow-emerald-900/10 after:pointer-events-none after:absolute after:bottom-0 after:-right-1.5 ' +
  'after:h-3 after:w-3 after:rotate-45 after:border-b after:border-r after:border-emerald-200/90 ' +
  'after:bg-emerald-200/95 after:content-[""]';

export type KbChatMessageRowProps = {
  message: KbChatMessage;
  opaqueSurface: boolean;
  interactiveActive: boolean;
  busy: boolean;
  onInteractiveAction?: (action: KbChatInteractiveAction) => void;
};

export function KbChatMessageRow({
  message,
  opaqueSurface: _opaqueSurface,
  interactiveActive,
  busy,
  onInteractiveAction,
}: KbChatMessageRowProps): React.ReactElement {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end pl-8 pr-1" role="listitem">
        <div className={USER_BUBBLE} aria-label="Messaggio designer">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  const working = isKbWorkingMessage(message);
  const error = message.tone === 'error';
  const bubbleClass = error ? BOT_ERROR : working ? BOT_WORKING : BOT_BUBBLE;

  return (
    <div className="flex justify-start pl-1 pr-8" role="listitem">
      <div
        className={bubbleClass}
        role={working ? 'status' : undefined}
        aria-live={working ? 'polite' : undefined}
        aria-label="Messaggio assistente"
      >
        <div className="mb-1 flex items-center gap-1.5 text-sky-800/80">
          <Bot className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          <span className="text-[10px] font-medium uppercase tracking-wide">Assistente</span>
        </div>
        {working ? (
          <div className="flex items-start gap-2">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-violet-600" aria-hidden />
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
