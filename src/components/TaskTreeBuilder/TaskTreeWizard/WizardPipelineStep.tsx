import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Calendar, Hourglass } from 'lucide-react';
import { useOrchestrator } from '../orchestrator/useOrchestrator';
import { buildDDT } from '../DDTAssembler/DDTBuilder';
import { buildSteps } from '../DDTAssembler/buildStepMessagesFromResults';
import { generateStepsSkipDetectType } from '../orchestrator/stepGenerator';
import { calculateTotalSteps, getStepDescription } from '../utils/stepCalculator';
import { taskCounter } from '../../../utils/TaskCounter';
import DataTypeLabel from './DataTypeLabel';
import StepLabel from './StepLabel';
import HourglassSpinner from './HourglassSpinner';
import ProgressBar from '../../Common/ProgressBar';
import StructurePreviewModal from './StructurePreviewModal';
import { useAIProvider } from '../../../context/AIProviderContext';

const __DEBUG_TASKTREE_UI__ = true; // 🚀 ENABLED for debugging
const dlog = (...a: any[]) => { if (__DEBUG_TASKTREE_UI__) console.log(...a); };

interface DataNode {
  name: string;
  type?: string;
  subData?: any[];
}

interface Props {
  dataNode: DataNode;
  detectTypeIcon: string | null;
  onCancel: () => void;
  onComplete?: (finalTaskTree: any) => void;
  skipDetectType?: boolean;
  confirmedLabel?: string;
  contextLabel: string; // ✅ Context label for prompt generation (e.g., "Chiedi la data di nascita del paziente") - REQUIRED
  onProgress?: (percentByPath: Record<string, number>) => void; // optional progress reporter
  headless?: boolean; // if true, orchestrate without rendering UI
  setFieldProcessingStates?: (updater: (prev: any) => any) => void;
  progressByPath?: Record<string, number>;
}

function normalizeStructure(node: any) {
  if (!node) return null;
  const out: any = { label: node.label || node.name || '', type: node.type };
  if (Array.isArray(node.subData) && node.subData.length > 0) {
    out.subData = node.subData.map((s: any) => normalizeStructure(s));
  }
  return out;
}

