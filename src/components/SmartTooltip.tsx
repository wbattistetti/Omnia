import React, { useState, useRef } from 'react';
import { HelpCircle } from 'lucide-react';

type SmartTooltipProps = {
  text: string;
  tutorId?: string;
  placement?: 'right' | 'left' | 'top' | 'bottom';
  children: React.ReactNode;
};

const SmartTooltip: React.FC<SmartTooltipProps> = ({
  text,
  tutorId,
  placement = 'right',
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [hoverTooltip, setHoverTooltip] = useState(false);

  // Tooltip positioning
  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 100,
    ...(placement === 'right' && { top: 0, left: '100%', marginLeft: 12 }),
    ...(placement === 'left' && { top: 0, right: '100%', marginRight: 12 }),
    ...(placement === 'top' && { bottom: '100%', left: 0, marginBottom: 12 }),
    ...(placement === 'bottom' && { top: '100%', left: 0, marginTop: 12 }),
  };

  // Chiudi solo se mouse lascia sia trigger che tooltip
  const shouldShowTooltip = open || hoverTooltip;

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShowHelp(true)}
      onMouseLeave={() => { setShowHelp(false); }}
    >
      {children}
      {showHelp && !open && (
        <button
          onClick={e => { e.stopPropagation(); setOpen(true); }}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            transform: 'translate(50%,-50%)',
            zIndex: 10,
            background: 'white',
            border: '1.5px solid #2563eb',
            borderRadius: '50%',
            color: '#2563eb',
            cursor: 'pointer',
            padding: 0,
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 4px #0001'
          }}
          aria-label="Aiuto"
        >
          <HelpCircle size={16} />
        </button>
      )}
      {shouldShowTooltip && (
        <div
          style={tooltipStyle}
          onMouseEnter={() => setHoverTooltip(true)}
          onMouseLeave={() => { setHoverTooltip(false); setOpen(false); }}
        >
          <div
            className="bg-white text-gray-800 border border-gray-300 rounded-xl shadow-md px-5 py-4 flex items-start justify-between gap-2"
            style={{
              minWidth: 320,
              maxWidth: 600,
              width: 'max-content',
              fontSize: 15,
              lineHeight: 1.6,
              whiteSpace: 'pre-line',
              wordBreak: 'break-word',
            }}
            tabIndex={0}
            role="tooltip"
          >
            <div style={{ flex: 1 }}>{text}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {tutorId && (
                <button
                  onClick={() => alert('Open tutor: ' + tutorId)}
                  className="text-blue-600 hover:text-blue-800 focus:outline-none ml-2"
                  aria-label="Apri tutor"
                  tabIndex={0}
                  style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => { setOpen(false); setHoverTooltip(false); setShowHelp(false); }}
                aria-label="Chiudi tooltip"
                style={{ background: 'none', border: 'none', color: '#888', marginLeft: 2, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', padding: 0 }}
                tabIndex={0}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="6" x2="14" y2="14" /><line x1="14" y1="6" x2="6" y2="14" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartTooltip; 