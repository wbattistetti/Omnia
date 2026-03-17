// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { Play } from 'lucide-react';
import { TestPhrase } from './TestPhrases';

interface TestPhraseListProps {
  phrases: TestPhrase[];
  selectedPhraseId: string | null;
  onSelectPhrase: (id: string) => void;
  onTestPhrase: (id: string) => void;
}

export function TestPhraseList({
  phrases,
  selectedPhraseId,
  onSelectPhrase,
  onTestPhrase,
}: TestPhraseListProps) {
  return (
    <div style={{ padding: '4px 0' }}>
      {phrases.length === 0 ? (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '14px',
        }}>
          No test phrases. Add one above.
        </div>
      ) : (
        phrases.map(phrase => {
          const isSelected = phrase.id === selectedPhraseId;
          const statusColor = phrase.status === 'matched'
            ? '#10b981' // green
            : phrase.status === 'no-match'
            ? '#ef4444' // red
            : '#6b7280'; // gray

          const textColor = phrase.status === 'matched'
            ? '#059669'
            : phrase.status === 'no-match'
            ? '#dc2626'
            : '#374151';

          return (
            <div
              key={phrase.id}
              onClick={() => onSelectPhrase(phrase.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                borderBottom: '1px solid #f3f4f6',
                gap: '12px',
                backgroundColor: isSelected
                  ? '#eff6ff'
                  : phrase.status === 'matched'
                  ? '#f0fdf4'
                  : phrase.status === 'no-match'
                  ? '#fef2f2'
                  : '#fff',
                cursor: 'pointer',
                borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
              }}
            >
              {/* Status indicator */}
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: statusColor,
                  flexShrink: 0,
                }}
              />

              {/* Phrase text */}
              <div
                style={{
                  flex: 1,
                  color: textColor,
                  fontSize: '14px',
                  fontWeight: phrase.status ? 500 : 400,
                }}
              >
                {phrase.text}
              </div>

              {/* Test button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTestPhrase(phrase.id);
                }}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Test this phrase"
              >
                <Play size={12} />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
