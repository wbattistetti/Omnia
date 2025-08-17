import React, { useEffect, useState, useRef } from 'react';
import { Calendar, Hourglass } from 'lucide-react';
import { useOrchestrator } from '../orchestrator/useOrchestrator';
import { buildDDT } from '../DDTAssembler/DDTBuilder';
import { buildSteps } from '../DDTAssembler/buildStepMessagesFromResults';
import { generateStepsSkipDetectType } from '../orchestrator/stepGenerator';
import { calculateTotalSteps, getStepDescription } from '../utils/stepCalculator';
import DataTypeLabel from './DataTypeLabel';
import StepLabel from './StepLabel';
import HourglassSpinner from './HourglassSpinner';
import ProgressBar from '../../Common/ProgressBar';
import StructurePreviewModal from './StructurePreviewModal';

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
}

function normalizeStructure(node: any) {
  if (!node) return null;
  const out: any = { label: node.label || node.name || '', type: node.type };
  if (Array.isArray(node.subData) && node.subData.length > 0) {
    out.subData = node.subData.map((s: any) => normalizeStructure(s));
  }
  return out;
}

const WizardPipelineStep: React.FC<Props> = ({ dataNode, detectTypeIcon, onCancel, onComplete, skipDetectType, confirmedLabel }) => {
  const orchestrator = useOrchestrator(dataNode, (data) => generateStepsSkipDetectType(data, !!skipDetectType));
  const [finalDDT, setFinalDDT] = useState<any>(null);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const alreadyStartedRef = useRef(false);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [structurePreview, setStructurePreview] = useState<any>(null);

  useEffect(() => {
    const total = calculateTotalSteps(dataNode);
    setTotalSteps(total);
  }, [dataNode]);

  useEffect(() => {
    setCurrentStep(orchestrator.state.currentStepIndex + 1);
  }, [orchestrator.state.currentStepIndex]);

  useEffect(() => {
    return () => {
    };
  }, []);

  useEffect(() => {
  });

  useEffect(() => {
    alreadyStartedRef.current = false;
  }, [dataNode]);

  useEffect(() => {
    orchestrator.runNextStep();
  }, [dataNode, orchestrator.state.currentStepIndex]);

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
      const normalized = normalizeStructure(mainData);
      setStructurePreview(normalized);
      setShowStructureModal(true);
    }
  }, [orchestrator.state.stepResults, showStructureModal, finalDDT]);

  // When pipeline done, assemble
  useEffect(() => {
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
      const structureResult = stepResults.find(r => r.stepKey === 'suggestStructureAndConstraints');
      const mainData = structureResult?.payload?.mainData || structureResult?.payload;
      if (mainData && Array.isArray(mainData.subData)) {
        mainData.subData.forEach((sub: any, idx: number) => {
        });
      }
      const ddtId = mainData?.name || dataNode.name || 'ddt_' + (dataNode?.name || 'unknown');
      if (!mainData) {
        console.error('[Wizard] Missing mainData; cannot assemble DDT. stepResults=', stepResults);
        return;
      }
      const final = buildDDT(ddtId, mainData, stepResults);
      setFinalDDT(final);
      if (onComplete) onComplete(final);
    }
  }, [orchestrator.state.currentStepIndex, orchestrator.state.steps.length, orchestrator.state.stepResults, finalDDT, onComplete, confirmedLabel, dataNode]);

  const currentDescription = getStepDescription(currentStep, dataNode);
  const detectedType = orchestrator.state.detectedType;
  const mainData = orchestrator.state.mainData;
  const currentStepLabel = orchestrator.state.steps[orchestrator.state.currentStepIndex]?.label || '';

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
            transition: 'width 0.3s'
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