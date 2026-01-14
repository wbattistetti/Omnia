import React from 'react';
import { MessageSquare } from 'lucide-react';
import ClassificationBadge, { ClassificationResult } from './ClassificationBadge';

interface PhraseRowProps {
  phrase: { id: string; text: string };
  phraseType: 'matching' | 'not-matching';
  intentId: string;
  intentName: string;
  classificationResult?: ClassificationResult;
  modelReady: boolean;
  testResult?: 'correct' | 'wrong';
  onAddAsNotMatching?: (wrongIntentId: string, phraseText: string) => void;
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
  onAddAsNotMatching
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
      {/* Icon based on phrase type */}
      <MessageSquare
        size={14}
        className={phraseType === 'matching' ? 'text-emerald-600 shrink-0' : 'text-rose-600 shrink-0'}
      />

      {/* Text with test result badge if available */}
      <span className="truncate flex-1 min-w-0">
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
