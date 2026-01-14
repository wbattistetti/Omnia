import React, { useState } from 'react';
import { CheckCircle2, XCircle, Info, Loader2 } from 'lucide-react';

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

  // Build suggestion text for tooltip
  const getSuggestionText = (): string => {
    if (result.isCorrect) {
      return `Classificazione corretta: questa frase è stata riconosciuta come "${result.intentName}" con confidenza ${Math.round(result.score * 100)}%.`;
    }

    // Incorrect classification
    if (phraseType === 'matching') {
      return `Classificazione errata: questa frase è stata classificata come "${result.intentName}" ma dovrebbe essere "${expectedIntentName}".\n\nSuggerimenti:\n• Aggiungi più frasi simili all'intento "${expectedIntentName}"\n• Aggiungi questa frase come "not-matching" per "${result.intentName}"`;
    } else {
      // not-matching phrase
      return `Classificazione errata: questa frase è stata classificata come "${result.intentName}" ma NON dovrebbe essere riconosciuta.\n\nSuggerimenti:\n• Aggiungi questa frase come "not-matching" per "${result.intentName}"`;
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
          className="relative"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <Info
            size={14}
            className="text-blue-500 cursor-help hover:text-blue-600 transition-colors"
            title="Clicca per vedere i suggerimenti"
          />

          {/* Tooltip */}
          {showTooltip && (
            <div
              className="absolute right-0 bottom-full mb-1 z-50 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700"
              style={{ whiteSpace: 'pre-line' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 font-semibold text-white border-b border-gray-700 pb-1">
                Suggerimento
              </div>
              <div className="text-gray-200 leading-relaxed">
                {getSuggestionText()}
              </div>
              {phraseType === 'matching' && result.intentId && onAddAsNotMatching && (
                <button
                  onClick={handleAddAsNotMatching}
                  className="mt-3 w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors font-medium"
                >
                  Aggiungi come not-matching per "{result.intentName}"
                </button>
              )}
              {/* Tooltip arrow pointing down */}
              <div className="absolute -bottom-1 right-4 w-2 h-2 bg-gray-900 border-r border-b border-gray-700 transform rotate-45" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
