/**
 * Due bolle sovrapposte a colori diversi: messaggio con variazioni di stile (token «» o esempi).
 */

import React from 'react';
import { MessageSquareText } from 'lucide-react';

export function StyleVariationsDoubleMessageIcon({
  size = 15,
}: {
  size?: number;
}): React.ReactElement {
  return (
    <span
      className="relative inline-flex h-6 w-[22px] shrink-0 items-center justify-center"
      aria-hidden
    >
      <MessageSquareText
        size={size}
        className="absolute left-0 top-[4px] text-emerald-400/55"
        strokeWidth={2}
      />
      <MessageSquareText
        size={size}
        className="absolute left-[6px] top-0 text-sky-300 drop-shadow-[0_0_1px_rgba(0,0,0,0.4)]"
        strokeWidth={2.25}
      />
    </span>
  );
}
