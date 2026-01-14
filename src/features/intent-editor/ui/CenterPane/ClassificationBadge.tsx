import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, Info, Loader2, AlertTriangle, Lightbulb } from 'lucide-react';

export interface ClassificationResult {
  intentId: string | undefined;
  intentName: string;
  score: number;
  isCorrect: boolean;
  loading: boolean;
  error?: string;
}

interface ClassificationBadgeProps {
  result: ClassificationResult;
  expectedIntentId: string;
  expectedIntentName: string;
  phraseType: 'matching' | 'not-matching';
  phraseText: string;
  onAddAsNotMatching?: (wrongIntentId: string) => void;
}

/**
 * Badge component that displays classification result with suggestion tooltip
 * Enterprise-ready: Type-safe, accessible, performant
 */
export default function ClassificationBadge({
  result,
  expectedIntentId,
  expectedIntentName,
  phraseType,
  phraseText,
  onAddAsNotMatching
}: ClassificationBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0, arrowLeft: 0 });
  const infoIconRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate tooltip position when shown
  useEffect(() => {
    if (showTooltip && infoIconRef.current) {
      const rect = infoIconRef.current.getBoundingClientRect();
      const tooltipWidth = 320; // w-80 = 20rem = 320px
      const arrowWidth = 8; // w-2 = 0.5rem = 8px

      // Position tooltip above the icon, centered
      const left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
      const top = rect.top - 8; // mb-1 = 4px, plus some spacing

      // Arrow should be centered on the icon
      const arrowLeft = rect.left + (rect.width / 2);

      setTooltipPosition({ top, left, arrowLeft });
    }
  }, [showTooltip]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Handle mouse enter with immediate show
  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setShowTooltip(true);
  };

  // Handle mouse leave with delay to allow moving to tooltip
  const handleMouseLeave = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
      hideTimeoutRef.current = null;
    }, 150); // Small delay to allow mouse movement to tooltip
  };

  // Don't show badge if loading or no result
  if (result.loading) {
    return (
      <div className="flex items-center gap-1 text-gray-400 shrink-0">
        <Loader2 size={12} className="animate-spin" />
        <span className="text-xs">Classificando...</span>
      </div>
    );
  }

  if (!result.intentId || result.error) {
    return null;
  }

  const IntentIcon = result.isCorrect ? CheckCircle2 : XCircle;
  const intentColor = result.isCorrect ? 'text-green-600' : 'text-red-600';
  const bgColor = result.isCorrect
    ? 'bg-green-50 border-green-200'
    : 'bg-red-50 border-red-200';

  // Build tooltip content for incorrect classification
  const renderTooltipContent = () => {
    if (result.isCorrect) {
      return (
        <div className="text-gray-200 leading-relaxed">
          Classificazione corretta: questa frase è stata riconosciuta come <strong>"{result.intentName}"</strong> con confidenza {Math.round(result.score * 100)}%.
        </div>
      );
    }

    // Incorrect classification
    if (phraseType === 'matching') {
      return (
        <>
          {/* Problem section */}
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <span className="font-semibold text-red-500">Problema di classificazione:</span>
            </div>
            <div className="text-gray-200 leading-relaxed ml-5">
              La frase: <em className="text-gray-300">"{phraseText}"</em>
              <br />
              è stata classificata come <strong className="text-white">"{result.intentName}"</strong> ma dovrebbe essere <strong className="text-white">"{expectedIntentName}"</strong>.
            </div>
          </div>

          {/* Solutions section */}
          <div className="mb-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb size={14} className="text-yellow-400 shrink-0" />
              <span className="font-semibold text-green-500">Possibili soluzioni:</span>
            </div>
            <div className="text-gray-200 leading-relaxed ml-5 space-y-1.5">
              <div>
                1) Associa più variazioni della frase a <strong className="text-white">"{expectedIntentName}"</strong>
              </div>
              <div>
                2) Clicca qui:{" "}
                <button
                  onClick={handleAddAsNotMatching}
                  className="text-blue-400 hover:text-blue-300 underline font-medium"
                >
                  Escludi frase
                </button>
              </div>
              <div>
                3) Trascina la frase a sinistra sull'intent corretto.
              </div>
            </div>
          </div>
        </>
      );
    } else {
      // not-matching phrase
      return (
        <>
          {/* Problem section */}
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <span className="font-semibold text-red-500">Problema di classificazione:</span>
            </div>
            <div className="text-gray-200 leading-relaxed ml-5">
              La frase: <em className="text-gray-300">"{phraseText}"</em>
              <br />
              è stata classificata come <strong className="text-white">"{result.intentName}"</strong> ma NON dovrebbe essere riconosciuta.
            </div>
          </div>

          {/* Solutions section */}
          <div className="mb-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb size={14} className="text-yellow-400 shrink-0" />
              <span className="font-semibold text-green-500">Possibili soluzioni:</span>
            </div>
            <div className="text-gray-200 leading-relaxed ml-5">
              <div>
                Clicca qui:{" "}
                <button
                  onClick={handleAddAsNotMatching}
                  className="text-blue-400 hover:text-blue-300 underline font-medium"
                >
                  Escludi frase
                </button>
              </div>
            </div>
          </div>
        </>
      );
    }
  };

  const handleAddAsNotMatching = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (result.intentId && onAddAsNotMatching) {
      onAddAsNotMatching(result.intentId);
    }
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0 relative">
      {/* Main badge */}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${bgColor}`}>
        <IntentIcon size={12} className={intentColor} />
        <span className={`text-xs font-medium ${intentColor}`}>
          {result.intentName}
        </span>
        <span className="text-xs text-gray-500">
          ({Math.round(result.score * 100)}%)
        </span>
      </div>

      {/* Info icon with tooltip */}
      {!result.isCorrect && (
        <div
          ref={infoIconRef}
          className="relative"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Info
            size={14}
            className="text-blue-500 cursor-help hover:text-blue-600 transition-colors"
            title="Clicca per vedere i suggerimenti"
          />

          {/* Tooltip rendered via portal to avoid overflow clipping */}
          {showTooltip && typeof document !== 'undefined' && createPortal(
            <div
              className="fixed z-[9999] w-80 p-4 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700"
              style={{
                top: `${tooltipPosition.top}px`,
                left: `${tooltipPosition.left}px`,
                transform: 'translateY(-100%)',
                marginTop: '-4px'
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {renderTooltipContent()}
              {/* Tooltip arrow pointing down, centered on icon */}
              <div
                className="absolute -bottom-1 w-2 h-2 bg-gray-900 border-r border-b border-gray-700 transform rotate-45"
                style={{
                  left: `${tooltipPosition.arrowLeft - tooltipPosition.left}px`,
                  marginLeft: '-4px' // Center the arrow (w-2 = 8px, so -4px centers it)
                }}
              />
            </div>,
            document.body
          )}
        </div>
      )}
    </div>
  );
}
