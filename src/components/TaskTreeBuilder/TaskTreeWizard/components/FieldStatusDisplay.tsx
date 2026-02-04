import React from 'react';
import { RefreshCw, FileEdit } from 'lucide-react';
import AnimatedDots from './AnimatedDots';
import type { FieldProcessingState } from '../hooks/useFieldProcessing';

interface FieldStatusDisplayProps {
  fieldId: string;
  state: FieldProcessingState | null;
  progress: number;
  message: string;
  hasError: boolean;
  onRetryField?: (fieldId: string) => void;
  onCreateManually?: () => void;
  getStatusIcon: (fieldId: string) => React.ReactNode;
  // Configuration props
  compact?: boolean; // If true, uses smaller fontSize (11px) for sub-data
  className?: string; // Font context class
  showPayoff?: boolean; // If true, shows message in payoff row below (default: true for errors)
}

/**
 * Reusable component for displaying field processing status with error handling.
 *
 * Layout:
 * - Row 1: Icon + Percentage + Buttons (Retry/Create manually)
 * - Row 2 (Payoff): Error message (only shown when hasError and showPayoff is true)
 *
 * All elements stay inside the container border.
 */
export default function FieldStatusDisplay({
  fieldId,
  state,
  progress,
  message,
  hasError,
  onRetryField,
  onCreateManually,
  getStatusIcon,
  compact = false,
  className,
  showPayoff = true,
}: FieldStatusDisplayProps) {
  // Don't render if no progress and no state
  if (progress === 0 && !state) {
    return null;
  }

  const fontSize = compact ? '11px' : undefined;
  const buttonFontSize = compact ? '11px' : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
      {/* Row 1: Icon + Percentage + Buttons */}
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize,
          flexWrap: 'wrap', // Allow wrapping if needed to stay inside border
          minWidth: 0,
          flex: 1
        }}
      >
        {getStatusIcon(fieldId)}
        <span style={{ color: hasError ? '#ef4444' : (progress >= 100 ? '#22c55e' : '#3b82f6'), flexShrink: 0 }}>
          {Math.round(progress)}%
        </span>
        {!hasError && (
          <span style={{ color: '#64748b', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {message}
          </span>
        )}
        {progress > 0 && progress < 100 && !hasError && <AnimatedDots />}
        {hasError && onRetryField && (
          <>
            <button
              onClick={() => onRetryField(fieldId)}
              className={className}
              style={{
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: buttonFontSize,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                flexShrink: 0, // Prevent button from shrinking
                whiteSpace: 'nowrap'
              }}
              title={state?.retryCount ? `Retry (attempt ${state.retryCount + 1})` : 'Retry'}
            >
              <RefreshCw size={12} />
              Retry {state?.retryCount ? `(${state.retryCount})` : ''}
            </button>
            {/* Show manual creation button after 2+ failed retries */}
            {(state?.retryCount ?? 0) >= 2 && onCreateManually && (
              <button
                onClick={() => onCreateManually()}
                className={className}
                style={{
                  background: '#fbbf24',
                  color: '#0b1220',
                  border: 'none',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: buttonFontSize,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontWeight: 600,
                  flexShrink: 0, // Prevent button from shrinking
                  whiteSpace: 'nowrap'
                }}
                title="Crea i messaggi manualmente nell'editor"
              >
                <FileEdit size={12} />
                Crea manualmente
              </button>
            )}
          </>
        )}
      </div>

      {/* Row 2 (Payoff): Error message - shown below, always inside border */}
      {hasError && showPayoff && message && (
        <div
          className={className}
          style={{
            color: '#ef4444',
            fontSize: compact ? '10px' : '12px',
            paddingLeft: 20, // Indent to align with content
            paddingTop: 2,
            paddingBottom: 2,
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            maxWidth: '100%', // Ensure it stays inside border
            minWidth: 0,
            boxSizing: 'border-box'
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}

