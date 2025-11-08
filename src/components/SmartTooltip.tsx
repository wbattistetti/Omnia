import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HelpCircle, GraduationCap, X } from 'lucide-react';
import { useFontStore } from '../state/fontStore';
import { emitTutorOpen } from '../ui/events';

export interface ToolbarButton {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'default';
}

type SmartTooltipProps = {
  text: string;
  tutorId?: string;
  placement?: 'right' | 'left' | 'top' | 'bottom';
  children: React.ReactNode;
  // New extended props
  showOnMount?: boolean; // Show on mount instead of hover
  delay?: number; // Override default delay (default: 1250ms, -1 = persistent until dismissed)
  persistent?: boolean; // Show until dismissed (delay ignored)
  storageKey?: string; // localStorage key for persistence
  foreColor?: string; // Text color (default: based on placement)
  backColor?: string; // Background color (default: '#fefce8')
  opacity?: number; // Opacity 0-1 (default: 1)
  align?: 'left' | 'right' | 'center'; // Horizontal alignment (for top/bottom placement)
  offset?: number; // Distance from target (default: 12px)
  toolbar?: ToolbarButton[]; // Custom toolbar buttons
  showQuestionMark?: boolean; // Show default "?" button (default: true if tutorId exists)
  onDismiss?: () => void; // Callback when dismissed
  onShow?: () => void; // Callback when shown
};

