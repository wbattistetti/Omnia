/**
 * Icona messaggio agente in base allo stato: singola, parametrica, variazioni di stile.
 */

import React from 'react';
import type { AgentMessageIconKind } from './agentMessageIconKind';
import { DoubleMessageIcon } from './DoubleMessageIcon';
import { SingleMessageIcon } from './SingleMessageIcon';
import { StyleVariationsDoubleMessageIcon } from './StyleVariationsDoubleMessageIcon';

const KIND_TITLE: Record<AgentMessageIconKind, string> = {
  single: 'Messaggio agente',
  parametric: 'Messaggio parametrico',
  style: 'Messaggio con variazioni di stile',
};

export function AgentMessageKindIcon({
  kind,
  size = 15,
}: {
  kind: AgentMessageIconKind;
  size?: number;
}): React.ReactElement {
  if (kind === 'single') {
    return <SingleMessageIcon size={size} />;
  }
  return (
    <span title={KIND_TITLE[kind]} aria-label={KIND_TITLE[kind]}>
      {kind === 'parametric' ? (
        <DoubleMessageIcon size={size} />
      ) : (
        <StyleVariationsDoubleMessageIcon size={size} />
      )}
    </span>
  );
}
