/**
 * Row header: icon + optional label chip. No message body text.
 */

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { UC_RESPONSE_LABEL_GAP } from '../../EditorHost/editors/aiAgentEditor/useCaseComposerPresentation';

export type TaskRowHeaderProps = {
  icon?: React.ReactNode;
  /** When true, show default message icon if icon prop is absent. */
  showMessageIcon?: boolean;
  label?: string;
  color: string;
  /** Fixed-width icon column (e.g. use case response alignment). */
  iconColumnClassName?: string;
  /** Class on label chip after icon (default 5px for use case). */
  labelGapClassName?: string;
  /** Trailing slot (e.g. delete on hover), kept on same baseline as label. */
  trailing?: React.ReactNode;
};

export function TaskRowHeader({
  icon,
  showMessageIcon,
  label,
  color,
  iconColumnClassName,
  labelGapClassName = UC_RESPONSE_LABEL_GAP,
  trailing,
}: TaskRowHeaderProps) {
  const showIcon =
    icon ?? (showMessageIcon ? <MessageCircle size={16} color={color} style={{ flexShrink: 0 }} /> : null);
  const iconColClass =
    iconColumnClassName ?? 'inline-flex h-6 w-6 shrink-0 items-center justify-center';

  return (
    <span className="inline-flex min-w-0 items-center">
      {showIcon ? (
        <span className={iconColClass} style={{ color }}>
          {showIcon}
        </span>
      ) : null}
      {label ? (
        <span
          className={labelGapClassName}
          style={{
            background: '#222',
            color: '#fff',
            borderRadius: 8,
            padding: '2px 8px',
            fontWeight: 500,
            display: 'inline-block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 220,
          }}
        >
          {label}
        </span>
      ) : null}
      {trailing ?? null}
    </span>
  );
}
