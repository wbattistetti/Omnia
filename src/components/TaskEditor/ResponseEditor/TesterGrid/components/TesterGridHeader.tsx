import React from 'react';
import TesterGridInput from './TesterGridInput';
import TesterGridActionsColumn from './TesterGridActionsColumn';
import TesterGridHeaderColumn from './TesterGridHeaderColumn';

// 🎨 Colori centralizzati per extractors
const EXTRACTOR_COLORS = {
  regex: '#93c5fd',
  deterministic: '#e5e7eb',
  ner: '#fef3c7',
  llm: '#fed7aa',
  embeddings: '#e0e7ff',
};

// 📊 Etichette colonne con tooltip
const COLUMN_LABELS = {
  regex: {
    main: "Espressione",
    tech: "Regex",
    tooltip: "Cerca pattern di testo con espressioni regolari"
  },
  deterministic: {
    main: "Logica",
    tech: "Extractor",
    tooltip: "Parsing semantico con regole programmate specifiche per tipo"
  },
  ner: {
    main: "AI Rapida",
    tech: "NER",
    tooltip: "Riconoscimento entità con intelligenza artificiale veloce"
  },
  llm: {
    main: "AI Completa",
    tech: "LLM",
    tooltip: "Comprensione linguistica profonda con modello AI avanzato"
  },
  embeddings: {
    main: "Classificazione",
    tech: "Embeddings",
    tooltip: "Classificazione intenti basata su embeddings semantici"
  }
};

interface TesterGridHeaderProps {
  newExample: string;
  setNewExample: (value: string) => void;
  onAddExample: () => void;
  phraseColumnWidth: number;
  isResizing: boolean;
  onResizeStart: (e: React.MouseEvent) => void;
  enabledMethods: {
    regex: boolean;
    deterministic: boolean;
    ner: boolean;
    llm: boolean;
  };
  toggleMethod: (method: keyof TesterGridHeaderProps['enabledMethods']) => void;
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings' | null;
  toggleEditor: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  showDeterministic: boolean;
  showNER: boolean;
  showEmbeddings: boolean;
  headerRowRef: React.RefObject<HTMLTableRowElement>;
}

/**
 * Header component for the tester grid
 */
export default function TesterGridHeader({
  newExample,
  setNewExample,
  onAddExample,
  phraseColumnWidth,
  isResizing,
  onResizeStart,
  enabledMethods,
  toggleMethod,
  activeEditor,
  toggleEditor,
  showDeterministic,
  showNER,
  showEmbeddings,
  headerRowRef,
}: TesterGridHeaderProps) {
  return (
    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
      <tr ref={headerRowRef}>
        <th style={{
          textAlign: 'left',
          padding: 8,
          background: '#f9fafb',
          width: `${phraseColumnWidth}px`,
          position: 'relative',
          zIndex: 1002, // ✅ CRITICAL: zIndex più alto per garantire che l'input sia sempre cliccabile
        }}>
          <TesterGridInput
            value={newExample}
            onChange={setNewExample}
            onAdd={onAddExample}
          />
          {/* Splitter - linea verticale draggable */}
          <div
            onMouseDown={onResizeStart}
            style={{
              position: 'absolute',
              right: '-3px',
              top: 0,
              bottom: 0,
              width: '6px',
              cursor: 'col-resize',
              backgroundColor: isResizing ? '#3b82f6' : 'rgba(107, 114, 128, 0.4)',
              zIndex: 20,
              transition: isResizing ? 'none' : 'background-color 0.2s',
              borderLeft: '1px solid rgba(107, 114, 128, 0.6)',
              borderRight: '1px solid rgba(107, 114, 128, 0.6)'
            }}
            onMouseEnter={(e) => {
              if (!isResizing) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.6)';
                (e.currentTarget as HTMLElement).style.borderLeftColor = '#3b82f6';
                (e.currentTarget as HTMLElement).style.borderRightColor = '#3b82f6';
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizing) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(107, 114, 128, 0.4)';
                (e.currentTarget as HTMLElement).style.borderLeftColor = 'rgba(107, 114, 128, 0.6)';
                (e.currentTarget as HTMLElement).style.borderRightColor = 'rgba(107, 114, 128, 0.6)';
              }
            }}
          />
        </th>
        <TesterGridActionsColumn rowIndex={-1} newExample={newExample} onAddExample={onAddExample} />
        <TesterGridHeaderColumn
          type="regex"
          mainLabel={COLUMN_LABELS.regex.main}
          techLabel={COLUMN_LABELS.regex.tech}
          tooltip={COLUMN_LABELS.regex.tooltip}
          backgroundColor={EXTRACTOR_COLORS.regex}
          enabled={enabledMethods.regex}
          activeEditor={activeEditor}
          onToggleMethod={() => toggleMethod('regex')}
          onToggleEditor={toggleEditor}
        />
        {showDeterministic && (
          <TesterGridHeaderColumn
            type="deterministic"
            mainLabel={COLUMN_LABELS.deterministic.main}
            techLabel={COLUMN_LABELS.deterministic.tech}
            tooltip={COLUMN_LABELS.deterministic.tooltip}
            backgroundColor={EXTRACTOR_COLORS.deterministic}
            enabled={enabledMethods.deterministic}
            activeEditor={activeEditor}
            onToggleMethod={() => toggleMethod('deterministic')}
            onToggleEditor={toggleEditor}
            showPostProcess={true}
          />
        )}
        {showNER && (
          <TesterGridHeaderColumn
            type="ner"
            mainLabel={COLUMN_LABELS.ner.main}
            techLabel={COLUMN_LABELS.ner.tech}
            tooltip={COLUMN_LABELS.ner.tooltip}
            backgroundColor={EXTRACTOR_COLORS.ner}
            enabled={enabledMethods.ner}
            activeEditor={activeEditor}
            onToggleMethod={() => toggleMethod('ner')}
            onToggleEditor={toggleEditor}
          />
        )}
        {showEmbeddings && (
          <TesterGridHeaderColumn
            type="embeddings"
            mainLabel={COLUMN_LABELS.embeddings.main}
            techLabel={COLUMN_LABELS.embeddings.tech}
            tooltip={COLUMN_LABELS.embeddings.tooltip}
            backgroundColor={EXTRACTOR_COLORS.embeddings}
            enabled={enabledMethods.regex}
            activeEditor={activeEditor}
            onToggleMethod={() => toggleMethod('regex')}
            onToggleEditor={toggleEditor}
          />
        )}
        <TesterGridHeaderColumn
          type="llm"
          mainLabel={COLUMN_LABELS.llm.main}
          techLabel={COLUMN_LABELS.llm.tech}
          tooltip={COLUMN_LABELS.llm.tooltip}
          backgroundColor={EXTRACTOR_COLORS.llm}
          enabled={enabledMethods.llm}
          activeEditor={activeEditor}
          onToggleMethod={() => toggleMethod('llm')}
          onToggleEditor={toggleEditor}
        />
      </tr>
    </thead>
  );
}