const SmartTooltip: React.FC<SmartTooltipProps> = ({
  text,
  tutorId,
  placement = 'bottom',
  children,
  showOnMount = false,
  delay,
  persistent = false,
  storageKey,
  foreColor,
  backColor,
  opacity,
  align = 'left',
  offset,
  toolbar,
  showQuestionMark,
  onDismiss,
  onShow,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [contentStyle, setContentStyle] = useState<React.CSSProperties>({});
  const [isPositionCalculated, setIsPositionCalculated] = useState(false);
  const { fontSize } = useFontStore();

  // Check localStorage for dismissed state
  const isDismissed = useCallback(() => {
    if (!storageKey) return false;
    try {
      const dismissed = localStorage.getItem(storageKey);
      return dismissed === 'true';
    } catch {
      return false;
    }
  }, [storageKey]);

  // Mark as dismissed
  const markDismissed = useCallback(() => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, 'true');
      } catch {}
    }
    setShowTooltip(false);
    onDismiss?.();
  }, [storageKey, onDismiss]);

  // Font size mapping basato sul font centralizzato
  const sizeMap = {
    xs: '10px',
    sm: '12px',
    base: '14px',
    md: '16px',
    lg: '18px',
  };

  const tooltipFontSize = sizeMap[fontSize];

  // Calcola larghezza minima per 10-12 parole (stima approssimativa)
  const calculateMinWidthForWords = (words: number, fontSize: string): number => {
    // Stima: ogni parola media è ~6 caratteri, ogni carattere ~0.6 * fontSize
    const fontSizeNum = parseFloat(fontSize) || 14;
    const avgCharWidth = fontSizeNum * 0.6;
    const avgWordWidth = 6 * avgCharWidth;
    return Math.round(words * avgWordWidth + 40); // +40 per padding e icone
  };

  // Algoritmo intelligente per posizionamento e dimensionamento
  useEffect(() => {
    if (!showTooltip || !wrapperRef.current) {
      setIsPositionCalculated(false);
      return;
    }

    const updateTooltipPosition = () => {
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      if (!wrapperRect) return;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 12; // Margine minimo dal bordo viewport

      // Calcola larghezza minima per 10-12 parole
      const words = text.split(/\s+/).length;
      const minWordsPerLine = 10;
      const minWidthForWords = calculateMinWidthForWords(minWordsPerLine, tooltipFontSize);

      // ✅ Determina il placement effettivo PRIMA del render del tooltip
      // NON fare mai il controllo per mettersi sopra - usa sempre bottom come default per evitare flickering
      let effectivePlacement = placement;

      // Se placement è 'bottom' o non specificato, usa SEMPRE 'bottom' (non controllare spazio sopra)
      if (placement === 'bottom' || placement === undefined || placement === null) {
        // ✅ Sempre bottom - non fare mai il controllo per spazio sopra per evitare flickering
        effectivePlacement = 'bottom';
      }

      // Per placement bottom/top: allinea secondo align prop
      if (effectivePlacement === 'bottom' || effectivePlacement === 'top') {
        // Spazio disponibile a destra dall'elemento
        const spaceRight = viewportWidth - wrapperRect.left - padding;
        const spaceLeft = wrapperRect.left - padding;

        // Larghezza ideale: quanto più largo possibile senza uscire
        let idealWidth = Math.min(spaceRight, 600); // Max 600px

        // Se il testo è corto e c'è spazio, usa tutto lo spazio disponibile
        const estimatedTextWidth = calculateMinWidthForWords(words, tooltipFontSize);
        if (estimatedTextWidth < spaceRight) {
          idealWidth = Math.min(estimatedTextWidth + 40, spaceRight); // +40 per padding
        }

        // Determina se serve wrapping
        const needsWrap = idealWidth < estimatedTextWidth || words > 20;
        const finalWidth = needsWrap ? Math.max(minWidthForWords, idealWidth) : idealWidth;

        // Calcola posizione orizzontale basata su align
        let leftPosition = 0;
        if (align === 'right') {
          leftPosition = wrapperRect.width - finalWidth; // Allinea a destra
        } else if (align === 'center') {
          leftPosition = (wrapperRect.width - finalWidth) / 2; // Centrato
        } else {
          // 'left' è default: allineato a sinistra
          leftPosition = 0;
        }

        // Verifica se esce dal viewport e aggiusta se necessario
        if (wrapperRect.left + leftPosition + finalWidth > viewportWidth - padding) {
          // Esce a destra: calcola quanto spostare a sinistra
          const wouldExceed = (wrapperRect.left + leftPosition + finalWidth) - (viewportWidth - padding);
          leftPosition = leftPosition - wouldExceed;

          // Verifica che non esca a sinistra
          if (wrapperRect.left + leftPosition < padding) {
            // Sposta il bordo sinistro al padding minimo
            leftPosition = padding - wrapperRect.left;
            // Riduci la larghezza se necessario
            const maxPossibleWidth = viewportWidth - padding - (wrapperRect.left + leftPosition);
            idealWidth = Math.min(finalWidth, maxPossibleWidth);
          }
        }

        // Posizionamento: allineato secondo align, eventualmente spostato
        const marginOffset = offset ?? 12;
        const tooltipPosStyle: React.CSSProperties = {
          position: 'absolute',
          zIndex: 10000,
          ...(effectivePlacement === 'bottom' && {
            top: '100%',
            left: leftPosition,
            marginTop: marginOffset,
          }),
          ...(effectivePlacement === 'top' && {
            bottom: '100%',
            left: leftPosition,
            marginBottom: marginOffset,
          }),
        };

        const defaultBackColor = backColor || '#fefce8';
        const defaultForeColor = foreColor || '#854d0e';
        const defaultBorderColor = foreColor || '#fde68a';
        const tooltipOpacity = opacity ?? 1;

        const contentPosStyle: React.CSSProperties = {
          backgroundColor: defaultBackColor,
          color: defaultForeColor,
          border: `1px solid ${defaultBorderColor}`,
          fontSize: tooltipFontSize,
          lineHeight: 1.4,
          padding: '4px 6px',
          width: needsWrap ? 'auto' : 'max-content',
          maxWidth: idealWidth,
          minWidth: needsWrap ? minWidthForWords : 'auto',
          pointerEvents: 'auto',
          boxSizing: 'border-box',
          opacity: tooltipOpacity,
        };

        setTooltipStyle(tooltipPosStyle);
        setContentStyle(contentPosStyle);
        setIsPositionCalculated(true); // ✅ Marca come calcolato
      } else {
        // Per placement right/left: usa logica originale
        const tooltipPosStyle: React.CSSProperties = {
          position: 'absolute',
          zIndex: 10000,
          ...(placement === 'right' && { top: '50%', left: '100%', transform: 'translateY(-50%)', marginLeft: 12 }),
          ...(placement === 'left' && { top: '50%', right: '100%', transform: 'translateY(-50%)', marginRight: 12 }),
        };

        const defaultBackColor = backColor || '#fefce8';
        const defaultForeColor = foreColor || '#854d0e';
        const defaultBorderColor = foreColor || '#fde68a';
        const tooltipOpacity = opacity ?? 1;

        const contentPosStyle: React.CSSProperties = {
          backgroundColor: defaultBackColor,
          color: defaultForeColor,
          border: `1px solid ${defaultBorderColor}`,
          fontSize: tooltipFontSize,
          lineHeight: 1.4,
          padding: '4px 6px',
          width: 'max-content',
          maxWidth: 500,
          pointerEvents: 'auto',
          boxSizing: 'border-box',
          opacity: tooltipOpacity,
        };

        setTooltipStyle(tooltipPosStyle);
        setContentStyle(contentPosStyle);
        setIsPositionCalculated(true); // ✅ Marca come calcolato
      }
    };

    // ✅ Calcola immediatamente (senza delay) per evitare flickering
    // Il tooltip verrà renderizzato invisibile finché isPositionCalculated non è true
    updateTooltipPosition();

    window.addEventListener('resize', updateTooltipPosition);
    window.addEventListener('scroll', updateTooltipPosition, true);

    return () => {
      window.removeEventListener('resize', updateTooltipPosition);
      window.removeEventListener('scroll', updateTooltipPosition, true);
    };
  }, [showTooltip, placement, text, tooltipFontSize]);

  const handleTutorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tutorId) {
      emitTutorOpen(tutorId);
    }
  };

  // Handle mouse enter with delay
  const handleMouseEnter = () => {
    // Don't show on hover if showOnMount is true or if dismissed
    if (showOnMount || isDismissed()) return;

    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Use custom delay or default 1250ms
    const delayMs = delay !== undefined ? (delay === -1 ? 0 : delay) : 1250;

    // Set tooltip to show after delay
    timerRef.current = setTimeout(() => {
      if (!isDismissed()) {
        setShowTooltip(true);
        onShow?.();
      }
    }, delayMs);
  };

  // Handle mouse leave - clear timer and hide tooltip (unless persistent)
  const handleMouseLeave = () => {
    if (persistent) return; // Don't hide if persistent

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShowTooltip(false);
  };

  // Show on mount if configured
  useEffect(() => {
    if (!showOnMount) return;
    if (isDismissed()) return;

    const delayMs = delay !== undefined ? (delay === -1 ? 0 : delay) : 0;

    if (delayMs === 0) {
      setShowTooltip(true);
      onShow?.();
    } else {
      timerRef.current = setTimeout(() => {
        if (!isDismissed()) {
          setShowTooltip(true);
          onShow?.();
        }
      }, delayMs);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [showOnMount, delay, onShow, isDismissed]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Don't render if dismissed
  if (isDismissed()) {
    return <>{children}</>;
  }

  const shouldShowQuestionMark = showQuestionMark !== false && tutorId !== undefined;
  const hasToolbar = toolbar && toolbar.length > 0;
  const hasCloseButton = persistent;
  const showToolbar = hasToolbar || shouldShowQuestionMark || hasCloseButton;

  const buttonVariants = {
    primary: { background: foreColor || '#2563eb', color: '#fff', border: 'none' },
    secondary: { background: '#64748b', color: '#fff', border: 'none' },
    danger: { background: '#ef4444', color: '#fff', border: 'none' },
    default: { background: 'transparent', color: foreColor || '#2563eb', border: `1px solid ${foreColor || '#2563eb'}` },
  };

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {showTooltip && (
        <div
          ref={tooltipRef}
          style={{
            ...tooltipStyle,
            opacity: isPositionCalculated ? (opacity ?? 1) : 0, // ✅ Invisibile finché posizionamento non calcolato
            transition: isPositionCalculated ? 'opacity 0.05s ease-in' : 'none', // Smooth fade-in
            pointerEvents: isPositionCalculated ? 'auto' : 'none' // Disabilita interazioni finché non visibile
          }}
          onMouseEnter={persistent ? handleMouseEnter : handleMouseEnter}
          onMouseLeave={persistent ? undefined : handleMouseLeave}
        >
          <div
            className="rounded-lg shadow-lg"
            style={{
              ...contentStyle,
              display: 'flex',
              flexDirection: 'column',
              gap: hasToolbar ? 4 : 0,
            }}
            role="tooltip"
          >
            {/* Main content row - text and question mark icon on same line */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 4,
                position: 'relative',
              }}
            >
              {!hasToolbar && (
                <GraduationCap
                  size={16}
                  style={{
                    color: foreColor || '#ca8a04',
                    flexShrink: 0,
                    marginTop: 1, // Slight alignment adjustment
                  }}
                />
              )}
              <span
                style={{
                  whiteSpace: contentStyle.width === 'auto' ? 'normal' : 'nowrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  flex: '1 1 auto',
                  minWidth: 0,
                  lineHeight: 1.4,
                }}
              >
                {text}
              </span>
              {/* Question mark icon - inline with text, or top-right if wrapped */}
              {shouldShowQuestionMark && (
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
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    cursor: tutorId ? 'pointer' : 'default',
                    flexShrink: 0,
                    opacity: tutorId ? 1 : 0.5,
                    color: foreColor || '#2563eb',
                    width: 16,
                    height: 16,
                    marginTop: 0, // Align to top when text wraps
                    marginLeft: 4,
                  }}
                >
                  <HelpCircle size={16} />
                </button>
              )}
            </div>

            {/* Toolbar row - only for custom toolbar buttons and close button */}
            {(hasToolbar || hasCloseButton) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: hasToolbar ? 0 : 0 }}>
                {/* Custom toolbar buttons */}
                {toolbar?.map((btn, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      btn.onClick();
                      // Auto-dismiss if button label contains "got it" or similar
                      if (btn.label.toLowerCase().includes('got it') || btn.label.toLowerCase().includes('ok')) {
                        markDismissed();
                      }
                    }}
                    style={{
                      ...buttonVariants[btn.variant || 'default'],
                      borderRadius: 4,
                      padding: '4px 12px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontWeight: 500,
                      transition: 'opacity 0.2s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    {btn.icon}
                    {btn.label}
                  </button>
                ))}

                {/* Close button for persistent mode */}
                {hasCloseButton && (
                  <button
                    onClick={markDismissed}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: foreColor || '#854d0e',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 4,
                      transition: 'background 0.2s',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    title="Close"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartTooltip;