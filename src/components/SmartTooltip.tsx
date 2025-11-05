import React, { useState, useRef } from 'react';
import { HelpCircle, GraduationCap } from 'lucide-react';
import { useFontStore } from '../state/fontStore';
import { emitTutorOpen } from '../ui/events';

type SmartTooltipProps = {
  text: string;
  tutorId?: string;
  placement?: 'right' | 'left' | 'top' | 'bottom';
  children: React.ReactNode;
};

const SmartTooltip: React.FC<SmartTooltipProps> = ({
  text,
  tutorId,
  placement = 'bottom',
  children,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { fontSize } = useFontStore();

  // Font size mapping basato sul font centralizzato
  const sizeMap = {
    xs: '10px',
    sm: '12px',
    base: '14px',
    md: '16px',
    lg: '18px',
  };

  const tooltipFontSize = sizeMap[fontSize];

  // Tooltip positioning
  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 10000,
    ...(placement === 'right' && { top: '50%', left: '100%', transform: 'translateY(-50%)', marginLeft: 12 }),
    ...(placement === 'left' && { top: '50%', right: '100%', transform: 'translateY(-50%)', marginRight: 12 }),
    ...(placement === 'top' && { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 12 }),
    ...(placement === 'bottom' && { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 12 }),
  };

  const handleTutorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tutorId) {
      emitTutorOpen(tutorId);
    }
  };

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && (
        <div
          style={tooltipStyle}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div
            className="rounded-lg shadow-lg flex items-center"
            style={{
              backgroundColor: '#fefce8', // Giallo pallidissimo
              color: '#854d0e', // Testo marrone scuro per leggibilità
              border: '1px solid #fde68a', // Bordo giallo chiaro
              fontSize: tooltipFontSize,
              lineHeight: 1.4,
              padding: '6px 8px',
              width: 'max-content',
              maxWidth: 500,
              pointerEvents: 'auto',
              boxSizing: 'border-box',
            }}
            role="tooltip"
          >
            <GraduationCap
              size={16}
              style={{
                color: '#ca8a04',
                flexShrink: 0,
                marginRight: 6,
              }}
            />
            <span
              style={{
                whiteSpace: 'nowrap',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
              }}
            >
              {text}
            </span>
            <button
              onClick={handleTutorClick}
              className="focus:outline-none"
              aria-label={tutorId ? "Open help" : "Help"}
              tabIndex={0}
              disabled={!tutorId}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                marginLeft: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: tutorId ? 'pointer' : 'default',
                flexShrink: 0,
                opacity: tutorId ? 1 : 0.5,
                color: '#2563eb',
                width: 16,
                height: 16,
              }}
            >
              <HelpCircle size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartTooltip;