/**
 * Icona messaggio agente canonico (nessuna variazione parametrica né di stile).
 */

import React from 'react';
import { MessageSquareText } from 'lucide-react';

export function SingleMessageIcon({ size = 16 }: { size?: number }): React.ReactElement {
  return (
    <span title="Messaggio agente" aria-label="Messaggio agente" className="text-emerald-300">
      <MessageSquareText size={size} aria-hidden />
    </span>
  );
}
