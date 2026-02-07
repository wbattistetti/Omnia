import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';

type ContractMethod = 'regex' | 'rules' | 'ner' | 'llm' | 'embeddings';

interface AddContractDropdownProps {
  onSelect: (method: ContractMethod) => void;
  availableMethods?: ContractMethod[];
  label?: string;
}

const METHOD_LABELS: Record<ContractMethod, string> = {
  regex: 'Espressione (Regex)',
  rules: 'Logica (Extractor)',
  ner: 'AI Rapida (NER)',
  llm: 'AI Completa (LLM)',
  embeddings: 'Classificazione (Embeddings)',
};

/**
 * Dropdown component for adding a new contract method
 */
export default function AddContractDropdown({
  onSelect,
  availableMethods = ['regex', 'rules', 'ner', 'llm', 'embeddings'],
  label = 'Aggiungi contract',
}: AddContractDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (method: ContractMethod) => {
    onSelect(method);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#2563eb';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#3b82f6';
        }}
        title={label}
      >
        <Plus size={14} />
        <span>{label}</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            minWidth: 200,
            maxHeight: 300,
            overflowY: 'auto',
          }}
        >
          {availableMethods.map((method) => (
            <button
              key={method}
              onClick={() => handleSelect(method)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: '#0b0f17',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {METHOD_LABELS[method]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
