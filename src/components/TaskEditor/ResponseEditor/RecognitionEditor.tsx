import React from 'react';
import { MessageCircle } from 'lucide-react';
import KindSelector from './Config/KindSelector';
import ConfidenceInput from './Config/ConfidenceInput';
import WaitingMessagesConfig from './Config/WaitingMessagesConfig';
import TesterGrid from './TesterGrid';
import { RowResult } from './hooks/useExtractionTesting';

interface RecognitionEditorProps {
  // Config props (Kind, Confidence, Waiting Messages)
  kind: string;
  setKind: (kind: string) => void;
  lockKind: boolean;
  setLockKind: (lock: boolean) => void;
  inferredKind?: string;
  minConf: number;
  setMinConf: (conf: number) => void;
  waitingEsc1: string;
  setWaitingEsc1: (msg: string) => void;
  waitingEsc2: string;
  setWaitingEsc2: (msg: string) => void;
  isIntentKind: boolean;

  // TesterGrid props
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
  toggleMethod: (method: keyof RecognitionEditorProps['enabledMethods']) => void;
  runRowTest: (idx: number) => Promise<void>;
  expectedKeysForKind: (k?: string) => string[];
  cellOverrides: Record<string, string>;
  setCellOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editingCell: { row: number; col: 'det' | 'ner' | 'llm'; key: string } | null;
  setEditingCell: React.Dispatch<React.SetStateAction<{ row: number; col: 'det' | 'ner' | 'llm'; key: string } | null>>;
  editingText: string;
  setEditingText: React.Dispatch<React.SetStateAction<string>>;
  hasNote: (row: number, col: string) => boolean;
  getNote: (row: number, col: string) => string | undefined;
  addNote: (row: number, col: string, text: string) => void;
  deleteNote: (row: number, col: string) => void;
  isEditing: (row: number, col: string) => boolean;
  startEditing: (row: number, col: string) => void;
  stopEditing: () => void;
  isHovered: (row: number, col: string) => boolean;
  setHovered: (row: number | null, col: string | null) => void;
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings' | null;
  toggleEditor: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  mode?: 'extraction' | 'classification';
  newExample: string;
  setNewExample: React.Dispatch<React.SetStateAction<string>>;
  setExamplesList: React.Dispatch<React.SetStateAction<string[]>>;
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
  runAllRows?: () => Promise<void>;
  testing?: boolean;
  reportOpen?: boolean;
  setReportOpen?: (open: boolean) => void;
  baselineStats?: { matched: number; falseAccept: number; totalGt: number } | null;
  lastStats?: { matched: number; falseAccept: number; totalGt: number } | null;
}

/**
 * Unified Recognition Editor component that combines:
 * - Top bar: Kind, Confidence, Waiting Messages
 * - TesterGrid: Test phrases grid with inline editors
 */
export default function RecognitionEditor({
  // Config props
  kind,
  setKind,
  lockKind,
  setLockKind,
  inferredKind,
  minConf,
  setMinConf,
  waitingEsc1,
  setWaitingEsc1,
  waitingEsc2,
  setWaitingEsc2,
  isIntentKind,

  // TesterGrid props
  examplesList,
  rowResults,
  selectedRow,
  setSelectedRow,
  enabledMethods,
  toggleMethod,
  runRowTest,
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
  mode = 'extraction',
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
}: RecognitionEditorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
      {/* ✅ Top bar: Kind, Confidence, Waiting Messages - sempre visibile */}
      <div style={{ padding: 6, flexShrink: 0 }}>
        {isIntentKind ? (
          // ✅ Quando kind === "intent", mostra solo Waiting LLM
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label
              style={{
                opacity: 0.8,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
              }}
            >
              <MessageCircle size={14} />
              Waiting LLM
            </label>
            <input
              value={waitingEsc2 || 'Un momento per favore, sto analizzando la sua richiesta'}
              onChange={(e) => setWaitingEsc2(e.target.value)}
              title="Testo mostrato all'utente mentre si attende l'analisi LLM"
              style={{
                flex: 1,
                padding: '6px 8px',
                border: '2px solid #9ca3af',
                borderRadius: 6,
                background: 'rgba(239, 68, 68, 0.2)', // Rosso spento con trasparenza 80%
              }}
            />
          </div>
        ) : (
          // ✅ Layout normale: Kind, Confidence, Waiting Messages
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 300px) auto 1fr', gap: 12, alignItems: 'center' }}>
            {/* Kind Selector Component */}
            <KindSelector
              kind={kind}
              setKind={setKind}
              lockKind={lockKind}
              setLockKind={setLockKind}
              inferredKind={inferredKind}
              hideIfIntent={true}
            />

            {/* Confidence Component */}
            <ConfidenceInput value={minConf} onChange={setMinConf} />

            {/* Waiting Messages Component */}
            <WaitingMessagesConfig
              waitingNER={waitingEsc1}
              setWaitingNER={setWaitingEsc1}
              waitingLLM={waitingEsc2}
              setWaitingLLM={setWaitingEsc2}
            />
          </div>
        )}
      </div>

      {/* ✅ TesterGrid - sempre visibile, l'editor si sovrappone quando attivo */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <TesterGrid
          examplesList={examplesList}
          rowResults={rowResults}
          selectedRow={selectedRow}
          setSelectedRow={setSelectedRow}
          enabledMethods={enabledMethods}
          toggleMethod={toggleMethod}
          runRowTest={runRowTest}
          kind={kind}
          expectedKeysForKind={expectedKeysForKind}
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
          activeEditor={activeEditor}
          toggleEditor={toggleEditor}
          mode={mode}
          newExample={newExample}
          setNewExample={setNewExample}
          setExamplesList={setExamplesList}
          onCloseEditor={onCloseEditor}
          editorProps={editorProps}
          runAllRows={runAllRows}
          testing={testing}
          reportOpen={reportOpen}
          setReportOpen={setReportOpen}
          baselineStats={baselineStats}
          lastStats={lastStats}
        />
      </div>
    </div>
  );
}





