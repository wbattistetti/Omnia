import React from 'react';
import { MessageSquare, Ban } from 'lucide-react';
import ClassificationBadge, { ClassificationResult } from './ClassificationBadge';

interface PhraseRowProps {
  phrase: { id: string; text: string };
  phraseType: 'matching' | 'not-matching';
  intentId: string;
  intentName: string;
  classificationResult?: ClassificationResult;
  modelReady: boolean;
  testResult?: 'correct' | 'wrong';
  isExcluded?: boolean;
  onAddAsNotMatching?: (wrongIntentId: string, phraseText: string) => void;
  onToggleExclusion?: (phraseId: string, phraseText: string, currentIsExcluded: boolean) => void;
}

/**
 * Smart row component that renders phrase text with classification badge
 * Enterprise-ready: Self-contained, type-safe, performant
 */
export default function PhraseRow({
  phrase,
  phraseType,
  intentId,
  intentName,
  classificationResult,
  modelReady,
  testResult,
  isExcluded = false,
  onAddAsNotMatching,
  onToggleExclusion
}: PhraseRowProps) {
  // Render test result badge if available
  const renderTestBadge = () => {
    if (testResult === 'correct') {
      return (
        <span className="px-2 py-0.5 rounded-md border border-green-500 bg-green-50/70 text-green-700">
          {phrase.text}
        </span>
      );
    } else if (testResult === 'wrong') {
      return (
        <span className="px-2 py-0.5 rounded-md border border-red-500 bg-red-50/70 text-red-700">
          {phrase.text}
        </span>
      );
    }
    return phrase.text;
  };

  return (
    <div className="flex items-center gap-2 w-full min-w-0">
      {/* Icon based on phrase type or exclusion status - clickable to toggle */}
      {isExcluded ? (
        <Ban
          size={14}
          className="text-red-600 shrink-0 cursor-pointer hover:text-red-700 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExclusion?.(phrase.id, phrase.text, true);
          }}
          title="Clicca per riammettere la frase"
        />
      ) : (
        <MessageSquare
          size={14}
          className={`${phraseType === 'matching' ? 'text-emerald-600' : 'text-rose-600'} shrink-0 cursor-pointer hover:opacity-80 transition-opacity`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExclusion?.(phrase.id, phrase.text, false);
          }}
          title="Clicca per escludere la frase"
        />
      )}

      {/* Text with test result badge if available, red if excluded */}
      <span className={`truncate flex-1 min-w-0 ${isExcluded ? 'text-red-600' : ''}`}>
        {renderTestBadge()}
      </span>

      {/* Classification badge with 15px spacing from text */}
      {modelReady && classificationResult && (
        <div className="shrink-0 ml-[15px]">
          {classificationResult.loading ? (
            <div className="flex items-center gap-1 text-gray-400">
              <span className="text-xs">Classificando...</span>
            </div>
          ) : classificationResult.intentId ? (
            <ClassificationBadge
              result={classificationResult}
              expectedIntentId={intentId}
              expectedIntentName={intentName}
              phraseType={phraseType}
              phraseText={phrase.text}
              onAddAsNotMatching={onAddAsNotMatching}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
