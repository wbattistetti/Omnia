import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import KindSelector from '@responseEditor/Config/KindSelector';
import ConfidenceInput from '@responseEditor/Config/ConfidenceInput';
import WaitingMessagesConfig from '@responseEditor/Config/WaitingMessagesConfig';
import TesterGrid from '@responseEditor/features/step-management/components/TesterGrid';
import { RowResult } from '@responseEditor/hooks/useExtractionTesting';
import { loadContractFromNode } from '@responseEditor/ContractSelector/contractHelpers';
import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';

// ✅ Helper: Get engines from contract (supports both engines and parsers for retrocompatibilità)
function getEngines(contract: DataContract | null): any[] {
  if (!contract) return [];
  return contract.engines || contract.parsers || [];
}
import DialogueTaskService from '@services/DialogueTaskService';
import { useProjectData } from '@context/ProjectDataContext';
import { useNotesStore } from '@responseEditor/features/step-management/stores/notesStore';
import { taskRepository } from '@services/TaskRepository';
import { ExamplesPersistenceService } from '@responseEditor/services/examplesPersistenceService';

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
  // ✅ FASE 2 - REMOVED: cellOverrides, setCellOverrides - now managed via Zustand store
  editingCell: { row: number; col: 'det' | 'ner' | 'llm'; key: string } | null;
  setEditingCell: React.Dispatch<React.SetStateAction<{ row: number; col: 'det' | 'ner' | 'llm'; key: string } | null>>;
  editingText: string;
  setEditingText: React.Dispatch<React.SetStateAction<string>>;
  // ✅ REMOVED: Notes props - now managed via Zustand store (stores/notesStore.ts)
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
    testPhrases?: string[];
    setTestPhrases?: (phrases: string[]) => void;
    onProfileUpdate?: (profile: any) => void;
    task?: any;
  };
  runAllRows?: () => Promise<void>;
  testing?: boolean;
  reportOpen?: boolean;
  setReportOpen?: (open: boolean) => void;
  baselineStats?: { matched: number; falseAccept: number; totalGt: number } | null;
  lastStats?: { matched: number; falseAccept: number; totalGt: number } | null;
  cancelTesting?: () => void; // ✅ Cancel function to abort running tests
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
  // ✅ FASE 2 - REMOVED: cellOverrides, setCellOverrides - now managed via Zustand store
  editingCell,
  setEditingCell,
  editingText,
  setEditingText,
  // ✅ REMOVED: Notes props - now managed via Zustand store
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
  cancelTesting,
}: RecognitionEditorProps) {
  // ✅ REMOVED: Notes are now managed via Zustand store

  const { currentProjectId } = useProjectData();
  const task = editorProps?.task;

  // Load contract from node
  const [localContract, setLocalContract] = useState<DataContract | null>(() => {
    const node = editorProps?.node;
    if (!node) return null;
    const contract = loadContractFromNode(node);
    return contract;
  });

  // ✅ Traccia modifiche non salvate (per verificare alla chiusura)
  const [hasUnsavedContractChanges, setHasUnsavedContractChanges] = useState(false);
  const [modifiedContract, setModifiedContract] = useState<DataContract | null>(null);

  // ✅ Ref per salvare contract originale (dal DB) per poterlo ripristinare
  const originalContractRef = React.useRef<DataContract | null>(null);

  // ✅ Carica contract SOLO quando cambi nodo (non quando riapri l'editor)
  // Il pattern regex viene ricaricato separatamente quando riapri l'editor regex
  const prevNodeIdRef = React.useRef<string | undefined>(editorProps?.node?.id);

  useEffect(() => {
    const node = editorProps?.node;
    const currentNodeId = node?.id;
    const nodeIdChanged = currentNodeId !== prevNodeIdRef.current;

    // ✅ Reload contract only when node changes
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
      // ✅ Support both engines (new) and parsers (old) for retrocompatibilità
      const engines = loadedContract?.engines || loadedContract?.parsers || [];
      const regexPattern = engines.find((c: any) => c.type === 'regex')?.patterns?.[0];

      // ✅ DEBUG: Log dettagliato del contract caricato
      console.log('[RecognitionEditor] 🔍 Contract loaded from node', {
        nodeId: node.id,
        templateId: node.templateId,
        hasContract: !!loadedContract,
        contractType: loadedContract ? typeof loadedContract : 'null',
        enginesArray: engines,
        enginesCount: engines.length,
        enginesTypes: engines.map((c: any) => c.type),
        contractKeys: loadedContract ? Object.keys(loadedContract) : [],
        templateName: loadedContract?.templateName,
        templateId: loadedContract?.templateId
      });

      // ✅ SALVA ORIGINALE (deep copy) per poterlo ripristinare se l'utente sceglie "Scarta"
      originalContractRef.current = loadedContract
        ? JSON.parse(JSON.stringify(loadedContract))
        : null;

      setLocalContract(loadedContract);

      // ✅ CRITICAL: Sincronizza contract.regex → node.nlpProfile.regex anche all'inizializzazione
      // Questo assicura che useProfileState legga la regex corretta dal contract
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
            regex: regexPattern ?? undefined
          };
          return updated;
        });
      }

      // ✅ Reset stato modifiche quando cambi nodo
      setHasUnsavedContractChanges(false);
      setModifiedContract(null);

      // ✅ Load test notes from node
      // ✅ NO FALLBACKS: node.testNotes can be undefined (legitimate default)
      const testNotes = node.testNotes ?? {};
      const notesStore = useNotesStore.getState();

      // ✅ Migrate old notes if needed
      const migratedNotes = examplesList.length > 0
        ? notesStore.migrateOldNotes(testNotes, examplesList)
        : testNotes;

      // ✅ Load notes into store
      notesStore.loadNotes(migratedNotes);

      console.log('[NOTES] INIT - Loaded notes from node', {
        nodeId: node.id,
        notesCount: Object.keys(migratedNotes).length,
        hasOldFormat: Object.keys(testNotes).some(k => /^\d+-/.test(k)),
        migratedCount: Object.keys(migratedNotes).length - Object.keys(testNotes).length
      });
    }
  }, [editorProps?.node?.id, updateSelectedNode, examplesList]);

  // ✅ Sync notes to node when they change
  const notes = useNotesStore((s) => s.notes);
  const notesStore = useNotesStore();

  // ✅ Load notes from node.testNotes when editor opens or node changes
  const prevNodeIdForNotesRef = React.useRef<string | undefined>(editorProps?.node?.id);
  useEffect(() => {
    const node = editorProps?.node;
    const currentNodeId = node?.id;
    const nodeIdChanged = currentNodeId !== prevNodeIdForNotesRef.current;

    // ✅ Solo aggiorna se il node è cambiato (evita loop infiniti)
    if (!nodeIdChanged && node) {
      return;
    }

    prevNodeIdForNotesRef.current = currentNodeId;

    if (!node) {
      notesStore.reset();
      return;
    }

    const nodeTestNotes = (node as any)?.testNotes;
    if (nodeTestNotes && typeof nodeTestNotes === 'object' && Object.keys(nodeTestNotes).length > 0) {
      // ✅ Migrate old notes if present
      // ✅ NO FALLBACKS: examplesList can be undefined (legitimate default)
      const examplesList = editorProps?.examplesList ?? [];
      const migratedNotes = notesStore.migrateOldNotes(nodeTestNotes, examplesList);

      // ✅ Load notes into store
      notesStore.loadNotes(migratedNotes);

      console.log('[NOTES] Loaded notes from node', {
        nodeId: node.id,
        notesCount: Object.keys(migratedNotes).length,
        examplesListCount: examplesList.length,
        sampleNotes: Object.keys(migratedNotes).slice(0, 3)
      });
    } else {
      // No notes in node, reset store (solo se nodeId è cambiato)
      if (nodeIdChanged) {
        notesStore.reset();
      }
    }
  }, [editorProps?.node?.id, editorProps?.examplesList]);

  // ✅ Save notes to node.testNotes when they change
  const prevNotesRef = React.useRef<Record<string, string>>({});
  useEffect(() => {
    const node = editorProps?.node;
    if (!node || !updateSelectedNode) return;

    // ✅ Solo salva se notes è cambiato (evita loop infiniti)
    const notesChanged = JSON.stringify(notes) !== JSON.stringify(prevNotesRef.current);
    if (!notesChanged) {
      return;
    }

    prevNotesRef.current = { ...notes };

    // ✅ Save notes to node.testNotes
    updateSelectedNode((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.testNotes = { ...notes };

      // ✅ CRITICAL: Aggiorna anche la cache del TaskRepository
      // ✅ NO FALLBACKS: Use id as primary, instanceId as fallback (both are valid properties)
      const taskId = editorProps?.task?.id ?? editorProps?.task?.instanceId ?? 'unknown';
      if (taskId) {
        try {
          const currentTask = taskRepository.getTask(taskId);
          // ✅ NUOVO MODELLO: Task non ha più .data[], usa TaskTree.nodes[] costruito runtime
          // Non serve più aggiornare cache con .data[] - il TaskTree viene ricostruito da template + instance
          console.log('[NOTES] Updated TaskRepository cache', {
            taskId,
            nodeIndex,
            notesCount: Object.keys(notes).length
          });
        } catch (error) {
          console.error('[NOTES] Error updating TaskRepository cache', error);
        }
      }

      return updated;
    }, false); // false = non notificare provider (solo sync locale)
  }, [notes, editorProps?.node?.id, updateSelectedNode, editorProps?.task?.id, editorProps?.task?.instanceId]);

  // ✅ Use centralized service for examplesList persistence
  // Single point of synchronization for examplesList across store and TaskRepository cache
  useEffect(() => {
    const node = editorProps?.node;
    if (!node || !updateSelectedNode) return;

    // ✅ NO FALLBACKS: Use id as primary, instanceId as fallback (both are valid properties)
    const taskId = editorProps?.task?.id ?? editorProps?.task?.instanceId ?? 'unknown';

    // Use centralized service - single point of synchronization
    ExamplesPersistenceService.setExamplesForNode(
      node.id,
      node.templateId,
      taskId,
      examplesList,
      updateSelectedNode
    );
  }, [examplesList, editorProps?.node?.id, editorProps?.node?.templateId, updateSelectedNode, editorProps?.task?.id, editorProps?.task?.instanceId]);

  // ✅ Usa direttamente localContract come contract (non serve creare nuovo oggetto)
  const contract = localContract;

  // ✅ DEBUG: Log contract quando cambia (per vedere cosa viene passato a TesterGrid)
  React.useEffect(() => {
    const engines = getEngines(contract);
    console.log('[RecognitionEditor] 🔍 Contract state changed', {
      hasContract: !!contract,
      contractType: contract ? typeof contract : 'null',
      enginesArray: engines,
      enginesCount: engines.length,
      enginesTypes: engines.map((c: any) => c?.type),
      contractKeys: contract ? Object.keys(contract) : [],
      templateName: contract?.templateName,
      templateId: contract?.templateId,
      nodeId: editorProps?.node?.id,
      nodeTemplateId: editorProps?.node?.templateId
    });
  }, [contract, editorProps?.node?.id, editorProps?.node?.templateId]);

  // ✅ Stato locale per regex (non salvato durante digitazione)
  const engines = getEngines(contract);
  const contractItem = activeEditor && contract ? engines.find((c: any) => {
    const getContractTypeFromEditorType = (editorType: string): string => {
      if (editorType === 'extractor') return 'rules';
      return editorType;
    };
    const expectedContractType = getContractTypeFromEditorType(activeEditor);
    return c.type === expectedContractType;
  }) : null;

  const officialRegexValue = contractItem?.patterns?.[0] ?? '';

  // ✅ Reload regex pattern from template when regex editor is reopened
  // More efficient: only reloads the regex pattern, not the entire contract
  const prevActiveEditorRef = React.useRef<string | null>(activeEditor);
  React.useEffect(() => {
    // Only reload when regex editor is opened (was closed, now opened)
    if (activeEditor === 'regex' && prevActiveEditorRef.current !== 'regex' && editorProps?.node?.templateId) {
      console.log('[RecognitionEditor] 🔄 Regex editor opened, reloading pattern', {
        templateId: editorProps.node.templateId,
        previousEditor: prevActiveEditorRef.current,
        currentEditor: activeEditor
      });

      const template = DialogueTaskService.getTemplate(editorProps.node.templateId);
      if (template?.dataContract) {
        const templateEngines = getEngines(template.dataContract);
        const regexEngine = templateEngines.find((c: any) => c.type === 'regex');
        const regexPattern = regexEngine?.patterns?.[0] || '';

        console.log('[RecognitionEditor] 📝 Found regex pattern in template', {
          hasEngine: !!regexEngine,
          pattern: regexPattern || '(empty)',
          enginesCount: templateEngines.length
        });

        // ✅ CRITICAL: Update local contract AND trigger prop update for RegexInlineEditor
        // The RegexInlineEditor receives regex via props, so we need to ensure it gets the latest value
        if (contract) {
          const currentEngines = getEngines(contract);
          const updatedEngines = [...currentEngines];
          const existingRegexIndex = updatedEngines.findIndex((c: any) => c.type === 'regex');

          if (existingRegexIndex >= 0) {
            // Update existing regex engine
            updatedEngines[existingRegexIndex] = { ...updatedEngines[existingRegexIndex], patterns: [regexPattern] };
          } else if (regexPattern) {
            // Add new regex engine if pattern exists
            updatedEngines.push({ type: 'regex', enabled: true, patterns: [regexPattern], examples: [] });
          }

          const updatedContract = { ...contract, engines: updatedEngines };
          // ✅ Rimuovi parsers se presente (migrazione)
          if (updatedContract.parsers) {
            delete updatedContract.parsers;
          }
          setLocalContract(updatedContract);

          console.log('[RecognitionEditor] ✅ Updated local contract with regex pattern', {
            templateId: editorProps.node.templateId,
            regexPattern: regexPattern || '(empty)',
            wasEmpty: !regexPattern,
            contractUpdated: true
          });
        } else {
          console.warn('[RecognitionEditor] ⚠️ Contract is null, cannot update regex pattern');
        }
      } else {
        console.warn('[RecognitionEditor] ⚠️ Template or dataContract not found', {
          templateId: editorProps.node.templateId,
          hasTemplate: !!template,
          hasDataContract: !!template?.dataContract
        });
      }
    }
    prevActiveEditorRef.current = activeEditor;
  }, [activeEditor, editorProps?.node?.templateId, contract]);

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
  const handleContractChange = useCallback((updatedContract: DataContract | null, skipAutoSave: boolean = false) => {
    console.log('[RecognitionEditor][handleContractChange] 🚀 START', {
      hasNode: !!editorProps?.node,
      nodeTemplateId: editorProps?.node?.templateId,
      skipAutoSave,
      updatedContractRegex: getEngines(updatedContract).find((c: any) => c.type === 'regex')?.patterns?.[0],
    });

    const node = editorProps?.node;
    if (!node || !node.templateId) {
      console.warn('[RecognitionEditor][handleContractChange] ❌ No node or templateId available');
      return;
    }

    const nodeTemplateId = node.templateId;
    const updatedEngines = getEngines(updatedContract);
    const regexPattern = updatedEngines.find((c: any) => c.type === 'regex')?.patterns?.[0];
    console.log('[RecognitionEditor][handleContractChange] 📊 Regex pattern extracted:', regexPattern);

    // ✅ Confronta con template
    const changed = hasContractChanged(nodeTemplateId, updatedContract);
    console.log('[RecognitionEditor][handleContractChange] 📊 Contract changed:', changed);

    if (changed) {
      // ✅ AGGIORNA TEMPLATE IN MEMORIA (così quando riapri vedi le modifiche)
      const template = DialogueTaskService.getTemplate(nodeTemplateId);
      console.log('[RecognitionEditor][handleContractChange] 📝 Template found:', !!template);
      if (template) {
        template.dataContract = updatedContract
          ? JSON.parse(JSON.stringify(updatedContract))
          : null;
        console.log('[RecognitionEditor][handleContractChange] ✅ Template dataContract updated:', {
          hasContract: !!template.dataContract,
          regexInContract: getEngines(template.dataContract).find((c: any) => c.type === 'regex')?.patterns?.[0],
        });
        // ✅ Marca template come modificato per salvataggio futuro
        DialogueTaskService.markTemplateAsModified(nodeTemplateId);
        console.log('[RecognitionEditor][handleContractChange] ✅ Template marked as modified');
      }

      // ✅ Contract modificato: traccia ma NON mostra dialog
      setHasUnsavedContractChanges(true);
      setModifiedContract(updatedContract);
      setLocalContract(updatedContract); // ✅ Aggiorna UI immediatamente

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
            regex: regexPattern ?? undefined
          };
          return updated;
        }, { skipAutoSave }); // ✅ Pass skipAutoSave to control persistence
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
      }
    } else {
      // ✅ Nessun cambiamento: usa template
      const template = DialogueTaskService.getTemplate(nodeTemplateId);
      // ✅ NO FALLBACKS: template.dataContract can be null/undefined (legitimate)
      setLocalContract(template?.dataContract ?? null);
      setHasUnsavedContractChanges(false);
      setModifiedContract(null);

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
  }, [editorProps?.node, hasContractChanged, contractChangeRef, updateSelectedNode]);

  // ✅ FASE 3: Rimuoviamo handleSaveRegex - non serve più
  // ✅ L'editor non salva più direttamente, solo commit alla chiusura

  // ✅ Esponi funzione per verificare modifiche non salvate
  React.useImperativeHandle(contractChangeRef, () => {
    return {
      hasUnsavedChanges: hasUnsavedContractChanges,
      modifiedContract,
      originalContract: originalContractRef.current, // ✅ Esponi originale per poterlo ripristinare
      nodeTemplateId: editorProps?.node?.templateId,
      nodeLabel: editorProps?.node?.label
    };
  }, [hasUnsavedContractChanges, modifiedContract, editorProps?.node]);

  // ✅ CRITICAL: Create stable handleRegexSave callback that doesn't depend on activeEditor
  // This ensures onRegexSave is always available even when editor is closing
  const handleRegexSave = useCallback((newRegex: string) => {
    console.log('[RecognitionEditor] 💾 handleRegexSave called with regex:', newRegex);
    console.log('[RecognitionEditor] Current contract:', contract);
    if (!contract) {
      console.warn('[RecognitionEditor] ⚠️ No contract available, cannot save regex');
      return;
    }
    const currentEngines = getEngines(contract);
    const regexEngine = currentEngines.find((c: any) => c.type === 'regex');
    if (regexEngine) {
      console.log('[RecognitionEditor] 📝 Updating existing regex engine');
      const updatedEngines = currentEngines.map((c: any) =>
        c.type === 'regex' ? { ...c, patterns: [newRegex] } : c
      );
      const updatedContract = { ...contract, engines: updatedEngines };
      // ✅ Rimuovi parsers se presente (migrazione)
      if (updatedContract.parsers) {
        delete updatedContract.parsers;
      }
      console.log('[RecognitionEditor] 📝 Updated contract:', updatedContract);
      handleContractChange(updatedContract, false);
    } else {
      console.log('[RecognitionEditor] 📝 Creating new regex engine');
      const newEngines = [...currentEngines, {
        type: 'regex',
        enabled: true,
        patterns: [newRegex],
        examples: []
      }];
      const updatedContract = { ...contract, engines: newEngines };
      // ✅ Rimuovi parsers se presente (migrazione)
      if (updatedContract.parsers) {
        delete updatedContract.parsers;
      }
      console.log('[RecognitionEditor] 📝 New contract:', updatedContract);
      handleContractChange(updatedContract, false);
    }
    console.log('[RecognitionEditor] ✅ handleContractChange called');
  }, [contract, handleContractChange]); // ✅ Stable: depends only on contract and handleContractChange, NOT on activeEditor

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

    // ✅ Ricalcola contractItem per altri editor (per regex usa quello calcolato sopra)
    const contractEngines = getEngines(contract);
    const contractItemForEditor = activeEditor && contract ? contractEngines.find((c: any) => {
      const expectedContractType = getContractTypeFromEditorType(activeEditor);
      return c.type === expectedContractType;
    }) : null;

    const baseProps = {
      node,
      kind: editorProps?.kind,
      profile: editorProps?.profile,
      testPhrases: editorProps?.testPhrases,
      setTestPhrases: editorProps?.setTestPhrases,
      onProfileUpdate: editorProps?.onProfileUpdate,
      task: editorProps?.task,
      // ✅ NEW: Feedback from test notes
      examplesList,
      rowResults,
      // ✅ REMOVED: getNote prop - now managed via Zustand store
      // ✅ CRITICAL: Always pass onRegexSave so it's available even when editor is closing
      onRegexSave: handleRegexSave,
    };

    switch (activeEditor) {
      case 'regex':
        return {
          ...baseProps,
          regex: officialRegexValue,
          // ✅ onRegexSave already in baseProps, no need to duplicate
        };
      case 'extractor':
        // ExtractorInlineEditor gestisce extractorCode internamente, ma potremmo sincronizzarlo
        return {
          ...baseProps,
          extractorCode: contractItemForEditor?.extractorCode ?? '',
          setExtractorCode: (value: string) => {
            if (contractItemForEditor && contract) {
              const contractType = contractItemForEditor.type; // Should be 'rules'
              const currentEngines = getEngines(contract);
              const updatedEngines = currentEngines.map((c: any) =>
                c.type === contractType ? { ...c, extractorCode: value } : c
              );
              const updatedContract = { ...contract, engines: updatedEngines };
              // ✅ Rimuovi parsers se presente (migrazione)
              if (updatedContract.parsers) {
                delete updatedContract.parsers;
              }
              handleContractChange(updatedContract, false); // ✅ Salva esplicitamente
            }
          },
        };
      case 'ner':
        return {
          ...baseProps,
          entityTypes: contractItemForEditor?.entityTypes ?? [],
          setEntityTypes: (value: string[]) => {
            if (contractItemForEditor && contract) {
              const contractType = contractItemForEditor.type;
              const currentEngines = getEngines(contract);
              const updatedEngines = currentEngines.map((c: any) =>
                c.type === contractType ? { ...c, entityTypes: value } : c
              );
              const updatedContract = { ...contract, engines: updatedEngines };
              // ✅ Rimuovi parsers se presente (migrazione)
              if (updatedContract.parsers) {
                delete updatedContract.parsers;
              }
              handleContractChange(updatedContract, false); // ✅ Salva esplicitamente
            }
          },
        };
      case 'llm':
        return {
          ...baseProps,
          systemPrompt: contractItemForEditor?.systemPrompt || '',
          setSystemPrompt: (value: string) => {
            if (contractItemForEditor && contract) {
              const contractType = contractItemForEditor.type;
              const currentEngines = getEngines(contract);
              const updatedEngines = currentEngines.map((c: any) =>
                c.type === contractType ? { ...c, systemPrompt: value } : c
              );
              const updatedContract = { ...contract, engines: updatedEngines };
              // ✅ Rimuovi parsers se presente (migrazione)
              if (updatedContract.parsers) {
                delete updatedContract.parsers;
              }
              handleContractChange(updatedContract, false); // ✅ Salva esplicitamente
            }
          },
        };
      default:
        return editorProps || baseProps;
    }
    // Include contract in dependencies to update when contract changes
    // handleContractChange creates a new object, so this won't cause infinite loops
  }, [activeEditor, contract, handleRegexSave, officialRegexValue, editorProps, examplesList, rowResults]);

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
          // ✅ FASE 2 - REMOVED: cellOverrides, setCellOverrides - now managed via Zustand store
          editingCell={editingCell}
          setEditingCell={setEditingCell}
          editingText={editingText}
          setEditingText={setEditingText}
          // ✅ REMOVED: Notes props - now managed via Zustand store
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
          cancelTesting={cancelTesting}
        />
      </div>
    </div>
  );
}





