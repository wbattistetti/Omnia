// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState } from 'react';
import { AlertTriangle, X, Info } from 'lucide-react';
import { useFontContext } from '../../../../context/FontContext';

interface GeneralizabilityBannerProps {
  isGeneralizable: boolean;
  generalizationReason: string;
  onSaveToFactory?: () => void;
  onIgnore?: () => void;
}

export function GeneralizabilityBanner({
  isGeneralizable,
  generalizationReason,
  onSaveToFactory,
  onIgnore,
}: GeneralizabilityBannerProps) {
  const { combinedClass } = useFontContext();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isGeneralizable || isDismissed) {
    return null;
  }

  return (
    <div
      style={{
        background: 'rgba(251, 191, 36, 0.1)',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        borderRadius: 8,
        padding: '12px 16px',
        margin: '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}
    >
      <AlertTriangle size={20} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: isExpanded ? '8px' : 0 }}>
          <span
            style={{
              color: '#fbbf24',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            This task seems generalizable.
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fbbf24',
              cursor: 'pointer',
              fontSize: 12,
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            {isExpanded ? 'Hide details' : 'Click here to learn more'}
          </button>
        </div>

        {isExpanded && (
          <div style={{ marginTop: '8px' }}>
            <p
              style={{
                color: '#cbd5e1',
                fontSize: 13,
                lineHeight: 1.5,
                marginBottom: '12px',
              }}
            >
              {generalizationReason}
            </p>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {onSaveToFactory && (
                <button
                  onClick={onSaveToFactory}
                  className={combinedClass}
                  style={{
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save as Factory Template
                </button>
              )}
              {onIgnore && (
                <button
                  onClick={() => {
                    setIsDismissed(true);
                    onIgnore();
                  }}
                  className={combinedClass}
                  style={{
                    background: 'transparent',
                    color: '#94a3b8',
                    border: '1px solid #475569',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Ignore
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => setIsDismissed(true)}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        title="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
