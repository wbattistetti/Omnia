// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { Loader2 } from 'lucide-react';
import DataCollection, { SchemaNode } from './MainDataCollection';
import { useFontContext } from '../../../context/FontContext';

export type AccordionState = 'collapsed' | 'loading' | 'structure-ready' | 'editing';

interface WizardAIAccordionProps {
  state: AccordionState;
  structure?: SchemaNode[];
  schemaRootLabel?: string;
  onConfirm: () => void;
  onRefine: () => void;
  onEditManually: () => void;
  onStructureChange?: (mains: SchemaNode[]) => void;
  showRefiningTextbox?: boolean;
  refiningText?: string;
  onRefiningTextChange?: (text: string) => void;
  onApplyRefining?: () => void;
  onCreateWithAI?: () => void;
  isAIGenerating?: boolean;
}

const WizardAIAccordion: React.FC<WizardAIAccordionProps> = ({
  state,
  structure = [],
  schemaRootLabel = 'Data',
  onConfirm,
  onRefine,
  onEditManually,
  onStructureChange,
  showRefiningTextbox = false,
  refiningText = '',
  onRefiningTextChange,
  onApplyRefining,
  onCreateWithAI,
  isAIGenerating = false,
}) => {
  const { combinedClass } = useFontContext();
  const [headerClicked, setHeaderClicked] = React.useState(false);

  const isExpanded = state !== 'collapsed';

  const handleHeaderClick = () => {
    if (state === 'collapsed' && onCreateWithAI && !isAIGenerating) {
      setHeaderClicked(true);
      onCreateWithAI();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* AccordionHeader: Pulsante verde */}
      <div style={{ width: '100%' }}>
        {onCreateWithAI && (
          <button
            onClick={handleHeaderClick}
            disabled={isAIGenerating || state !== 'collapsed'}
            className={combinedClass}
            style={{
              width: '100%',
              background: 'transparent',
              color: '#22c55e',
              border: '1px solid #22c55e',
              borderRadius: 8,
              fontWeight: 500,
              cursor: (isAIGenerating || state !== 'collapsed') ? 'not-allowed' : 'pointer',
              padding: '10px 20px',
              marginBottom: isExpanded ? '16px' : 0,
              opacity: (isAIGenerating || state !== 'collapsed') ? 0.6 : 1,
              fontSize: 14,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {(headerClicked || state !== 'collapsed') && (
              <span style={{ color: '#22c55e' }}>✓</span>
            )}
            Oppure clicca qui e ne creo uno nuovo per te
          </button>
        )}
      </div>

      {/* AccordionContent: Loading / Structure / Editing */}
      <div
        style={{
          display: isExpanded ? 'block' : 'none',
          width: '100%',
          padding: isExpanded ? '16px 0' : 0,
        }}
      >
        {/* LoadingState */}
        {state === 'loading' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#cbd5e1',
              fontSize: 14,
            }}
          >
            <Loader2 size={16} className="animate-spin" style={{ color: '#3b82f6' }} />
            <span>Un momento, sto cercando di capire che tipo di dato ti serve...</span>
          </div>
        )}

        {/* StructureState */}
        {state === 'structure-ready' && (
          <>
            <p
              style={{
                color: '#e2e8f0',
                fontSize: 15,
                lineHeight: 1.6,
                marginBottom: 16,
                fontWeight: 400,
              }}
            >
              Questa struttura dovrebbe essere adatta.
            </p>

            {structure.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <DataCollection
                  rootLabel={schemaRootLabel}
                  mains={structure}
                  onChangeMains={onStructureChange || (() => {})}
                  onAddMain={() => {}}
                  progressByPath={{}}
                  fieldProcessingStates={{}}
                  selectedIdx={null}
                  onSelect={() => {}}
                  autoEditIndex={null}
                  onChangeEvent={() => {}}
                  onAutoMap={() => {}}
                  onRetryField={() => {}}
                  onCreateManually={() => {}}
                />
              </div>
            )}

            {showRefiningTextbox && (
              <div style={{ marginBottom: 16 }}>
                <p
                  style={{
                    color: '#cbd5e1',
                    fontSize: 14,
                    lineHeight: 1.5,
                    marginBottom: 8,
                    fontWeight: 400,
                  }}
                >
                  Vuoi aiutarmi a migliorare questa struttura?<br />
                  Scrivi qui cosa non ti convince o cosa vorresti cambiare.
                </p>
                <textarea
                  value={refiningText}
                  onChange={(e) => onRefiningTextChange?.(e.target.value)}
                  placeholder="Es. rendi 'Anno' opzionale… Oppure aggiungi 'Formato' come figlio…"
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '12px',
                    borderRadius: 8,
                    border: '1px solid #475569',
                    background: '#0f172a',
                    color: '#e2e8f0',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={onConfirm}
                className={combinedClass}
                style={{
                  background: '#22c55e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Sì, va bene
              </button>

              <button
                onClick={showRefiningTextbox ? onApplyRefining : onRefine}
                disabled={showRefiningTextbox && !refiningText.trim()}
                className={combinedClass}
                style={{
                  background: showRefiningTextbox ? '#3b82f6' : 'transparent',
                  color: showRefiningTextbox ? '#fff' : '#e2e8f0',
                  border: `1px solid ${showRefiningTextbox ? '#3b82f6' : '#475569'}`,
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontWeight: 600,
                  cursor: (showRefiningTextbox && !refiningText.trim()) ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  opacity: (showRefiningTextbox && !refiningText.trim()) ? 0.6 : 1,
                }}
              >
                {showRefiningTextbox ? 'Applica correzione' : 'No, correggila'}
              </button>

              <button
                onClick={onEditManually}
                className={combinedClass}
                style={{
                  background: 'transparent',
                  color: '#e2e8f0',
                  border: '1px solid #475569',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Modifico manualmente
              </button>
            </div>
          </>
        )}

        {/* EditingState */}
        {state === 'editing' && (
          <DataCollection
            rootLabel={schemaRootLabel}
            mains={structure}
            onChangeMains={onStructureChange || (() => {})}
            onAddMain={() => {}}
            progressByPath={{}}
            fieldProcessingStates={{}}
            selectedIdx={null}
            onSelect={() => {}}
            autoEditIndex={null}
            onChangeEvent={() => {}}
            onAutoMap={() => {}}
            onRetryField={() => {}}
            onCreateManually={() => {}}
          />
        )}
      </div>
    </div>
  );
};

export default WizardAIAccordion;
