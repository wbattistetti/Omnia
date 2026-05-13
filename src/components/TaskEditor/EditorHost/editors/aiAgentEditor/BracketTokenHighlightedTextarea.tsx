/**
 * Plain textarea with a lightweight mirror layer that highlights complete
 * bracket tokens (`[value]`) as soft yellow pills while preserving native input.
 *
 * Caret-alignment invariant: the mirror MUST occupy the exact same horizontal
 * width per character as the underlying textarea. Any padding/margin around the
 * token spans would shift downstream characters in the mirror but NOT in the
 * textarea, breaking click-to-caret mapping (e.g. clicking before a glyph would
 * land the caret one char ahead). The pill effect is therefore layout-neutral:
 * background + inset shadow only, no horizontal padding/margin, no border.
 */

import React from 'react';

type BracketTokenHighlightedTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value'
> & {
  value: string;
  /** Visual classes that used to live on the textarea (border, bg, padding, font, size). */
  containerClassName: string;
};

type TextPart = {
  text: string;
  token: boolean;
};

const BRACKET_TOKEN_PATTERN = /\[[^\[\]\r\n]+\]/g;

function splitBracketTokens(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(BRACKET_TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index), token: false });
    }
    parts.push({ text: match[0], token: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), token: false });
  }
  return parts.length > 0 ? parts : [{ text: '', token: false }];
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
  const parts = React.useMemo(() => splitBracketTokens(text), [text]);
  return (
    <span className={[className ?? '', strike ? 'line-through' : ''].filter(Boolean).join(' ')}>
      {parts.map((part, index) =>
        part.token ? (
          <span
            key={index}
            className="rounded-[0.28rem] bg-amber-300/18 text-amber-100 shadow-[inset_0_0_0_1px_rgba(252,211,77,0.34)]"
          >
            {part.text}
          </span>
        ) : (
          <React.Fragment key={index}>{part.text}</React.Fragment>
        )
      )}
    </span>
  );
}

export const BracketTokenHighlightedTextarea = React.forwardRef<
  HTMLTextAreaElement,
  BracketTokenHighlightedTextareaProps
>(function BracketTokenHighlightedTextarea(
  { value, containerClassName, className, onScroll, placeholder, style, ...textareaProps },
  forwardedRef
) {
  const mirrorRef = React.useRef<HTMLDivElement | null>(null);
  const parts = React.useMemo(() => splitBracketTokens(value), [value]);

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
      <div
        ref={mirrorRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-current"
        style={{ padding: 'inherit', boxSizing: 'border-box' }}
      >
        {value.length === 0 && placeholder ? (
          <span className="text-current opacity-45">{placeholder}</span>
        ) : (
          parts.map((part, index) =>
            part.token ? (
              <span
                key={index}
                className="rounded-[0.28rem] bg-amber-300/18 text-amber-100 shadow-[inset_0_0_0_1px_rgba(252,211,77,0.34)]"
              >
                {part.text}
              </span>
            ) : (
              <React.Fragment key={index}>{part.text}</React.Fragment>
            )
          )
        )}
      </div>
      <textarea
        {...textareaProps}
        ref={forwardedRef}
        value={value}
        placeholder=""
        onScroll={handleScroll}
        className={[
          'relative z-10 block h-full w-full resize-none border-0 bg-transparent p-0 text-transparent caret-slate-100 outline-none placeholder:text-transparent focus:outline-none focus:ring-0 disabled:cursor-not-allowed',
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
      />
    </div>
  );
});
