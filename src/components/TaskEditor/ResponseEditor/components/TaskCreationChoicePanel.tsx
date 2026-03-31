/**
 * Center-screen choice when a new DDT task has no structure yet: manual build vs AI wizard.
 */

import React from 'react';
import { PenLine, Wand2 } from 'lucide-react';

export type TaskCreationChoicePanelProps = {
  onChooseManual: () => void;
  onChooseWizard: () => void;
};

export function TaskCreationChoicePanel({ onChooseManual, onChooseWizard }: TaskCreationChoicePanelProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
        width: '100%',
        padding: 32,
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-label="Scegli come costruire il task"
        style={{
          maxWidth: 440,
          width: '100%',
          borderRadius: 16,
          border: '1px solid rgba(251, 146, 60, 0.45)',
          background: 'linear-gradient(165deg, rgba(30, 27, 22, 0.98) 0%, rgba(18, 16, 14, 0.99) 100%)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
          padding: '28px 24px',
        }}
      >
        <p
          style={{
            margin: '0 0 20px 0',
            fontSize: 15,
            fontWeight: 600,
            color: '#fbbf24',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          Come vuoi costruire questo task?
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            type="button"
            onClick={onChooseManual}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '14px 18px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(251, 146, 60, 0.12)',
              color: '#fef3c7',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <PenLine size={18} color="#fbbf24" />
            Crea il task manualmente
          </button>
          <button
            type="button"
            onClick={onChooseWizard}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '14px 18px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#e0e7ff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Wand2 size={18} color="#93c5fd" />
            Usa wizard
          </button>
        </div>
      </div>
    </div>
  );
}
