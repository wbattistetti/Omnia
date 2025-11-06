import React from 'react';
import { X } from 'lucide-react';
import SmartTooltip from '../SmartTooltip';
import { useFontContext } from '../../context/FontContext';

type ToolbarButton = {
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
  title?: string;
  active?: boolean;
  primary?: boolean;
  disabled?: boolean;
};

type EditorHeaderProps = {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  titleActions?: React.ReactNode; // Actions to show right after title (before spacer)
  toolbarButtons?: ToolbarButton[];
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

export function EditorHeader({ icon, title, subtitle, titleActions, toolbarButtons = [], rightActions, onClose, color = 'orange', className, style }: EditorHeaderProps) {
  const theme = THEMES[color] || THEMES.orange;
  let combinedClass = '';
  try {
    const context = useFontContext();
    combinedClass = context.combinedClass;
  } catch {
    // Not within FontProvider, use default font classes
    combinedClass = 'font-intent-sans text-intent-base';
  }
  return (
    <div
      className={`${combinedClass} ${className || ''}`}
      style={{
        minHeight: 44,
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
      {/* Left: Icon + Title + TitleActions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {icon ? <div style={{ width: 18, height: 18, flexShrink: 0 }}>{icon}</div> : null}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ fontWeight: 600, lineHeight: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          {subtitle ? <div style={{ opacity: 0.8 }}>{subtitle}</div> : null}
        </div>
        {titleActions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            {titleActions}
          </div>
        )}
      </div>

      {/* Spacer to push everything to the right */}
      <div style={{ flex: 1 }} />

      {/* Right: Toolbar + Custom actions + Close */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Toolbar (auto-hidden if empty) */}
        {toolbarButtons.length > 0 && (
          <>
            {toolbarButtons.map((btn, i) => (
              btn.title ? (
                <SmartTooltip key={i} text={btn.title} tutorId={`toolbar_btn_${i}_help`} placement="bottom">
                  <button
                    onClick={btn.onClick}
                    disabled={btn.disabled}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: btn.primary ? '#0b1220' : (btn.active ? '#fff' : 'transparent'),
                      color: btn.primary ? '#fff' : (btn.active ? theme.bg : theme.fg),
                      border: btn.primary ? 'none' : `1px solid rgba(255,255,255,0.3)`,
                      borderRadius: 8,
                      padding: btn.label ? '8px 14px' : '6px 10px',
                      cursor: btn.disabled ? 'not-allowed' : 'pointer',
                      opacity: btn.disabled ? 0.5 : 1,
                      fontWeight: btn.primary ? 600 : 400,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {btn.icon}
                    {btn.label && <span>{btn.label}</span>}
                  </button>
                </SmartTooltip>
              ) : (
                <button
                  key={i}
                  onClick={btn.onClick}
                  disabled={btn.disabled}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: btn.primary ? '#0b1220' : (btn.active ? '#fff' : 'transparent'),
                    color: btn.primary ? '#fff' : (btn.active ? theme.bg : theme.fg),
                    border: btn.primary ? 'none' : `1px solid rgba(255,255,255,0.3)`,
                    borderRadius: 8,
                    padding: btn.label ? '8px 14px' : '6px 10px',
                    cursor: btn.disabled ? 'not-allowed' : 'pointer',
                    opacity: btn.disabled ? 0.5 : 1,
                    fontWeight: btn.primary ? 600 : 400,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {btn.icon}
                  {btn.label && <span>{btn.label}</span>}
                </button>
              )
            ))}
          </>
        )}
        {rightActions}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 10px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'transparent',
              color: theme.fg,
              cursor: 'pointer',
            }}
          >
            <X size={16} color="#ef4444" />
            Close
          </button>
        )}
      </div>
    </div>
  );
}

export default EditorHeader;


