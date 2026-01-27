import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import KindSelector from './Config/KindSelector';
import ConfidenceInput from './Config/ConfidenceInput';
import WaitingMessagesConfig from './Config/WaitingMessagesConfig';
import TesterGrid from './TesterGrid';
import { RowResult } from './hooks/useExtractionTesting';
import { loadContractFromNode } from './ContractSelector/contractHelpers';
import type { DataContract } from '../../DialogueDataEngine/contracts/contractLoader';
import DialogueTaskService from '../../../services/DialogueTaskService';
import { useProjectData } from '../../../context/ProjectDataContext';

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
  updateSelectedNode,
  contractChangeRef,
}: RecognitionEditorProps) {
  const { currentProjectId } = useProjectData();
  const task = editorProps?.task;

  // Load contract from node
  const [localContract, setLocalContract] = useState<DataContract | null>(() => {
    const node = editorProps?.node;
    if (!node) return null;
    const contract = loadContractFromNode(node);
    const regexPattern = contract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0];
    console.log('[CONTRACT] INIT - Contract loaded', {
      nodeId: node.id,
      hasContract: !!contract,
      regexPattern: regexPattern || '(none)'
    });
    return contract;
  });

  // ✅ Traccia modifiche non salvate (per verificare alla chiusura)
  const [hasUnsavedContractChanges, setHasUnsavedContractChanges] = useState(false);
  const [modifiedContract, setModifiedContract] = useState<DataContract | null>(null);

  // ✅ Ref per salvare contract originale (dal DB) per poterlo ripristinare
  const originalContractRef = React.useRef<DataContract | null>(null);

  // ✅ Carica contract SOLO quando apri l'editor o cambi nodo
  const prevNodeIdRef = React.useRef<string | undefined>(editorProps?.node?.id);
  useEffect(() => {
    const node = editorProps?.node;
    const currentNodeId = node?.id;
    const nodeIdChanged = currentNodeId !== prevNodeIdRef.current;

    if (nodeIdChanged) {
      prevNodeIdRef.current = currentNodeId;

      if (!node) {
        setLocalContract(null);
        setHasUnsavedContractChanges(false);
        setModifiedContract(null);
        originalContractRef.current = null;
        return;
      }

      // ✅ Carica dal template UNA VOLTA quando apri l'editor
      const loadedContract = loadContractFromNode(node);
      const regexPattern = loadedContract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0];
      console.log('[REGEX] INIT - Contract loaded from template', {
        nodeId: node.id,
        hasContract: !!loadedContract,
        regexPattern: regexPattern || '(none)'
      });

      // ✅ SALVA ORIGINALE (deep copy) per poterlo ripristinare se l'utente sceglie "Scarta"
      originalContractRef.current = loadedContract
        ? JSON.parse(JSON.stringify(loadedContract))
        : null;

      console.log('[CONTRACT] INIT - Original contract saved', {
        nodeId: node.id,
        hasOriginalContract: !!originalContractRef.current,
        originalRegexPattern: originalContractRef.current?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0] || '(none)'
      });

      setLocalContract(loadedContract);

      // ✅ Reset stato modifiche quando cambi nodo
      setHasUnsavedContractChanges(false);
      setModifiedContract(null);
    }
  }, [editorProps?.node?.id]);

  // ✅ Usa direttamente localContract come contract (non serve creare nuovo oggetto)
  const contract = localContract;

  // Helper: confronta contract con template
  const hasContractChanged = useCallback((nodeTemplateId: string, modifiedContract: DataContract | null): boolean => {
    if (!nodeTemplateId) return false;

    const template = DialogueTaskService.getTemplate(nodeTemplateId);
    if (!template) return false;

    const templateContract = template.dataContract;

    // Se entrambi sono null/undefined, non c'è cambiamento
    if (!templateContract && !modifiedContract) return false;

    // Se uno è null e l'altro no, c'è cambiamento
    if (!templateContract || !modifiedContract) return true;

    // Confronta deep equality
    return JSON.stringify(templateContract) !== JSON.stringify(modifiedContract);
  }, []);

  // Handle contract changes - traccia modifiche ma NON mostra dialog subito
  const handleContractChange = useCallback((updatedContract: DataContract | null) => {
    const node = editorProps?.node;
    if (!node || !node.templateId) {
      console.warn('[RecognitionEditor][handleContractChange] ❌ No node or templateId available');
      return;
    }

    const nodeTemplateId = node.templateId;
    const regexPattern = updatedContract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0];
    const nodeNlpProfileRegex = node?.nlpProfile?.regex;
    const areTheySynced = regexPattern === nodeNlpProfileRegex;

    console.log('[CONTRACT] CHANGE - Tracking modifications', {
      nodeId: node.id,
      nodeTemplateId,
      regexPattern: regexPattern || '(empty)',
      nodeNlpProfileRegex: nodeNlpProfileRegex || '(empty)',
      areTheySynced,
      '⚠️ SYNC ISSUE': !areTheySynced ? 'Contract and node.nlpProfile.regex are NOT synced!' : 'OK'
    });

    // ✅ Confronta con template
    const changed = hasContractChanged(nodeTemplateId, updatedContract);

    if (changed) {
      // ✅ AGGIORNA TEMPLATE IN MEMORIA (così quando riapri vedi le modifiche)
      const template = DialogueTaskService.getTemplate(nodeTemplateId);
      if (template) {
        template.dataContract = updatedContract
          ? JSON.parse(JSON.stringify(updatedContract))
          : null;
        // ✅ Marca template come modificato per salvataggio futuro
        DialogueTaskService.markTemplateAsModified(nodeTemplateId);
        console.log('[CONTRACT] CHANGE - Template updated in memory', {
          nodeTemplateId,
          regexPattern: updatedContract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0] || '(empty)'
        });
      }

      // ✅ Contract modificato: traccia ma NON mostra dialog
      setHasUnsavedContractChanges(true);
      setModifiedContract(updatedContract);
      setLocalContract(updatedContract); // ✅ Aggiorna UI immediatamente
      console.log('[CONTRACT] CHANGE - Contract modified, tracking for later', {
        nodeTemplateId,
        regexPattern: updatedContract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0] || '(empty)'
      });

      // ✅ CRITICAL FIX: Sincronizza contract.regex → node.nlpProfile.regex
      // Questo assicura che useProfileState legga la regex corretta per il tester
      if (updateSelectedNode && regexPattern !== undefined) {
        updateSelectedNode((prev: any) => {
          if (!prev) return prev;
          const updated = { ...prev };
          if (!updated.nlpProfile) {
            updated.nlpProfile = {};
          }
          // ✅ Sincronizza regex dal contract al node.nlpProfile
          updated.nlpProfile = {
            ...updated.nlpProfile,
            regex: regexPattern || undefined
          };
          console.log('[CONTRACT] CHANGE - Synced regex to node.nlpProfile', {
            nodeId: node.id,
            contractRegex: regexPattern || '(empty)',
            nodeNlpProfileRegex: updated.nlpProfile.regex || '(empty)',
            synced: true
          });
          return updated;
        }, false); // false = non notificare provider (solo sync locale)
      }

      // ✅ Aggiorna immediatamente il ref (non aspetta useImperativeHandle)
      if (contractChangeRef) {
        contractChangeRef.current = {
          hasUnsavedChanges: true,
          modifiedContract: updatedContract,
          originalContract: originalContractRef.current, // ✅ Passa originale per poterlo ripristinare
          nodeTemplateId: node.templateId,
          nodeLabel: node.label
        };
        console.log('[CONTRACT] CHANGE - Ref updated immediately', {
          hasUnsavedChanges: contractChangeRef.current.hasUnsavedChanges,
          nodeTemplateId: contractChangeRef.current.nodeTemplateId,
          hasOriginalContract: !!contractChangeRef.current.originalContract
        });
      }
    } else {
      // ✅ Nessun cambiamento: usa template
      const template = DialogueTaskService.getTemplate(nodeTemplateId);
      setLocalContract(template?.dataContract || null);
      setHasUnsavedContractChanges(false);
      setModifiedContract(null);
      console.log('[CONTRACT] CHANGE - No changes detected, using template contract');

      // ✅ Reset ref
      if (contractChangeRef) {
        contractChangeRef.current = {
          hasUnsavedChanges: false,
          modifiedContract: null,
          originalContract: originalContractRef.current,
          nodeTemplateId: node.templateId,
          nodeLabel: node.label
        };
      }
    }
  }, [editorProps?.node, hasContractChanged, contractChangeRef]);

  // ✅ Esponi funzione per verificare modifiche non salvate
  React.useImperativeHandle(contractChangeRef, () => {
    const result = {
      hasUnsavedChanges: hasUnsavedContractChanges,
      modifiedContract,
      originalContract: originalContractRef.current, // ✅ Esponi originale per poterlo ripristinare
      nodeTemplateId: editorProps?.node?.templateId,
      nodeLabel: editorProps?.node?.label
    };
    console.log('[CONTRACT] IMPERATIVE_HANDLE - Ref updated', {
      hasUnsavedChanges: result.hasUnsavedChanges,
      nodeTemplateId: result.nodeTemplateId,
      hasOriginalContract: !!result.originalContract
    });
    return result;
  }, [hasUnsavedContractChanges, modifiedContract, editorProps?.node]);

  // Build dynamic editorProps based on activeEditor and contract
  // IMPORTANT: Include contract in dependencies to update when contract changes
  const dynamicEditorProps = useMemo(() => {
    const node = editorProps?.node;
    if (!node || !contract) {
      return editorProps; // Fallback to passed editorProps
    }

    // Find the contract item corresponding to the active editor
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
            console.log('[REGEX] USER_INPUT - setRegex', { newValue: value });
            // Update the specific contract item using contractItem.type
            if (contractItem && contract) {
              const contractType = contractItem.type;
              const updatedContracts = contract.contracts.map((c: any) =>
                c.type === contractType ? { ...c, patterns: [value] } : c
              );
              const updatedContract = { ...contract, contracts: updatedContracts };
              handleContractChange(updatedContract);
            } else if (editorProps?.setRegex) {
              editorProps.setRegex(value);
            } else {
              console.error('[REGEX] ERROR - No way to save regex!');
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
    // Include contract in dependencies to update when contract changes
    // handleContractChange creates a new object, so this won't cause infinite loops
  }, [activeEditor, contract]);

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





