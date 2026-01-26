import React from 'react';
import { AlertCircle, RefreshCw, Copy } from 'lucide-react';

interface ContractUpdateDialogProps {
  open: boolean;
  templateLabel: string;
  onKeep: () => void;      // ✅ Mantieni modifiche in memoria
  onDiscard: () => void;   // ✅ Scarta modifiche (ripristina originale)
  onCancel: () => void;    // ✅ Annulla (non chiudere editor)
}

export function ContractUpdateDialog({
  open,
  templateLabel,
  onKeep,
  onDiscard,
  onCancel
}: ContractUpdateDialogProps) {
  if (!open) return null;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: 8,
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
        width: '90%',
        maxWidth: '600px',
        padding: '24px'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <AlertCircle style={{ width: '24px', height: '24px', color: '#f59e0b' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
              Contract modificato
            </h3>
          </div>
          <p style={{ fontSize: '14px', color: '#374151', margin: 0 }}>
            Hai modificato i contracts per questo dato. Vuoi mantenere le modifiche o scartarle?
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <button
            onClick={onKeep}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              textAlign: 'left',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
          >
            <RefreshCw style={{ width: '20px', height: '20px', color: '#2563eb', flexShrink: 0 }} />
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#1e40af' }}>
              Mantieni modifiche
            </span>
          </button>

          <button
            onClick={onDiscard}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              textAlign: 'left',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
          >
            <Copy style={{ width: '20px', height: '20px', color: '#dc2626', flexShrink: 0 }} />
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#991b1b' }}>
              Scarta modifiche
            </span>
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              color: '#374151',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
