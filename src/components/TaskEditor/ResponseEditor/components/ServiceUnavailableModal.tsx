// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';

export interface ServiceUnavailableModalProps {
  serviceUnavailable: {
    service: string;
    message: string;
    endpoint?: string;
    onRetry?: () => void;
  };
  onClose: () => void;
}

/**
 * Modal component for displaying service unavailable errors.
 */
export function ServiceUnavailableModal({ serviceUnavailable, onClose }: ServiceUnavailableModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        pointerEvents: 'auto' // Modal: blocca interazione con il resto
      }}
      onClick={(e) => {
        // Chiudi cliccando sullo sfondo (opzionale, ma meglio solo con OK)
        // e.stopPropagation();
      }}
    >
      <div
        style={{
          background: '#2d2d2d',
          borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          padding: 24,
          maxWidth: 500,
          width: '90%',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          pointerEvents: 'auto'
        }}
        onClick={(e) => e.stopPropagation()} // Previeni chiusura cliccando sul contenuto
      >
        {/* Header con icona e titolo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{
            color: '#fbbf24',
            fontSize: 32,
            flexShrink: 0
          }}>
            ⚠️
          </div>
          <h3 style={{
            fontSize: 20,
            fontWeight: 700,
            margin: 0,
            color: '#e2e8f0'
          }}>
            {serviceUnavailable.service || 'Servizio'} non disponibile
          </h3>
        </div>

        {/* Messaggio */}
        <p style={{
          fontSize: 16,
          lineHeight: 1.5,
          margin: 0,
          color: '#e2e8f0'
        }}>
          {serviceUnavailable.message}
        </p>

        {/* Endpoint info (se presente) */}
        {serviceUnavailable.endpoint && (
          <p style={{
            fontSize: 12,
            color: '#94a3b8',
            margin: 0
          }}>
            Endpoint: {serviceUnavailable.endpoint}
          </p>
        )}

        {/* Azioni */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          marginTop: 8
        }}>
          {serviceUnavailable.onRetry && (
            <button
              onClick={() => {
                const retry = serviceUnavailable.onRetry;
                onClose();
                try { retry?.(); } catch { }
              }}
              style={{
                background: '#0ea5e9',
                color: '#0b1220',
                border: 'none',
                borderRadius: 8,
                padding: '10px 24px',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 14,
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#0284c7'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#0ea5e9'}
            >
              Retry
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: '#22c55e',
              color: '#0b1220',
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 14,
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#16a34a'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#22c55e'}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
