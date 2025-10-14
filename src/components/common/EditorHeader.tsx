import React from 'react';

type EditorHeaderProps = {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  rightActions?: React.ReactNode;
  onClose?: () => void;
  color?: 'slate' | 'orange' | 'purple';
  className?: string;
  style?: React.CSSProperties;
};

const THEMES: Record<string, { bg: string; fg: string; border: string; accent?: string }> = {
  slate: { bg: '#0f172a', fg: '#ffffff', border: '#1e293b' },
  orange: { bg: '#9a4f00', fg: '#ffffff', border: '#c77e2d' },
  purple: { bg: '#5b21b6', fg: '#ffffff', border: '#7c3aed' },
};

export function EditorHeader({ icon, title, subtitle, rightActions, onClose, color = 'orange', className, style }: EditorHeaderProps) {
  const theme = THEMES[color] || THEMES.orange;
  return (
    <div
      className={className}
      style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 12px',
        background: theme.bg,
        color: theme.fg,
        borderBottom: `1px solid ${theme.border}`,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {icon ? <div style={{ width: 18, height: 18 }}>{icon}</div> : null}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ fontWeight: 600, lineHeight: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 11, opacity: 0.8 }}>{subtitle}</div> : null}
        </div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        {rightActions}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              height: 28,
              padding: '0 10px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'transparent',
              color: theme.fg,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}

export default EditorHeader;