const WizardPipelineStep: React.FC<Props> = ({ dataNode, detectTypeIcon, onCancel, onComplete, skipDetectType, confirmedLabel, contextLabel, onProgress, headless, setFieldProcessingStates, progressByPath }) => {
  const { provider: selectedProvider } = useAIProvider();
  const orchestrator = useOrchestrator(dataNode, (data) => generateStepsSkipDetectType(data, !!skipDetectType, selectedProvider, contextLabel), headless);
  const [finalTaskTree, setFinalTaskTree] = useState<any>(null);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const alreadyStartedRef = useRef(false);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [structurePreview, setStructurePreview] = useState<any>(null);
  const hadErrorRef = useRef(false);

  // ✅ SOLUZIONE PULITA: Stabilizza dataNode con useMemo basato sui valori primitivi
  // Questo evita re-render quando dataNode cambia riferimento ma i valori sono identici
  const stableDataNode = useMemo(() => {
    return {
      name: dataNode?.name || '',
      label: dataNode?.label || '',
      type: dataNode?.type,
      icon: dataNode?.icon,
      subData: dataNode?.subData || [],
      // Preserva eventuali altre proprietà necessarie
      variable: dataNode?.variable,
      constraints: dataNode?.constraints,
      nlpContract: dataNode?.nlpContract,
      templateId: dataNode?.templateId,
      kind: dataNode?.kind
    };
  }, [
    dataNode?.name,
    dataNode?.label,
    dataNode?.type,
    dataNode?.icon,
    // ✅ Usa JSON.stringify per subData per confronto profondo (o usa una libreria di deep equal)
    JSON.stringify(dataNode?.subData || []),
    dataNode?.variable,
    JSON.stringify(dataNode?.constraints),
    dataNode?.nlpContract,
    dataNode?.templateId,
    dataNode?.kind
  ]);

  useEffect(() => {
    const total = calculateTotalSteps(stableDataNode);
    setTotalSteps(total);
  }, [stableDataNode]);

  // ✅ Rimossi log di mount/unmount non necessari
  // useEffect(() => {
  //   dlog('[DDT][UI][Pipeline][mount]', { headless, initialTotal: calculateTotalSteps(stableDataNode) });
  //   return () => dlog('[DDT][UI][Pipeline][unmount]');
  // }, []);

  useEffect(() => {
    setCurrentStep(orchestrator.state.currentStepIndex + 1);
  }, [orchestrator.state.currentStepIndex]);

  // Freeze advancement on first error
  useEffect(() => {
    if (orchestrator.state.stepError) {
      hadErrorRef.current = true;
    }
  }, [orchestrator.state.stepError]);

  // 🚀 NEW: Update fieldProcessingStates when error occurs
  useEffect(() => {
    if (orchestrator.state.stepError && orchestrator.state.lastError && setFieldProcessingStates) {
      const error = orchestrator.state.lastError;
      const stepInfo = (error as any).stepInfo;
      if (stepInfo) {
        const mainLabel = (confirmedLabel || stableDataNode.name || stableDataNode.label || '').trim();
        const sub = stepInfo.subDataInfo;
        const subLabel = sub ? (sub.label || sub.name || '') : undefined;
        const fieldId = subLabel ? `${mainLabel}/${subLabel}` : mainLabel;

        setFieldProcessingStates((prev: any) => ({
          ...prev,
          [fieldId]: {
            fieldId,
            status: 'error',
            progress: progressByPath?.[fieldId] || 0,
            message: `Errore generazione messaggi: ${error.message || 'Unknown error'}`,
            timestamp: new Date(),
            retryCount: prev[fieldId]?.retryCount || 0 // Initialize or preserve retryCount
          }
        }));
      }
    }
  }, [orchestrator.state.stepError, orchestrator.state.lastError, confirmedLabel, stableDataNode, setFieldProcessingStates, progressByPath]);


  useEffect(() => {
    alreadyStartedRef.current = false;
  }, [stableDataNode]);

  // ✅ FIX: Avvia pipeline solo al mount iniziale (una volta sola)
  const mountTriggeredRef = useRef(false);
  useEffect(() => {
    if (mountTriggeredRef.current) return;
    if (hadErrorRef.current) return;

    const { currentStepIndex, stepError, stepLoading, stepResults } = orchestrator.state;

    // ✅ Solo al mount iniziale: currentStepIndex === 0 e nessun risultato
    if (currentStepIndex === 0 && stepResults.length === 0 && !stepError && !stepLoading) {
      mountTriggeredRef.current = true;
      alreadyStartedRef.current = true;
      orchestrator.runNextStep().finally(() => { alreadyStartedRef.current = false; });
    }
  }, []); // ✅ Solo al mount

  // ✅ Gestisci avanzamento step quando currentStepIndex cambia (dopo il mount)
  useEffect(() => {
    if (hadErrorRef.current) return;
    if (alreadyStartedRef.current) return;
    if (!mountTriggeredRef.current) return; // ✅ Non partire finché non è stato fatto il mount

    const { currentStepIndex, stepError, stepLoading, stepResults } = orchestrator.state;

    // ✅ Solo per step successivi (currentStepIndex > 0), dopo che il mount è stato fatto
    if (currentStepIndex > 0 && !stepError && !stepLoading && stepResults.length > 0) {
      alreadyStartedRef.current = true;
      orchestrator.runNextStep().finally(() => { alreadyStartedRef.current = false; });
    }
  }, [orchestrator.state.currentStepIndex, orchestrator.state.stepError, orchestrator.state.stepLoading]);

  useEffect(() => {
    if (orchestrator.debugModal) {
      setTimeout(() => {
        orchestrator.closeDebugModalAndContinue();
      }, 400);
    }
  }, [orchestrator.debugModal]);

  // Phase 1: show structure preview when we have structure (result of suggestStructureAndConstraints)
  useEffect(() => {
    const structureResult = orchestrator.state.stepResults.find(r => r.stepKey === 'suggestStructureAndConstraints');
    const data = structureResult?.payload?.data || structureResult?.payload;
    if (data && !showStructureModal && !finalTaskTree) {
      const normalized = normalizeStructure(data);
      setStructurePreview(normalized);
      setShowStructureModal(true);
    }
  }, [orchestrator.state.stepResults, showStructureModal, finalTaskTree]);

  // When pipeline done, assemble
  useEffect(() => {
    // Allow completion even with errors - user can complete manually in editor
    // if (hadErrorRef.current) return; // don't complete if any step failed

    if (
      orchestrator.state.currentStepIndex >= orchestrator.state.steps.length &&
      !finalTaskTree
    ) {
      let stepResults = orchestrator.state.stepResults;
      if (confirmedLabel) {
        const fakeDetectType = { stepKey: 'detectType', payload: { label: confirmedLabel, type: confirmedLabel } };
        stepResults = [fakeDetectType, ...orchestrator.state.stepResults];
      }
      const stepMessages = buildSteps(stepResults);

      // ✅ SOLUZIONE PULITA: Usa stableDataNode che è memoizzato solo quando i valori cambiano
      const taskTreeId = stableDataNode.label || stableDataNode.name || 'tasktree_unknown';

      try {
        // ✅ Pass stableDataNode - ha tutte le proprietà necessarie e riferimento stabile
        const final = buildDDT(taskTreeId, stableDataNode, stepResults);
        setFinalTaskTree(final);
        if (onComplete) {
          onComplete(final);
        }
      } catch (err) {
        console.error('[WizardPipelineStep][buildTaskTree] Assembly FAILED', err);
        throw err;
      }
    }
  }, [
    orchestrator.state.currentStepIndex,
    orchestrator.state.steps.length,
    orchestrator.state.stepResults,
    finalTaskTree,
    onComplete,
    confirmedLabel,
    stableDataNode // ✅ Ora è stabile e non causa loop
  ]);

  const currentDescription = getStepDescription(currentStep, dataNode);
  const detectedType = orchestrator.state.detectedType;
  const data = orchestrator.state.data;
  const currentStepLabel = orchestrator.state.steps[orchestrator.state.currentStepIndex]?.label || '';

  // 🚀 NEW: TaskCounter-based progress calculation
  useEffect(() => {
    if (!onProgress) return;
    if (hadErrorRef.current) return; // stop emitting progress after an error

    const MESSAGE_TYPES = new Set(['startPrompt', 'noMatchPrompts', 'noInputPrompts', 'confirmationPrompts', 'successPrompts']);
    const steps = orchestrator.state.steps || [];
    const idx = orchestrator.state.currentStepIndex || 0;
    const mainLabel = (confirmedLabel || dataNode.name || '').trim();
    const subList: Array<string> = Array.isArray(dataNode.subData)
      ? dataNode.subData.map((s: any) => String(s?.label || s?.name || '')).filter(Boolean)
      : [];

    // 🚀 PREVENT INFINITE LOOP: Only process if we have new steps
    if (idx === 0) return; // Don't process if no steps completed yet

    // 🎯 Inizializza TaskCounter per questo main data
    if (!taskCounter.getFieldTasks(mainLabel).startPrompt) {
      taskCounter.initializeField(mainLabel, 'data');
    }

    // Inizializza sub data
    subList.forEach(subLabel => {
      const subFieldId = `${mainLabel}/${subLabel}`;
      if (!taskCounter.getFieldTasks(subFieldId).startPrompt) {
        taskCounter.initializeField(subFieldId, 'subTasks'); // ✅ Fixed: use 'subTasks' instead of 'subData'
      }
    });

    // 🎯 Processa i task completati
    for (let i = 0; i < idx; i++) {
      const st: any = steps[i];
      if (!st || !MESSAGE_TYPES.has(st.type)) continue;

      const sub = (st as any)?.subDataInfo;
      const subLabel = String(sub?.label || sub?.name || '') || undefined;
      const fieldId = subLabel ? `${mainLabel}/${subLabel}` : mainLabel;

      // 🎯 Task name è esattamente il tipo di step (startPrompt, noInputPrompts, etc.)
      taskCounter.completeTask(fieldId, st.type);
    }

    // 🎯 Calcola progress ricorsivo
    const dataArray = [{
      label: mainLabel,
      subData: subList.map(s => ({ label: s }))
    }];

    const progressMap = taskCounter.calculateRecursiveProgress(dataArray);

    onProgress(progressMap);
  }, [orchestrator.state.currentStepIndex, orchestrator.state.steps, dataNode, confirmedLabel, onProgress]);

  // Headless mode: run orchestration but don't render visual UI
  if (headless) { return null; }

  const handleCopyStructure = () => {
    if (!structurePreview) return;
    navigator.clipboard.writeText(JSON.stringify(structurePreview, null, 2));
  };

  return (
    <div
      style={{
        borderRadius: 16,
        border: '2px solid #a21caf',
        background: '#181f3a',
        padding: 28,
        maxWidth: 400,
        margin: '18px auto',
        boxShadow: '0 2px 12px rgba(162,28,175,0.08)'
      }}
    >
      <StructurePreviewModal
        open={showStructureModal}
        title="Structure preview (no constraints)"
        data={structurePreview}
        onCopy={handleCopyStructure}
        onClose={() => setShowStructureModal(false)}
      />

      <div style={{ fontWeight: 600, fontSize: 20, color: '#fff', marginBottom: 12, textAlign: 'left', paddingLeft: 4 }}>
        {`Creating "${data?.label || detectedType || 'data'}" data dialog:`}
      </div>
      {/* Friendly message during message creation */}
      <div style={{ fontSize: '16px', color: '#94a3b8', marginBottom: 12, textAlign: 'left', paddingLeft: 4, fontStyle: 'italic' }}>
        Sto creando i messaggi necessari, solo un momento...
      </div>
      {/* Blue processing label */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#0ea5e9', background: '#0ea5e933', border: '1px solid #0ea5e9', borderRadius: 8, padding: '6px 10px', marginBottom: 10, marginLeft: 4 }}>
        <Hourglass size={18} color="#0ea5e9" />
        <span style={{ fontWeight: 600 }}>{currentStepLabel}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 0 }}>
        <div style={{
          width: '100%',
          maxWidth: 320,
          minWidth: 180,
          margin: '0 16px',
          height: 16,
          background: '#222b4a',
          borderRadius: 8,
          position: 'relative',
          overflow: 'hidden',
          border: '2px solid #a21caf',
        }}>
          <div style={{
            width: `${totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0}%`,
            height: '100%',
            background: '#a21caf',
            borderRadius: 8,
            transition: 'width 0.8s ease'
          }} />
          <span style={{
            position: 'absolute',
            left: 0, right: 0, top: 0, bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13
          }}>
            {currentStep} / {totalSteps}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
        <button
          onClick={onCancel}
          style={{
            background: 'none',
            color: '#a21caf',
            border: '1.5px solid #a21caf',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
            padding: '7px 28px',
          }}
        >
          Annulla
        </button>
      </div>
    </div>
  );
};

export default WizardPipelineStep;