import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import SmartTooltip from '../SmartTooltip';
import { useFontContext } from '../../context/FontContext';

export type ToolbarDropdownItem = {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
};

type ToolbarButton = {
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
  title?: string;
  active?: boolean;
  primary?: boolean;
  disabled?: boolean;
  buttonRef?: React.RefObject<HTMLButtonElement> | ((ref: HTMLButtonElement | null) => void);
  buttonId?: string; // For identifying specific buttons
  dropdownItems?: ToolbarDropdownItem[]; // ✅ NEW: Support for dropdown menu
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

// ✅ NEW: Component for dropdown button
function ToolbarDropdownButton({
  btn,
  buttonRef,
  theme
}: {
  btn: ToolbarButton;
  buttonRef: React.RefObject<HTMLButtonElement> | null;
  theme: { bg: string; fg: string; border: string; accent?: string };
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const buttonElementRef = React.useRef<HTMLButtonElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = React.useState<{ top: number; left: number } | null>(null);

  // ✅ Calculate dropdown position when opened
  React.useEffect(() => {
    if (isOpen && buttonElementRef.current) {
      const rect = buttonElementRef.current.getBoundingClientRect();
      const dropdownWidth = 220;
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.right + window.scrollX - dropdownWidth, // Align to right edge
      });
    } else {
      setDropdownPosition(null);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonElementRef.current &&
        !buttonElementRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Sync external ref
  React.useEffect(() => {
    if (buttonRef && buttonElementRef.current) {
      if ('current' in buttonRef) {
        (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = buttonElementRef.current;
      }
    }
  }, [buttonRef]);

  const buttonProps = {
    ref: (el: HTMLButtonElement | null) => {
      buttonElementRef.current = el;
      if (buttonRef && 'current' in buttonRef) {
        (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
      }
    },
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsOpen(!isOpen);
    },
    disabled: btn.disabled,
    'data-button-id': btn.buttonId,
    style: {
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
      whiteSpace: 'nowrap' as const,
    },
  };

  const button = (
    <button {...buttonProps}>
      {btn.icon}
      {btn.label && <span>{btn.label}</span>}
    </button>
  );

  return (
    <>
      {button}
      {isOpen && btn.dropdownItems && btn.dropdownItems.length > 0 && dropdownPosition && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            backgroundColor: theme.bg,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 99999,
            minWidth: 220,
            padding: 4,
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {btn.dropdownItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                item.onClick();
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                color: theme.fg,
                cursor: 'pointer',
                borderRadius: 4,
                textAlign: 'left' as const,
                fontSize: 14,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {item.icon && <span>{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

export function EditorHeader({ icon, title, subtitle, titleActions, toolbarButtons = [], rightActions, onClose, color = 'orange', className, style }: EditorHeaderProps) {
  // ✅ DEBUG: Log toolbar buttons received
  React.useEffect(() => {
    console.log('[EditorHeader] 📥 Received toolbarButtons', {
      count: toolbarButtons.length,
      buttons: toolbarButtons.map((btn, i) => ({
        index: i,
        label: btn.label,
        hasIcon: !!btn.icon,
        primary: btn.primary,
        active: btn.active,
        hasTitle: !!btn.title,
        iconType: btn.icon?.type?.name || btn.icon?.type || 'unknown'
      }))
    });
  }, [toolbarButtons]);
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
            {toolbarButtons.map((btn, i) => {
              // ✅ FIX: Usa il ref passato dalla prop se disponibile, altrimenti null
              const buttonRef = btn.buttonRef && 'current' in btn.buttonRef
                ? btn.buttonRef as React.RefObject<HTMLButtonElement>
                : null;

              // ✅ NEW: Support for dropdown buttons
              if (btn.dropdownItems && btn.dropdownItems.length > 0) {
                return <ToolbarDropdownButton key={i} btn={btn} buttonRef={buttonRef} theme={theme} />;
              }

              const buttonProps = {
                ref: buttonRef, // ✅ Usa direttamente il ref passato (può essere null)
                onClick: btn.onClick,
                disabled: btn.disabled,
                'data-button-id': btn.buttonId,
                style: {
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
                  whiteSpace: 'nowrap' as const,
                },
              };

              const button = (
                <button {...buttonProps}>
                  {btn.icon}
                  {btn.label && <span>{btn.label}</span>}
                </button>
              );

              return btn.title ? (
                <SmartTooltip key={i} text={btn.title} tutorId={`toolbar_btn_${i}_help`} placement="bottom">
                  {buttonRef ? React.cloneElement(button, {
                    ref: (el: HTMLButtonElement | null) => {
                      // ✅ DEBUG: Log solo quando il ref viene assegnato per la prima volta
                      if (btn.buttonId === 'save-to-library' && el) {
                        console.log('[EditorHeader] 🎯 Ref assigned for save-to-library button', {
                          tagName: el?.tagName,
                          dataButtonId: el?.getAttribute('data-button-id')
                        });
                      }
                      if (buttonRef && 'current' in buttonRef) {
                        (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
                      }
                    }
                  }) : button}
                </SmartTooltip>
              ) : (
                <React.Fragment key={i}>{button}</React.Fragment>
              );
            })}
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


