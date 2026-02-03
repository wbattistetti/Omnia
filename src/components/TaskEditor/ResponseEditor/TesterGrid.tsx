import React from 'react';
// Modular components
import TesterGridHeader from './TesterGrid/components/TesterGridHeader';
import TesterGridRow from './TesterGrid/components/TesterGridRow';
import { MemoizedEditorOverlay } from './TesterGrid/components/EditorOverlay';
import { useColumnResize } from './TesterGrid/hooks/useColumnResize';
import { useEditorOverlay } from './TesterGrid/hooks/useEditorOverlay';
import { RowResult } from './hooks/useExtractionTesting';
import type { DataContract } from '../../DialogueDataEngine/contracts/contractLoader';

// 🎨 Colori centralizzati per extractors (usati solo per editor overlay)
const EXTRACTOR_COLORS = {
  regex: '#93c5fd',
  deterministic: '#e5e7eb',
  ner: '#fef3c7',
  llm: '#fed7aa',
  embeddings: '#e0e7ff',
};

// Store "Running tests..." component outside to avoid re-renders
const RunningTestsScreen = React.memo(() => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 0,
    background: '#f9fafb',
    color: '#6b7280',
    fontSize: 14,
    fontWeight: 500,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{
        display: 'inline-block',
        width: 16,
        height: 16,
        border: '2px solid #94a3b8',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span>Running tests...</span>
    </div>
  </div>
));

RunningTestsScreen.displayName = 'RunningTestsScreen';

interface TesterGridProps {
  contract?: DataContract | null;
  onContractChange?: (contract: DataContract | null) => void;
  examplesList: string[];
  rowResults: RowResult[];
  selectedRow: number | null;
  setSelectedRow: (idx: number) => void;
  enabledMethods: {
    regex: boolean;
    deterministic: boolean;
    ner: boolean;
    llm: boolean;
  };
  toggleMethod: (method: keyof TesterGridProps['enabledMethods']) => void;
  runRowTest: (idx: number) => Promise<void>;
  kind: string;
  expectedKeysForKind: (k?: string) => string[];
  // Cell editing
  // ✅ FASE 2 - REMOVED: cellOverrides, setCellOverrides - now managed via Zustand store
  editingCell: { row: number; col: 'det' | 'ner' | 'llm'; key: string } | null;
  setEditingCell: React.Dispatch<React.SetStateAction<{ row: number; col: 'det' | 'ner' | 'llm'; key: string } | null>>;
  editingText: string;
  setEditingText: React.Dispatch<React.SetStateAction<string>>;
  // ✅ REMOVED: Notes props - now managed via Zustand store (stores/notesStore.ts)
  // All note-related functionality is accessed via useNotesStore() hook
  // Editor toggle
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings' | null;
  toggleEditor: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings') => void;
  openEditor?: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings') => void;
  // Mode: extraction (default) or classification
  mode?: 'extraction' | 'classification';
  // Input for adding new phrases
  newExample: string;
  setNewExample: React.Dispatch<React.SetStateAction<string>>;
  setExamplesList: React.Dispatch<React.SetStateAction<string[]>>;
  // Editor props (for overlay)
  onCloseEditor?: () => void;
  editorProps?: {
    regex?: string;
    setRegex?: (value: string) => void;
    node?: any;
    kind?: string;
    profile?: any;
    testCases?: string[];
    setTestCases?: (cases: string[]) => void;
    onProfileUpdate?: (profile: any) => void;
    task?: any;
  };
  // Buttons props
  runAllRows?: () => Promise<void>;
  testing?: boolean;
  reportOpen?: boolean;
  setReportOpen?: (open: boolean) => void;
  baselineStats?: { matched: number; falseAccept: number; totalGt: number } | null;
  lastStats?: { matched: number; falseAccept: number; totalGt: number } | null;
}


