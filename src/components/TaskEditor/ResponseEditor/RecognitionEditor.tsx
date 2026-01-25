import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import KindSelector from './Config/KindSelector';
import ConfidenceInput from './Config/ConfidenceInput';
import WaitingMessagesConfig from './Config/WaitingMessagesConfig';
import TesterGrid from './TesterGrid';
import { RowResult } from './hooks/useExtractionTesting';
import { loadContractFromNode, saveContractToNode } from './ContractSelector/contractHelpers';
import type { DataContract } from '../../DialogueDataEngine/contracts/contractLoader';

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
  openEditor?: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  mode?: 'extraction' | 'classification';
  newExample: string;
  setNewExample: React.Dispatch<React.SetStateAction<string>>;
  setExamplesList: React.Dispatch<React.SetStateAction<string[]>>;
  onCloseEditor?: () => void;
  editorProps?: {
    regex?: string;
    setRegex?: (value: string) => void;
    extractorCode?: string;
    setExtractorCode?: (value: string) => void;
    entityTypes?: string[];
    setEntityTypes?: (value: string[]) => void;
    systemPrompt?: string;
    setSystemPrompt?: (value: string) => void;
    node?: any;
    kind?: string;
    profile?: any;
    testCases?: string[];
    setTestCases?: (cases: string[]) => void;
    onProfileUpdate?: (profile: any) => void;
    task?: any;
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
  openEditor,
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
  // Load contract from node
  const [localContract, setLocalContract] = useState<DataContract | null>(() => {
    const node = editorProps?.node;
    if (!node) {
      console.log('[🔍 RecognitionEditor][INIT] No node provided');
      return null;
    }
    console.log('[🔍 RecognitionEditor][INIT] Loading contract from node', {
      nodeLabel: node?.label,
      nodeId: node?.id,
      nodeTemplateId: node?.templateId,
      hasNodeDataContract: !!node?.dataContract,
      nodeDataContractKeys: node?.dataContract ? Object.keys(node.dataContract) : [],
      nodeDataContractContractsCount: node?.dataContract?.contracts?.length || 0
    });
    const contract = loadContractFromNode(node);
    console.log('[🔍 RecognitionEditor][INIT] Contract loaded', {
      hasContract: !!contract,
      contractKeys: contract ? Object.keys(contract) : [],
      contractsCount: contract?.contracts?.length || 0
    });
    return contract;
  });

  // Sincronizza localContract con node SOLO quando cambia il node
  const prevNodeRef = React.useRef(editorProps?.node);
  useEffect(() => {
    const node = editorProps?.node;
    if (node !== prevNodeRef.current) {
      prevNodeRef.current = node;
      if (!node) {
        setLocalContract(null);
        return;
      }
      console.log('[🔍 RecognitionEditor][NODE_CHANGE] Node changed, reloading contract', {
        nodeLabel: node?.label,
        nodeId: node?.id,
        nodeTemplateId: node?.templateId,
        hasNodeDataContract: !!node?.dataContract,
        nodeDataContractContractsCount: node?.dataContract?.contracts?.length || 0
      });
      const loadedContract = loadContractFromNode(node);
      console.log('[🔍 RecognitionEditor][NODE_CHANGE] Contract reloaded', {
        hasContract: !!loadedContract,
        contractsCount: loadedContract?.contracts?.length || 0
      });
      setLocalContract(loadedContract);
    }
  }, [editorProps?.node]);

  // ✅ Usa direttamente localContract come contract (non serve creare nuovo oggetto)
  const contract = localContract;

  // Handle contract changes and save to node
  const handleContractChange = useCallback((updatedContract: DataContract | null) => {
    const node = editorProps?.node;
    if (!node) {
      console.warn('[RecognitionEditor][handleContractChange] No node available');
      return;
    }

    console.log('[RecognitionEditor][handleContractChange] Saving contract', {
      hasContract: !!updatedContract,
      contractsCount: updatedContract?.contracts?.length || 0,
      contractTypes: updatedContract?.contracts?.map(c => c.type) || [],
    });

    // Crea un nuovo oggetto per forzare il cambio di riferimento
    const contractToSave = updatedContract ? {
      ...updatedContract,
      contracts: updatedContract.contracts ? [...updatedContract.contracts] : [],
      subDataMapping: { ...updatedContract.subDataMapping },
    } : null;

    // Save contract to node
    saveContractToNode(node, contractToSave);

    // Aggiorna lo stato locale IMMEDIATAMENTE con un nuovo oggetto per forzare re-render
    setLocalContract(contractToSave);

    console.log('[RecognitionEditor][handleContractChange] Updated localContract', {
      contractsCount: contractToSave?.contracts?.length || 0,
      contractTypes: contractToSave?.contracts?.map(c => c.type) || [],
    });

    // ✅ Notify parent component of the change (if onProfileUpdate exists, use it)
    if (editorProps?.onProfileUpdate) {
      // Trigger a profile update to ensure the change is persisted
      editorProps.onProfileUpdate(editorProps.profile || {});
    }
  }, [editorProps?.node, editorProps?.onProfileUpdate, editorProps?.profile]);

  // ✅ Costruisci editorProps dinamico basato su activeEditor e contract
  // ✅ IMPORTANTE: Usa solo activeEditor come dipendenza, non contract o handleContractChange
  // per evitare loop infiniti. contract e handleContractChange sono stabili.
  const dynamicEditorProps = useMemo(() => {
    const node = editorProps?.node;
    if (!node || !contract) {
      return editorProps; // Fallback agli editorProps passati
    }

    // ✅ Trova il contract item corrispondente all'editor attivo
    // Map editor type to contract type: 'extractor' → 'rules', others stay the same
    const getContractTypeFromEditorType = (editorType: string): string => {
      if (editorType === 'extractor') return 'rules';
      return editorType;
    };

    const contractItem = activeEditor ? contract.contracts?.find((c: any) => {
      const expectedContractType = getContractTypeFromEditorType(activeEditor);
      return c.type === expectedContractType;
    }) : null;

    // Log rimosso per evitare loop infinito

    const baseProps = {
      node,
      kind: editorProps?.kind,
      profile: editorProps?.profile,
      testCases: editorProps?.testCases,
      setTestCases: editorProps?.setTestCases,
      onProfileUpdate: editorProps?.onProfileUpdate,
      task: editorProps?.task,
    };

    switch (activeEditor) {
      case 'regex':
        return {
          ...baseProps,
          regex: contractItem?.patterns?.[0] || editorProps?.regex || '',
          setRegex: (value: string) => {
            // ✅ Aggiorna il contract item specifico usando contractItem.type
            if (contractItem && contract) {
              const contractType = contractItem.type;
              const updatedContracts = contract.contracts.map((c: any) =>
                c.type === contractType ? { ...c, patterns: [value] } : c
              );
              const updatedContract = { ...contract, contracts: updatedContracts };
              handleContractChange(updatedContract);
            } else if (editorProps?.setRegex) {
              // Fallback al vecchio comportamento
              editorProps.setRegex(value);
            }
          },
        };
      case 'extractor':
        // ExtractorInlineEditor gestisce extractorCode internamente, ma potremmo sincronizzarlo
        return {
          ...baseProps,
          extractorCode: contractItem?.extractorCode || '',
          setExtractorCode: (value: string) => {
            if (contractItem && contract) {
              const contractType = contractItem.type; // Should be 'rules'
              const updatedContracts = contract.contracts.map((c: any) =>
                c.type === contractType ? { ...c, extractorCode: value } : c
              );
              const updatedContract = { ...contract, contracts: updatedContracts };
              handleContractChange(updatedContract);
            }
          },
        };
      case 'ner':
        return {
          ...baseProps,
          entityTypes: contractItem?.entityTypes || [],
          setEntityTypes: (value: string[]) => {
            if (contractItem && contract) {
              const contractType = contractItem.type;
              const updatedContracts = contract.contracts.map((c: any) =>
                c.type === contractType ? { ...c, entityTypes: value } : c
              );
              const updatedContract = { ...contract, contracts: updatedContracts };
              handleContractChange(updatedContract);
            }
          },
        };
      case 'llm':
        return {
          ...baseProps,
          systemPrompt: contractItem?.systemPrompt || '',
          setSystemPrompt: (value: string) => {
            if (contractItem && contract) {
              const contractType = contractItem.type;
              const updatedContracts = contract.contracts.map((c: any) =>
                c.type === contractType ? { ...c, systemPrompt: value } : c
              );
              const updatedContract = { ...contract, contracts: updatedContracts };
              handleContractChange(updatedContract);
            }
          },
        };
      default:
        return editorProps || baseProps;
    }
    // ✅ SOLO activeEditor come dipendenza principale
    // ✅ contract e editorProps sono letti ma non nelle dipendenze per evitare loop infiniti
    // ✅ handleContractChange è stabile (useCallback con dipendenze corrette)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEditor]);

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
          contract={contract}
          onContractChange={handleContractChange}
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
          openEditor={openEditor}
          mode={mode}
          newExample={newExample}
          setNewExample={setNewExample}
          setExamplesList={setExamplesList}
          onCloseEditor={onCloseEditor}
          editorProps={dynamicEditorProps}
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





