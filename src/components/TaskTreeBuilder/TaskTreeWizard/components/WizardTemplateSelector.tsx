// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import CompactDropdown from '../CompactDropdown';
import { useFontContext } from '../../../../context/FontContext';

interface WizardTemplateSelectorProps {
  templates: any[];
  selectedTemplateId: string;
  loading: boolean;
  onSelect: (template: any) => void;
  onConfirm?: () => void;
}

const WizardTemplateSelector: React.FC<WizardTemplateSelectorProps> = ({
  templates,
  selectedTemplateId,
  loading,
  onSelect,
  onConfirm,
}) => {
  const { combinedClass } = useFontContext();

  const selectedTemplate = selectedTemplateId
    ? templates.find(t => (t._id || t.id || t.name) === selectedTemplateId)
    : null;
  const templateName = selectedTemplate ? (selectedTemplate.label || selectedTemplate.name || 'template') : '';

  return (
    <>
      {/* Dropdown */}
      <div style={{ marginBottom: 16, width: '100%' }}>
        <CompactDropdown
          placeholder="Clicca per vedere i moduli disponibili"
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          loading={loading}
          onSelect={onSelect}
          disabled={templates.length === 0}
        />
      </div>

      {/* ChooseTemplateButton */}
      {selectedTemplateId && onConfirm && (
        <button
          onClick={onConfirm}
          className={combinedClass}
          style={{
            width: '100%',
            background: '#3b82f6',
            color: '#fff',
            border: '1px solid #3b82f6',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '10px 20px',
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          Usa <span style={{ fontWeight: 700 }}>{templateName}</span>
        </button>
      )}
    </>
  );
};

export default WizardTemplateSelector;
