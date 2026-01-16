import React from 'react';
import { Wand2, X } from 'lucide-react';
// Inline editors
import RegexInlineEditor from './InlineEditors/RegexInlineEditor';
import ExtractorInlineEditor from './InlineEditors/ExtractorInlineEditor';
import NERInlineEditor from './InlineEditors/NERInlineEditor';
import LLMInlineEditor from './InlineEditors/LLMInlineEditor';
import IntentEditorInlineEditor from './InlineEditors/IntentEditorInlineEditor';
// Modular components
import TesterGridHeader from './TesterGrid/components/TesterGridHeader';
import TesterGridRow from './TesterGrid/components/TesterGridRow';
import { useColumnResize } from './TesterGrid/hooks/useColumnResize';
import { useEditorOverlay } from './TesterGrid/hooks/useEditorOverlay';
import { RowResult } from './hooks/useExtractionTesting';
import type { NLPContract } from '../../DialogueDataEngine/contracts/contractLoader';

// 🎨 Colori centralizzati per extractors (usati solo per editor overlay)
const EXTRACTOR_COLORS = {
  regex: '#93c5fd',
  deterministic: '#e5e7eb',
  ner: '#fef3c7',
  llm: '#fed7aa',
  embeddings: '#e0e7ff',
};

// ✅ Memorizza il componente "Running tests..." fuori dal componente per evitare re-render
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
  contract?: NLPContract | null; // ✅ STEP 4: Contract prop
  onContractChange?: (contract: NLPContract | null) => void; // ✅ STEP 10: Callback per modificare contract
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
  cellOverrides: Record<string, string>;
  setCellOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editingCell: { row: number; col: 'det' | 'ner' | 'llm'; key: string } | null;
  setEditingCell: React.Dispatch<React.SetStateAction<{ row: number; col: 'det' | 'ner' | 'llm'; key: string } | null>>;
  editingText: string;
  setEditingText: React.Dispatch<React.SetStateAction<string>>;
  // Notes
  hasNote: (row: number, col: string) => boolean;
  getNote: (row: number, col: string) => string | undefined;
  addNote: (row: number, col: string, text: string) => void;
  deleteNote: (row: number, col: string) => void;
  isEditing: (row: number, col: string) => boolean;
  startEditing: (row: number, col: string) => void;
  stopEditing: () => void;
  isHovered: (row: number, col: string) => boolean;
  setHovered: (row: number | null, col: string | null) => void;
  // Editor toggle
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings' | null;
  toggleEditor: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings') => void;
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
  contract, // ✅ STEP 4: Contract prop
  onContractChange, // ✅ STEP 10: Callback per modificare contract
  examplesList,
  rowResults,
  selectedRow,
  setSelectedRow,
  enabledMethods,
  toggleMethod,
  runRowTest,
  kind,
  expectedKeysForKind,
  cellOverrides,
  setCellOverrides,
  editingCell,
  setEditingCell,
  editingText,
  setEditingText,
  hasNote,
  getNote,
  addNote,
  deleteNote,
  isEditing,
  startEditing,
  stopEditing,
  isHovered,
  setHovered,
  activeEditor,
  toggleEditor,
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
  // Determine which columns to show based on mode
  const showDeterministic = mode !== 'classification';
  const showNER = mode !== 'classification';
  const showEmbeddings = mode === 'classification';

  // ✅ FIX: Calculate colSpan for empty state based on dynamic contract columns
  // ✅ FIX: Rimossa variabile non usata (colSpanEmpty)

  // Handler for adding new example
  // ✅ SIMPLIFIED: Catena lineare - usa ref per evitare dipendenze che causano re-render
  const newExampleRef = React.useRef<string>(newExample);
  React.useEffect(() => {
    newExampleRef.current = newExample;
  }, [newExample]);

  const handleAddExample = React.useCallback(() => {
    const t = (newExampleRef.current || '').trim();
    if (!t) return;

    // ✅ SIMPLIFIED: Solo aggiungi la frase, senza lanciare test automatico
    // Il test automatico causava re-render che bloccavano l'input
    setExamplesList((prevList) => {
      const existIdx = prevList.findIndex((p) => p === t);
      if (existIdx !== -1) {
        // Frase già esistente: seleziona ma NON testare
        setSelectedRow(existIdx);
        setNewExample('');
        return prevList;
      } else {
        // Nuova frase: aggiungi alla lista
        const next = Array.from(new Set([...prevList, t]));
        setNewExample('');
        // ✅ Seleziona l'ultima riga aggiunta
        setSelectedRow(next.length - 1);
        return next;
      }
    });
  }, [setExamplesList, setSelectedRow, setNewExample]);

  // Use modular hooks
  const { phraseColumnWidth, isResizing, handleResizeStart } = useColumnResize(280);
  const { editorOverlayStyle, tableRef, headerRowRef } = useEditorOverlay({
    activeEditor,
    showDeterministic,
    showNER,
    examplesListLength: examplesList.length,
    phraseColumnWidth,
  });

  // ✅ Stato per il pulsante dell'editor da mostrare nell'header
  const [editorButton, setEditorButton] = React.useState<React.ReactNode>(null);
  // ✅ Stato per il messaggio di errore da mostrare nell'header
  const [editorErrorMessage, setEditorErrorMessage] = React.useState<React.ReactNode>(null);

  // ✅ Reset del pulsante e del messaggio di errore quando l'editor cambia o viene chiuso
  React.useEffect(() => {
    if (!activeEditor) {
      setEditorButton(null);
      setEditorErrorMessage(null);
    }
  }, [activeEditor]);

  // Determina quale editor renderizzare
  const renderEditor = () => {
    if (!activeEditor || !['regex', 'extractor', 'ner', 'llm', 'embeddings'].includes(activeEditor) || !editorProps) {
      return null;
    }

    const commonProps = {
      onClose: onCloseEditor || (() => toggleEditor(activeEditor)),
      node: editorProps.node,
      profile: editorProps.profile,
      testCases: editorProps.testCases,
      setTestCases: editorProps.setTestCases,
      onProfileUpdate: editorProps.onProfileUpdate,
      onButtonRender: setEditorButton, // ✅ Espone il pulsante all'overlay
    };

    switch (activeEditor) {
      case 'regex':
        return (
          <RegexInlineEditor
            regex={editorProps.regex || ''}
            setRegex={editorProps.setRegex || (() => { })}
            kind={editorProps.kind}
            {...commonProps}
            onErrorRender={setEditorErrorMessage} // ✅ Espone il messaggio di errore all'overlay
          />
        );
      case 'extractor':
        return <ExtractorInlineEditor {...commonProps} />;
      case 'ner':
        return <NERInlineEditor {...commonProps} />;
      case 'llm':
        return <LLMInlineEditor {...commonProps} />;
      case 'embeddings':
        const actForEmbeddings = editorProps.node?.task ? {
          id: editorProps.node.task.id || editorProps.node.task.instanceId || '',
          type: editorProps.node.task.type || '',
          label: editorProps.node.task.label,
          instanceId: editorProps.node.task.instanceId,
        } : undefined;

        // ✅ DEBUG: Log solo se act è undefined per diagnosticare
        if (!actForEmbeddings) {
          console.warn('[TesterGrid][embeddings] act is undefined', {
            hasNode: !!editorProps.node,
            hasTask: !!editorProps.node?.task,
            nodeTask: editorProps.node?.task,
          });
        }

        return (
          <IntentEditorInlineEditor
            {...commonProps}
            act={actForEmbeddings}
          />
        );
      default:
        return null;
    }
  };

  // Determina il nome dell'editor attivo
  const getActiveEditorTitle = () => {
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
  };

  // Determina il colore dell'header in base all'editor attivo
  const getActiveEditorColor = () => {
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
  };

  // Determina il colore del testo in base al colore di sfondo (per leggibilità)
  const getTextColor = (bgColor: string) => {
    // Colori chiari che richiedono testo scuro
    const lightColors = [EXTRACTOR_COLORS.regex, EXTRACTOR_COLORS.deterministic, EXTRACTOR_COLORS.ner, EXTRACTOR_COLORS.llm];
    if (lightColors.includes(bgColor)) {
      return '#0b0f17'; // Testo scuro per sfondi chiari
    }
    return '#fff'; // Testo bianco per sfondi scuri
  };

  return (
    <>
      {/* ✅ Stili per la scrollbar personalizzata */}
      <style>{`
        .tester-grid-scroll::-webkit-scrollbar {
          width: 12px;
          height: 12px; /* ✅ AGGIUNTO: Altezza per scrollbar orizzontale */
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
        {/* ✅ FIX: Tabella unica con position sticky - soluzione semplificata */}
        <div
          className="tester-grid-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'auto', // ✅ Scroll orizzontale per tutte le colonne (scrollbar può estendersi per tutta la larghezza)
          }}>
          <table ref={tableRef} style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed' as any,
            minWidth: 'max-content', // ✅ Tabella si espande oltre il contenitore
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
                  cellOverrides={cellOverrides}
                  setCellOverrides={setCellOverrides}
                  editingCell={editingCell}
                  setEditingCell={setEditingCell}
                  editingText={editingText}
                  setEditingText={setEditingText}
                  hasNote={hasNote}
                  getNote={getNote}
                  addNote={addNote}
                  deleteNote={deleteNote}
                  isEditing={isEditing}
                  startEditing={startEditing}
                  stopEditing={stopEditing}
                  isHovered={isHovered}
                  setHovered={setHovered}
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

        {/* Overlay dell'editor quando attivo */}
        {/* ✅ Don't render editor during batch testing to prevent Monaco unmount errors */}
        {activeEditor && !testing && ['regex', 'extractor', 'ner', 'llm'].includes(activeEditor) && Object.keys(editorOverlayStyle).length > 0 && (
          <div
            style={{
              ...editorOverlayStyle,
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              pointerEvents: 'auto', // ✅ Permetti interazioni con l'overlay
            }}
          >
            {/* Header dell'editor (colore dinamico basato sulla colonna) */}
            <div
              style={{
                background: getActiveEditorColor(),
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
                borderRadius: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={true} readOnly style={{ cursor: 'default' }} />
                <span style={{ fontWeight: 600, color: getTextColor(getActiveEditorColor()) }}>{getActiveEditorTitle()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, justifyContent: 'flex-end' }}>
                {editorErrorMessage && (
                  <div style={{ marginLeft: 'auto', marginRight: 0 }}>
                    {editorErrorMessage}
                  </div>
                )}
                {editorButton && (
                  <div style={{ marginRight: 0 }}>
                    {editorButton}
                  </div>
                )}
                <button
                  onClick={() => toggleEditor(activeEditor)}
                  style={{
                    background: 'rgba(0,0,0,0.1)',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                  }}
                  title="Configure"
                >
                  <Wand2 size={14} color={getTextColor(getActiveEditorColor())} />
                </button>
                <button
                  onClick={onCloseEditor || (() => toggleEditor(activeEditor))}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    color: getTextColor(getActiveEditorColor()),
                  }}
                  title="Close Editor"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Corpo dell'editor */}
            <div style={{ flex: 1, overflow: 'auto', padding: 6, minHeight: 0 }}>
              {renderEditor()}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ✅ CRITICAL: Memo con comparatore personalizzato per prevenire re-render durante batch
// Confronta solo gli elementi di rowResults che sono effettivamente cambiati
const TesterGrid = React.memo(TesterGridComponent, (prev, next) => {
  // ✅ Se rowResults ha la stessa lunghezza e gli stessi riferimenti agli oggetti, non re-renderizzare
  if (prev.rowResults.length !== next.rowResults.length) {
    return false; // Re-render se la lunghezza è cambiata
  }

  // ✅ Confronta ogni elemento di rowResults
  // Se anche solo un elemento è cambiato, re-renderizza (ma React.memo dei figli gestirà il resto)
  for (let i = 0; i < prev.rowResults.length; i++) {
    if (prev.rowResults[i] !== next.rowResults[i]) {
      // ✅ Elemento cambiato - re-renderizza (ma TesterGridRow memoizzato gestirà il confronto granulare)
      return false;
    }
  }

  // ✅ CRITICAL FIX: Confronta contract per forzare re-render quando cambia
  if (prev.contract !== next.contract) {
    return false;
  }
  if (prev.contract?.escalationOrder?.join(',') !== next.contract?.escalationOrder?.join(',')) {
    return false;
  }

  // ✅ Altri props critici
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
    return false; // ✅ CRITICAL: newExample deve triggerare re-render!
  }

  // ✅ Tutti gli altri props sono funzioni o oggetti che non cambiano durante batch
  // Le righe memoizzate gestiranno i loro confronti interni
  return true; // Skip re-render
});

TesterGrid.displayName = 'TesterGrid';

export default TesterGrid;