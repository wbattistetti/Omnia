// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState } from 'react';
import { X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { MissingTranslation } from '@services/TranslationIntegrityService';

interface MissingTranslationsDialogProps {
  open: boolean;
  onClose: () => void;
  missing: MissingTranslation[];
  onGenerate: () => Promise<void>;
  isGenerating?: boolean;
}

export function MissingTranslationsDialog({
  open,
  onClose,
  missing,
  onGenerate,
  isGenerating = false,
}: MissingTranslationsDialogProps) {
  const [generated, setGenerated] = useState(false);

  if (!open) return null;

  const handleGenerate = async () => {
    try {
      await onGenerate();
      setGenerated(true);
    } catch (error) {
      console.error('[MissingTranslationsDialog] Error generating translations:', error);
    }
  };

  const handleClose = () => {
    setGenerated(false);
    onClose();
  };

  const languageNames = {
    it: 'Italian',
    en: 'English',
    pt: 'Portuguese',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
            Missing Translations
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {generated ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle2 size={48} style={{ color: '#10b981', marginBottom: '16px' }} />
            <p style={{ margin: 0, fontSize: '16px', color: '#10b981' }}>
              Translations generated successfully!
            </p>
            <button
              onClick={handleClose}
              style={{
                marginTop: '20px',
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: 0, marginBottom: '8px', fontSize: '14px', color: '#6b7280' }}>
                The following {missing.length} template{missing.length !== 1 ? 's' : ''} are missing translations for{' '}
                <strong>{languageNames[missing[0]?.targetLanguage || 'en']}</strong>:
              </p>
            </div>

            {/* Missing translations list */}
            <div
              style={{
                maxHeight: '300px',
                overflowY: 'auto',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                padding: '12px',
                marginBottom: '16px',
                backgroundColor: '#f9fafb',
              }}
            >
              {missing.slice(0, 20).map((item, index) => (
                <div
                  key={item.guid}
                  style={{
                    padding: '8px',
                    marginBottom: index < missing.length - 1 ? '4px' : 0,
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>{item.label}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {languageNames[item.sourceLanguage]} → {languageNames[item.targetLanguage]}
                  </div>
                </div>
              ))}
              {missing.length > 20 && (
                <div style={{ padding: '8px', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
                  ... and {missing.length - 20} more
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleClose}
                disabled={isGenerating}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                style={{
                  padding: '8px 16px',
                  backgroundColor: isGenerating ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    Generating...
                  </>
                ) : (
                  'Generate Automatically'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
