import React, { useEffect, useState, useRef } from 'react';
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

const __DEBUG_DDT_UI__ = true; // 🚀 ENABLED for debugging
const dlog = (...a: any[]) => { if (__DEBUG_DDT_UI__) console.log(...a); };

interface DataNode {
  name: string;
  type?: string;
  subData?: any[];
}

interface Props {
  dataNode: DataNode;
  detectTypeIcon: string | null;
  onCancel: () => void;
  onComplete?: (finalDDT: any) => void;
  skipDetectType?: boolean;
  confirmedLabel?: string;
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

const WizardPipelineStep: React.FC<Props> = ({ dataNode, detectTypeIcon, onCancel, onComplete, skipDetectType, confirmedLabel, onProgress, headless, setFieldProcessingStates, progressByPath }) => {
  const { provider: selectedProvider } = useAIProvider();
  const orchestrator = useOrchestrator(dataNode, (data) => generateStepsSkipDetectType(data, !!skipDetectType, selectedProvider), headless);
  const [finalDDT, setFinalDDT] = useState<any>(null);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const alreadyStartedRef = useRef(false);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [structurePreview, setStructurePreview] = useState<any>(null);
  const hadErrorRef = useRef(false);

  useEffect(() => {
    const total = calculateTotalSteps(dataNode);
    setTotalSteps(total);
  }, [dataNode]);

  useEffect(() => {
    dlog('[DDT][UI][Pipeline][mount]', { headless, initialTotal: calculateTotalSteps(dataNode) });
    return () => dlog('[DDT][UI][Pipeline][unmount]');
  }, []);

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
        const mainLabel = (confirmedLabel || dataNode.name || dataNode.label || '').trim();
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

        console.log('[WizardPipelineStep] Error captured for field:', fieldId, error.message);
      }
    }
  }, [orchestrator.state.stepError, orchestrator.state.lastError, confirmedLabel, dataNode, setFieldProcessingStates, progressByPath]);

  useEffect(() => {
    return () => {
    };
  }, []);

  useEffect(() => {
  });

  useEffect(() => {
    alreadyStartedRef.current = false;
  }, [dataNode]);

  // ✅ FIX: Avvia pipeline solo al mount iniziale (una volta sola)
  const mountTriggeredRef = useRef(false);
  useEffect(() => {
    if (mountTriggeredRef.current) return;
    if (hadErrorRef.current) return;

    const { currentStepIndex, stepError, stepLoading, stepResults } = orchestrator.state;

    // ✅ Solo al mount iniziale: currentStepIndex === 0 e nessun risultato
    if (currentStepIndex === 0 && stepResults.length === 0 && !stepError && !stepLoading) {
      console.log('🟢 [PIPELINE] Auto-starting pipeline (mount)');
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
      console.log('🟢 [PIPELINE] Continuing to step', currentStepIndex);
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
    const mainData = structureResult?.payload?.mainData || structureResult?.payload;
    if (mainData && !showStructureModal && !finalDDT) {
      dlog('[DDT][UI][Pipeline] showStructureModal → open');
      const normalized = normalizeStructure(mainData);
      setStructurePreview(normalized);
      setShowStructureModal(true);
    }
  }, [orchestrator.state.stepResults, showStructureModal, finalDDT]);

  // When pipeline done, assemble
  useEffect(() => {
    // Allow completion even with errors - user can complete manually in editor
    // if (hadErrorRef.current) return; // don't complete if any step failed

    if (
      orchestrator.state.currentStepIndex >= orchestrator.state.steps.length &&
      !finalDDT
    ) {
      let stepResults = orchestrator.state.stepResults;
      if (confirmedLabel) {
        const fakeDetectType = { stepKey: 'detectType', payload: { label: confirmedLabel, type: confirmedLabel } };
        stepResults = [fakeDetectType, ...orchestrator.state.stepResults];
      }
      const stepMessages = buildSteps(stepResults);

      // ✅ FIX: Use dataNode prop directly - it already has name, label, icon, subData from DDTWizard
      // The structureResult.payload only has subData, losing name/label/icon!
      const ddtId = dataNode.label || dataNode.name || 'ddt_unknown';

      try {
        // ✅ Pass dataNode directly - it has all the correct properties (name, label, icon, type, subData)!
        const final = buildDDT(ddtId, dataNode, stepResults);
        setFinalDDT(final);
        if (onComplete) {
          onComplete(final);
        }
      } catch (err) {
        console.error('[WizardPipelineStep][buildDDT] Assembly FAILED', err);
        throw err;
      }
    }
  }, [orchestrator.state.currentStepIndex, orchestrator.state.steps.length, orchestrator.state.stepResults, finalDDT, onComplete, confirmedLabel, dataNode]);

  const currentDescription = getStepDescription(currentStep, dataNode);
  const detectedType = orchestrator.state.detectedType;
  const mainData = orchestrator.state.mainData;
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
      taskCounter.initializeField(mainLabel, 'mainData');
    }

    // Inizializza sub data
    subList.forEach(subLabel => {
      const subFieldId = `${mainLabel}/${subLabel}`;
      if (!taskCounter.getFieldTasks(subFieldId).startPrompt) {
        taskCounter.initializeField(subFieldId, 'subData');
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
    const mainDataArray = [{
      label: mainLabel,
      subData: subList.map(s => ({ label: s }))
    }];

    const progressMap = taskCounter.calculateRecursiveProgress(mainDataArray);

    onProgress(progressMap);
    dlog('[DDT][UI][Pipeline][TaskCounter]', { idx, progressMap, currentStepLabel });
  }, [orchestrator.state.currentStepIndex, orchestrator.state.steps, dataNode, confirmedLabel]);

  // Headless mode: run orchestration but don't render visual UI
  if (headless) { dlog('[DDT][UI][Pipeline] headless=true → UI hidden'); return null; }

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
        {`Creating "${mainData?.label || detectedType || 'data'}" data dialog:`}
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