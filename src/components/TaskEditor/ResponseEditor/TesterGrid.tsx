import React from 'react';
import { Wand2, X, ChevronsRight, BarChart2 } from 'lucide-react';
// Inline editors
import RegexInlineEditor from './InlineEditors/RegexInlineEditor';
import ExtractorInlineEditor from './InlineEditors/ExtractorInlineEditor';
import NERInlineEditor from './InlineEditors/NERInlineEditor';
import LLMInlineEditor from './InlineEditors/LLMInlineEditor';
// Modular components
import TesterGridHeader from './TesterGrid/components/TesterGridHeader';
import TesterGridRow from './TesterGrid/components/TesterGridRow';
import { useColumnResize } from './TesterGrid/hooks/useColumnResize';
import { useEditorOverlay } from './TesterGrid/hooks/useEditorOverlay';

// 🎨 Colori centralizzati per extractors (usati solo per editor overlay)
const EXTRACTOR_COLORS = {
  regex: '#93c5fd',
  deterministic: '#e5e7eb',
  ner: '#fef3c7',
  llm: '#fed7aa',
  embeddings: '#e0e7ff',
};

interface TesterGridProps {
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
  toggleEditor: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
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


export default function TesterGrid({
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

  // Calculate colSpan for empty state (1 for Frase + Regex + conditionals + LLM + buttons column)
  const colSpanEmpty = 1 + 1 + (showDeterministic ? 1 : 0) + (showNER ? 1 : 0) + (showEmbeddings ? 1 : 0) + 1 + 1;

  // Handler for adding new example
  const handleAddExample = React.useCallback(() => {
    const t = (newExample || '').trim();
    if (!t) return;

    // Usa la versione funzionale di setExamplesList per avere sempre lo stato più recente
    setExamplesList((prevList) => {
      const existIdx = prevList.findIndex((p) => p === t);
      if (existIdx !== -1) {
        // Frase già esistente: seleziona e testa
        setSelectedRow(existIdx);
        setTimeout(() => { void runRowTest(existIdx); }, 0);
        return prevList; // Non modificare la lista
      } else {
        // Nuova frase: aggiungi alla lista
        const next = Array.from(new Set([...prevList, t]));
        const newIdx = next.length - 1;
        setSelectedRow(newIdx);
        // Esegui il test dopo che lo stato è stato aggiornato
        setTimeout(() => { void runRowTest(newIdx); }, 100);
        return next; // Ritorna la nuova lista
      }
    });
    setNewExample('');
  }, [newExample, setExamplesList, setSelectedRow, runRowTest]);

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

  // ✅ Reset del pulsante quando l'editor cambia o viene chiuso
  React.useEffect(() => {
    if (!activeEditor) {
      setEditorButton(null);
    }
  }, [activeEditor]);

  // Determina quale editor renderizzare
  const renderEditor = () => {
    if (!activeEditor || !['regex', 'extractor', 'ner', 'llm'].includes(activeEditor) || !editorProps) {
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
            setRegex={editorProps.setRegex || (() => {})}
            kind={editorProps.kind}
            {...commonProps}
          />
        );
      case 'extractor':
        return <ExtractorInlineEditor {...commonProps} />;
      case 'ner':
        return <NERInlineEditor {...commonProps} />;
      case 'llm':
        return <LLMInlineEditor {...commonProps} />;
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
          className="tester-grid-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}>
        <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' as any }}>
          <TesterGridHeader
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
            <>
              <tr>
                <td style={{ padding: 10, opacity: 0.7 }}>— nessuna frase —</td>
                <td style={{ padding: 4, textAlign: 'center', verticalAlign: 'middle', background: '#f9fafb' }}>
                  {runAllRows && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void runAllRows();
                      }}
                      disabled={testing || examplesList.length === 0}
                      title="Prova tutte"
                      style={{
                        border: '1px solid #22c55e',
                        background: testing ? '#eab308' : '#14532d',
                        color: '#dcfce7',
                        borderRadius: 8,
                        padding: '8px 10px',
                        cursor: testing || examplesList.length === 0 ? 'not-allowed' : 'pointer',
                        width: '100%',
                        opacity: testing || examplesList.length === 0 ? 0.5 : 1,
                      }}
                    >
                      <ChevronsRight size={16} />
                    </button>
                  )}
                </td>
                <td colSpan={colSpanEmpty - 2} style={{ padding: 10, opacity: 0.7 }}></td>
              </tr>
              {setReportOpen && (
                <tr>
                  <td style={{ padding: 10, opacity: 0.7 }}></td>
                  <td style={{ padding: 4, textAlign: 'center', verticalAlign: 'middle', background: '#f9fafb' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportOpen(!reportOpen);
                        }}
                        title="Report"
                        style={{
                          border: '1px solid #60a5fa',
                          background: '#0c4a6e',
                          color: '#dbeafe',
                          borderRadius: 8,
                          padding: '8px 10px',
                          cursor: 'pointer',
                          width: '100%',
                        }}
                      >
                        <BarChart2 size={16} />
                      </button>
                      {reportOpen && (
                        <div style={{
                          position: 'absolute',
                          right: 0,
                          top: '100%',
                          marginTop: 6,
                          background: '#111827',
                          color: '#e5e7eb',
                          border: '1px solid #374151',
                          borderRadius: 8,
                          padding: 10,
                          minWidth: 260,
                          zIndex: 30,
                        }}>
                          {(() => {
                            const base = baselineStats || { matched: 0, falseAccept: 0, totalGt: 0 };
                            const last = lastStats || base;
                            const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0;
                            const gainedMatched = pct(last.matched, last.totalGt) - pct(base.matched, base.totalGt);
                            const removedFA = pct(base.falseAccept, base.totalGt) - pct(last.falseAccept, last.totalGt);
                            const stillUnmatch = Math.max(0, (last.totalGt - last.matched - last.falseAccept));
                            const stillFA = last.falseAccept;
                            const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`);
                            return (
                              <div style={{ display: 'grid', gap: 6 }}>
                                <div><strong>Gained Matched:</strong> {sign(gainedMatched)}%</div>
                                <div><strong>Removed False acceptance:</strong> {sign(removedFA)}%</div>
                                <div><strong>Still UnMatching:</strong> {stillUnmatch}</div>
                                <div><strong>Still False acceptance:</strong> {stillFA} ({sign(pct(last.falseAccept, last.totalGt) - pct(base.falseAccept, base.totalGt))}%)</div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
        </div>

      {/* Overlay dell'editor quando attivo */}
      {activeEditor && ['regex', 'extractor', 'ner', 'llm'].includes(activeEditor) && Object.keys(editorOverlayStyle).length > 0 && (
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
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

