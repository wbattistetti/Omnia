/**
 * Center-screen choice when a new DDT task has no structure yet: manual build, AI wizard, or adapt from embedding suggestion.
 */

import React from 'react';
import { PenLine, Sparkles, Wand2 } from 'lucide-react';

export type TaskCreationChoicePanelProps = {
  onChooseManual: () => void;
  onChooseWizard: () => void;
  /** When set, show third action to start adaptation wizard for this template name. */
  embeddingMatchTemplateName?: string | null;
  onChooseAdaptTemplate?: () => void;
};

export function TaskCreationChoicePanel({
  onChooseManual,
  onChooseWizard,
  embeddingMatchTemplateName,
  onChooseAdaptTemplate,
}: TaskCreationChoicePanelProps) {
  const showAdapt =
    Boolean(embeddingMatchTemplateName?.trim()) && typeof onChooseAdaptTemplate === 'function';

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
            Crea manualmente
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
          {showAdapt ? (
            <button
              type="button"
              onClick={onChooseAdaptTemplate}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '14px 18px',
                borderRadius: 10,
                border: '1px solid rgba(167, 243, 208, 0.35)',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#d1fae5',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Sparkles size={18} color="#6ee7b7" />
              Adatta template trovato ({embeddingMatchTemplateName!.trim()})
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
