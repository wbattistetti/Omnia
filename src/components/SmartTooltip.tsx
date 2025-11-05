import React, { useState, useRef, useEffect } from 'react';
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
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [contentStyle, setContentStyle] = useState<React.CSSProperties>({});
  const [isPositionCalculated, setIsPositionCalculated] = useState(false);
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
      // Usa SEMPRE una stima fissa dell'altezza per evitare flickering dovuto a ri-calcoli
      let effectivePlacement = placement;

      // Se placement è 'bottom' o non specificato, verifica se c'è spazio sotto
      if (placement === 'bottom' || placement === undefined || placement === null) {
        // ✅ Stima FISSA dell'altezza del tooltip (non cambia mai per evitare flickering)
        const estimatedTooltipHeight = 60; // Stima conservativa sempre uguale
        const spaceBelow = viewportHeight - wrapperRect.bottom - padding;
        const spaceAbove = wrapperRect.top - padding;

        // Se non c'è spazio sotto ma c'è spazio sopra, usa 'top'
        // Aggiungi un margine di sicurezza (20px) per evitare che il tooltip tocchi i bordi
        if (spaceBelow < estimatedTooltipHeight + 20 && spaceAbove >= estimatedTooltipHeight + 20) {
          effectivePlacement = 'top';
        } else {
          effectivePlacement = 'bottom';
        }
      }

      // Per placement bottom/top: allinea a sinistra con l'elemento
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

        // Verifica se esce dal viewport a destra quando allineato a sinistra
        let leftPosition = 0; // Di default allineato a sinistra con l'elemento
        if (wrapperRect.left + finalWidth > viewportWidth - padding) {
          // Esce a destra: calcola quanto spostare a sinistra
          const wouldExceed = (wrapperRect.left + finalWidth) - (viewportWidth - padding);
          leftPosition = -wouldExceed;

          // Verifica che non esca a sinistra
          if (wrapperRect.left + leftPosition < padding) {
            // Sposta il bordo sinistro al padding minimo
            leftPosition = padding - wrapperRect.left;
            // Riduci la larghezza se necessario
            const maxPossibleWidth = viewportWidth - padding - (wrapperRect.left + leftPosition);
            idealWidth = Math.min(finalWidth, maxPossibleWidth);
          }
        }

        // Posizionamento: allineato a sinistra, eventualmente spostato
        const tooltipPosStyle: React.CSSProperties = {
          position: 'absolute',
          zIndex: 10000,
          ...(effectivePlacement === 'bottom' && {
            top: '100%',
            left: leftPosition,
            marginTop: 12,
          }),
          ...(effectivePlacement === 'top' && {
            bottom: '100%',
            left: leftPosition,
            marginBottom: 12,
          }),
        };

        const contentPosStyle: React.CSSProperties = {
          backgroundColor: '#fefce8',
          color: '#854d0e',
          border: '1px solid #fde68a',
          fontSize: tooltipFontSize,
          lineHeight: 1.4,
          padding: '6px 8px',
          width: needsWrap ? 'auto' : 'max-content',
          maxWidth: idealWidth,
          minWidth: needsWrap ? minWidthForWords : 'auto',
          pointerEvents: 'auto',
          boxSizing: 'border-box',
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

        const contentPosStyle: React.CSSProperties = {
          backgroundColor: '#fefce8',
          color: '#854d0e',
          border: '1px solid #fde68a',
          fontSize: tooltipFontSize,
          lineHeight: 1.4,
          padding: '6px 8px',
          width: 'max-content',
          maxWidth: 500,
          pointerEvents: 'auto',
          boxSizing: 'border-box',
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
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Set tooltip to show after 1.25 seconds (between 1 and 1.5 seconds)
    timerRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 1250);
  };

  // Handle mouse leave - clear timer and hide tooltip
  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShowTooltip(false);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

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
            opacity: isPositionCalculated ? 1 : 0, // ✅ Invisibile finché posizionamento non calcolato
            transition: isPositionCalculated ? 'opacity 0.05s ease-in' : 'none', // Smooth fade-in
            pointerEvents: isPositionCalculated ? 'auto' : 'none' // Disabilita interazioni finché non visibile
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className="rounded-lg shadow-lg flex items-center"
            style={contentStyle}
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
                whiteSpace: contentStyle.width === 'auto' ? 'normal' : 'nowrap',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                flex: contentStyle.width === 'auto' ? '1 1 auto' : '0 0 auto',
                minWidth: 0,
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