function TesterGridComponent({
  contract,
  onContractChange,
  examplesList,
  rowResults,
  selectedRow,
  setSelectedRow,
  enabledMethods,
  toggleMethod,
  runRowTest,
  kind,
  expectedKeysForKind,
  // ✅ FASE 2 - REMOVED: cellOverrides, setCellOverrides - now managed via Zustand store
  editingCell,
  setEditingCell,
  editingText,
  setEditingText,
  // ✅ REMOVED: Notes props - now managed via Zustand store
  activeEditor,
  toggleEditor,
  openEditor,
  mode = 'extraction', // Default to extraction for backward compatibility
  newExample,
  setNewExample,
  setExamplesList,
  onCloseEditor,
  editorProps,
  runAllRows,
  testing = false,
  reportOpen = false,
  setReportOpen,
  baselineStats,
  lastStats,
}: TesterGridProps) {
  // ✅ REMOVED: Notes are now managed via Zustand store

  // Determine which columns to show based on mode
  const showDeterministic = mode !== 'classification';
  const showNER = mode !== 'classification';
  const showEmbeddings = mode === 'classification';

  // Calculate colSpan for empty state based on dynamic contract columns

  // Handler for adding new example
  // Use ref to avoid dependencies that cause re-renders
  const newExampleRef = React.useRef<string>(newExample);
  React.useEffect(() => {
    newExampleRef.current = newExample;
  }, [newExample]);

  const handleAddExample = React.useCallback(() => {
    const t = (newExampleRef.current || '').trim();
    if (!t) return;

    // ✅ CRITICAL: Verifica che la frase non esista già (case-sensitive)
    // Questo garantisce che ogni frase sia univoca, così la chiave `${phrase}|${method}` è sempre non ambigua
    setExamplesList((prevList) => {
      const existIdx = prevList.findIndex((p) => p === t);
      if (existIdx !== -1) {
        // Frase già esistente: seleziona ma NON aggiungere
        // Mostra un warning in console (in futuro potresti mostrare un toast)
        console.warn('[TesterGrid] Frase già esistente, non aggiunta', {
          phrase: t,
          existingIndex: existIdx,
          existingPhrase: prevList[existIdx]
        });
        setSelectedRow(existIdx);
        setNewExample('');
        return prevList; // Non modificare la lista
      } else {
        // Nuova frase: aggiungi alla lista
        const next = Array.from(new Set([...prevList, t]));
        setNewExample('');
        // Select the last added row
        setSelectedRow(next.length - 1);
        console.log('[TesterGrid] Frase aggiunta', {
          phrase: t,
          newIndex: next.length - 1,
          totalPhrases: next.length
        });
        return next;
      }
    });
  }, [setExamplesList, setSelectedRow, setNewExample]);

  // Use modular hooks
  const { phraseColumnWidth, isResizing, handleResizeStart } = useColumnResize(280);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const { editorOverlayStyle, tableRef, headerRowRef } = useEditorOverlay({
    activeEditor,
    contractTableRef: scrollContainerRef,
  });

  // State for editor button and error message to display in header
  const [editorButton, setEditorButton] = React.useState<React.ReactNode>(null);
  const [editorErrorMessage, setEditorErrorMessage] = React.useState<React.ReactNode>(null);

  // Reset button and error message when editor changes or closes
  React.useEffect(() => {
    if (!activeEditor) {
      setEditorButton(null);
      setEditorErrorMessage(null);
    }
  }, [activeEditor]);

  // Memoize functions to prevent excessive re-renders of EditorOverlay
  const getActiveEditorTitle = React.useCallback(() => {
    if (!activeEditor) return '';
    switch (activeEditor) {
      case 'regex':
        return 'Espressione (Regex)';
      case 'extractor':
        return 'Logica (Extractor)';
      case 'ner':
        return 'AI Rapida (NER)';
      case 'llm':
        return 'AI Completa (LLM)';
      case 'embeddings':
        return 'Classificazione (Embeddings)';
      default:
        return '';
    }
  }, [activeEditor]);

  const getActiveEditorColor = React.useCallback(() => {
    if (!activeEditor) return '#10b981';
    switch (activeEditor) {
      case 'regex':
        return EXTRACTOR_COLORS.regex;
      case 'extractor':
        return EXTRACTOR_COLORS.deterministic;
      case 'ner':
        return EXTRACTOR_COLORS.ner;
      case 'llm':
        return EXTRACTOR_COLORS.llm;
      case 'embeddings':
        return EXTRACTOR_COLORS.embeddings;
      default:
        return '#10b981';
    }
  }, [activeEditor]);

  const getTextColor = React.useCallback((bgColor: string) => {
    // Colori chiari che richiedono testo scuro
    const lightColors = [EXTRACTOR_COLORS.regex, EXTRACTOR_COLORS.deterministic, EXTRACTOR_COLORS.ner, EXTRACTOR_COLORS.llm];
    if (lightColors.includes(bgColor)) {
      return '#0b0f17'; // Testo scuro per sfondi chiari
    }
    return '#fff'; // Testo bianco per sfondi scuri
  }, []);

  return (
    <>
      {/* Custom scrollbar styles */}
      <style>{`
        .tester-grid-scroll::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }
        .tester-grid-scroll::-webkit-scrollbar-track {
          background: #f9fafb;
          border-radius: 6px;
        }
        .tester-grid-scroll::-webkit-scrollbar-thumb {
          background: #64748b;
          border-radius: 6px;
          border: 2px solid #f9fafb;
        }
        .tester-grid-scroll::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        position: 'relative',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}>
        <div
          ref={scrollContainerRef}
          className="tester-grid-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'auto',
            position: 'relative',
          }}>
          <table ref={tableRef} style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed' as any,
            minWidth: 'max-content',
          }}>
            <TesterGridHeader
              contract={contract}
              onContractChange={onContractChange}
              newExample={newExample}
              setNewExample={setNewExample}
              onAddExample={handleAddExample}
              phraseColumnWidth={phraseColumnWidth}
              isResizing={isResizing}
              onResizeStart={handleResizeStart}
              enabledMethods={enabledMethods}
              toggleMethod={toggleMethod}
              activeEditor={activeEditor}
              toggleEditor={toggleEditor}
              openEditor={openEditor}
              showDeterministic={showDeterministic}
              showNER={showNER}
              showEmbeddings={showEmbeddings}
              headerRowRef={headerRowRef}
            />
            <tbody>
              {examplesList.map((ex, i) => (
                <TesterGridRow
                  key={i}
                  rowIndex={i}
                  phrase={ex}
                  rowResult={rowResults[i] || {}}
                  phraseColumnWidth={phraseColumnWidth}
                  isResizing={isResizing}
                  onResizeStart={handleResizeStart}
                  selectedRow={selectedRow}
                  onSelectRow={setSelectedRow}
                  kind={kind}
                  expectedKeysForKind={expectedKeysForKind}
                  enabledMethods={enabledMethods}
                  showDeterministic={showDeterministic}
                  showNER={showNER}
                  showEmbeddings={showEmbeddings}
                  activeEditor={activeEditor}
                  contract={contract}
                  // ✅ FASE 2 - REMOVED: cellOverrides, setCellOverrides - now managed via Zustand store
                  editingCell={editingCell}
                  setEditingCell={setEditingCell}
                  editingText={editingText}
                  setEditingText={setEditingText}
                  // ✅ REMOVED: Notes props - now managed via Zustand store
                  runRowTest={runRowTest}
                  runAllRows={runAllRows}
                  testing={testing}
                  examplesListLength={examplesList.length}
                  reportOpen={reportOpen}
                  setReportOpen={setReportOpen}
                  baselineStats={baselineStats}
                  lastStats={lastStats}
                />
              ))}
              {examplesList.length === 0 && (
                <tr>
                  <td colSpan={100} style={{ padding: 20, textAlign: 'center', opacity: 0.7 }}>
                    — nessuna frase —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Editor overlay when active */}
        <MemoizedEditorOverlay
          activeEditor={activeEditor}
          testing={testing || false}
          editorOverlayStyle={editorOverlayStyle}
          editorProps={editorProps}
          toggleEditor={toggleEditor}
          onCloseEditor={onCloseEditor}
          editorButton={editorButton}
          editorErrorMessage={editorErrorMessage}
          getActiveEditorColor={getActiveEditorColor}
          getActiveEditorTitle={getActiveEditorTitle}
          getTextColor={getTextColor}
          setEditorButton={setEditorButton}
          setEditorErrorMessage={setEditorErrorMessage}
        />
      </div>
    </>
  );
}

// Memo with custom comparator to prevent re-renders during batch testing
// Only compares rowResults elements that have actually changed
const TesterGrid = React.memo(TesterGridComponent, (prev, next) => {
  // If rowResults has the same length and same object references, don't re-render
  if (prev.rowResults.length !== next.rowResults.length) {
    return false; // Re-render se la lunghezza è cambiata
  }

  // Compare each rowResults element
  // If any element changed, re-render (but React.memo of children will handle the rest)
  for (let i = 0; i < prev.rowResults.length; i++) {
    if (prev.rowResults[i] !== next.rowResults[i]) {
      return false; // Element changed - re-render (but memoized TesterGridRow will handle granular comparison)
    }
  }

  // Compare contract to force re-render when it changes
  if (prev.contract !== next.contract) {
    return false;
  }
  // Compare contracts array
  const prevContractsKey = prev.contract?.contracts?.map(c => `${c.type}:${c.enabled}`).join(',') || '';
  const nextContractsKey = next.contract?.contracts?.map(c => `${c.type}:${c.enabled}`).join(',') || '';
  if (prevContractsKey !== nextContractsKey) {
    return false;
  }

  // Other critical props
  if (prev.testing !== next.testing) {
    return false;
  }
  if (prev.selectedRow !== next.selectedRow) {
    return false;
  }
  if (prev.examplesList !== next.examplesList) {
    return false;
  }
  if (prev.activeEditor !== next.activeEditor) {
    return false;
  }
  if (prev.newExample !== next.newExample) {
    return false; // newExample must trigger re-render
  }

  // All other props are functions or objects that don't change during batch
  // Memoized rows will handle their internal comparisons
  return true; // Skip re-render
});

TesterGrid.displayName = 'TesterGrid';

export default TesterGrid;