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

interface DataNode {
  name: string;
  type?: string;
  subData?: string[];
}

interface Props {
  dataNode: DataNode;
  detectTypeIcon: string | null;
  onCancel: () => void;
  onComplete?: (finalDDT: any) => void;
  skipDetectType?: boolean;
  confirmedLabel?: string;
}

const WizardPipelineStep: React.FC<Props> = ({ dataNode, detectTypeIcon, onCancel, onComplete, skipDetectType, confirmedLabel }) => {
  const orchestrator = useOrchestrator(dataNode, (data) => generateStepsSkipDetectType(data, !!skipDetectType));
  const [finalDDT, setFinalDDT] = useState<any>(null);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const alreadyStartedRef = useRef(false);

  // Calcola il numero totale di step quando il componente si monta
  useEffect(() => {
    const total = calculateTotalSteps(dataNode);
    setTotalSteps(total);
  }, [dataNode]);

  // Aggiorna lo step corrente quando cambia l'indice dello step nell'orchestrator
  useEffect(() => {
    setCurrentStep(orchestrator.state.currentStepIndex + 1);
  }, [orchestrator.state.currentStepIndex]);

  useEffect(() => {
    return () => {
    };
  }, []);

  useEffect(() => {
  });

  // Resetta il ref anti-rilancio ogni volta che cambia dataNode
  useEffect(() => {
    alreadyStartedRef.current = false;
  }, [dataNode]);

  // Avvia pipeline ogni volta che cambia dataNode o currentStepIndex
  useEffect(() => {
    orchestrator.runNextStep();
  }, [dataNode, orchestrator.state.currentStepIndex]);

  // Avanza step quando debugModal si chiude
  useEffect(() => {
    if (orchestrator.debugModal) {
      setTimeout(() => {
        orchestrator.closeDebugModalAndContinue();
      }, 400);
    }
  }, [orchestrator.debugModal]);

  // Logga ogni avanzamento di step
  useEffect(() => {
  }, [orchestrator.state.currentStepIndex]);

  // Quando pipeline finita, monta il DDT finale e chiama onComplete
  useEffect(() => {
    if (
      orchestrator.state.currentStepIndex >= orchestrator.state.steps.length &&
      !finalDDT
    ) {
      // Patch: crea uno stepResult finto detectType con la label AI confermata
      let stepResults = orchestrator.state.stepResults;
      if (confirmedLabel) {
        const fakeDetectType = { stepKey: 'detectType', payload: { label: confirmedLabel, type: confirmedLabel } };
        stepResults = [fakeDetectType, ...orchestrator.state.stepResults];
      }
      // Costruisci stepMessages con la nuova funzione
      const stepMessages = buildSteps(stepResults);
      // Assembla il DDT finale passando solo stepResults (stepMessages è già usato internamente)
      const structureResult = stepResults.find(r => r.stepKey === 'suggestStructureAndConstraints');
      const mainData = structureResult?.payload?.mainData || structureResult?.payload;
      if (mainData && Array.isArray(mainData.subData)) {
        mainData.subData.forEach((sub: any, idx: number) => {
        });
      }
      const ddtId = mainData?.name || dataNode.name || 'ddt_' + (dataNode?.name || 'unknown');
      const final = buildDDT(ddtId, mainData, stepResults);
      setFinalDDT(final);
      if (onComplete) onComplete(final);
    }
  }, [orchestrator.state.currentStepIndex, orchestrator.state.steps.length, orchestrator.state.stepResults, finalDDT, onComplete, confirmedLabel, dataNode]);

  const currentDescription = getStepDescription(currentStep, dataNode);
  const detectedType = orchestrator.state.detectedType;
  const mainData = orchestrator.state.mainData;
  const currentStepLabel = orchestrator.state.steps[orchestrator.state.currentStepIndex]?.label || '';

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
      <div style={{ fontWeight: 600, fontSize: 20, color: '#fff', marginBottom: 24, textAlign: 'left', paddingLeft: 4 }}>
        {`Creating "${mainData?.label || detectedType || 'data'}" data dialog:`}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#a21caf', fontWeight: 500, fontSize: 16, marginBottom: 8, paddingLeft: 4 }}>
        <Hourglass size={20} color="#a21caf" />
        <span>{currentStepLabel}</span>
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