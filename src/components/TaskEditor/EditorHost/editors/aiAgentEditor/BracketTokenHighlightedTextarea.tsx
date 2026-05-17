/**
 * Plain textarea with a mirror layer highlighting semantic `[…]` (giallo) and style `«…»` (blu).
 * Caret-alignment: pill solo background/inset, nessun padding orizzontale extra.
 */

import React from 'react';
import { splitAgentMessageParts, type AgentMessageTextPart } from '@domain/useCaseBundle/agentMessageTokenSyntax';

type BracketTokenHighlightedTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value'
> & {
  value: string;
  containerClassName: string;
};

function tokenPillClass(kind: 'semantic' | 'style'): string {
  return kind === 'semantic'
    ? 'rounded-[0.28rem] bg-amber-300/18 text-amber-100 shadow-[inset_0_0_0_1px_rgba(252,211,77,0.34)]'
    : 'rounded-[0.28rem] bg-sky-300/16 text-sky-100 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.32)]';
}

function renderPart(part: AgentMessageTextPart, index: number): React.ReactNode {
  if (part.kind === 'text') {
    return <React.Fragment key={index}>{part.text}</React.Fragment>;
  }
  return (
    <span key={index} className={tokenPillClass(part.kind)}>
      {part.text}
    </span>
  );
}

export function BracketTokenHighlightedText({
  text,
  className,
  strike = false,
}: {
  text: string;
  className?: string;
  strike?: boolean;
}): React.ReactElement {
  const parts = React.useMemo(() => splitAgentMessageParts(text), [text]);
  return (
    <span className={[className ?? '', strike ? 'line-through' : ''].filter(Boolean).join(' ')}>
      {parts.map((part, index) => renderPart(part, index))}
    </span>
  );
}

export const BracketTokenHighlightedTextarea = React.forwardRef<
  HTMLTextAreaElement,
  BracketTokenHighlightedTextareaProps
>(function BracketTokenHighlightedTextarea(
  { value, containerClassName, className, onScroll, placeholder, style, spellCheck, ...textareaProps },
  forwardedRef
) {
  const mirrorRef = React.useRef<HTMLDivElement | null>(null);
  const parts = React.useMemo(() => splitAgentMessageParts(value), [value]);
  /** Con testo trasparente il browser non disegna le ondine ortografiche: testo visibile + niente mirror. */
  const spellCheckOn = spellCheck === true || spellCheck === '';

  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLTextAreaElement>) => {
      const mirror = mirrorRef.current;
      if (mirror) {
        mirror.scrollTop = event.currentTarget.scrollTop;
        mirror.scrollLeft = event.currentTarget.scrollLeft;
      }
      onScroll?.(event);
    },
    [onScroll]
  );

  return (
    <div className={`relative overflow-hidden ${containerClassName}`} style={style}>
      {!spellCheckOn ? (
        <div
          ref={mirrorRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-current"
          style={{ padding: 'inherit', boxSizing: 'border-box' }}
        >
          {value.length === 0 && placeholder ? (
            <span className="text-current opacity-45">{placeholder}</span>
          ) : (
            parts.map((part, index) => renderPart(part, index))
          )}
        </div>
      ) : null}
      <textarea
        {...textareaProps}
        ref={forwardedRef}
        value={value}
        spellCheck={spellCheck}
        placeholder={spellCheckOn ? placeholder : ''}
        onScroll={handleScroll}
        className={[
          'relative z-10 block h-full w-full resize-none border-0 bg-transparent p-0 caret-slate-100 outline-none focus:outline-none focus:ring-0 disabled:cursor-not-allowed',
          spellCheckOn
            ? 'text-emerald-50 placeholder:text-emerald-300/45'
            : 'text-transparent placeholder:text-transparent',
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
      />
    </div>
  );
});
