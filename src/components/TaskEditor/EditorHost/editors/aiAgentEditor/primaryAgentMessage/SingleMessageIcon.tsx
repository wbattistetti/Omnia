/**
 * Icona messaggio agente canonico (nessuna variazione parametrica né di stile).
 */

import React from 'react';
import { MessageSquareText } from 'lucide-react';

export function SingleMessageIcon({ size = 15 }: { size?: number }): React.ReactElement {
  return (
    <span
      title="Messaggio agente"
      aria-label="Messaggio agente"
      className="shrink-0 inline-flex h-6 w-6 items-center justify-center text-emerald-300"
    >
      <MessageSquareText size={size} aria-hidden />
    </span>
  );
}
