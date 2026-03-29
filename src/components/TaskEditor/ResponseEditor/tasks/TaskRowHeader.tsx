/**
 * Row header: icon + optional label chip. No message body text.
 */

import React from 'react';
import { MessageCircle } from 'lucide-react';

export type TaskRowHeaderProps = {
  icon?: React.ReactNode;
  /** When true, show default message icon if icon prop is absent. */
  showMessageIcon?: boolean;
  label?: string;
  color: string;
};

export function TaskRowHeader({ icon, showMessageIcon, label, color }: TaskRowHeaderProps) {
  const showIcon = icon ?? (showMessageIcon ? <MessageCircle size={16} color={color} style={{ flexShrink: 0 }} /> : null);

  return (
    <>
      {showIcon ? (
        <span style={{ color, display: 'flex', alignItems: 'center', marginRight: 8 }}>{showIcon}</span>
      ) : null}
      {label ? (
        <span
          style={{
            background: '#222',
            color: '#fff',
            borderRadius: 8,
            padding: '2px 8px',
            fontWeight: 500,
            marginRight: 8,
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
    </>
  );
}
