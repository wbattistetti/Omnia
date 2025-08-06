import React, { useEffect, useState, useRef } from 'react';
import { Calendar } from 'lucide-react';
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

  return (
    <div style={{ padding: '18px 0 12px 0', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontWeight: 600, fontSize: 18, color: '#fff', marginBottom: 6 }}>Creating...</div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <DataTypeLabel
          icon={detectTypeIcon === 'Calendar' ? <Calendar size={18} style={{ color: '#a21caf' }} /> : null}
          label={dataNode.name}
        />
      </div>
      
      {/* Progress Bar */}
      <div style={{ marginBottom: 16 }}>
        <ProgressBar 
          currentStep={currentStep}
          totalSteps={totalSteps}
          label="Building your dialogue template"
        />
      </div>
      
      {/* Current Step Description */}
      <div style={{ 
        marginBottom: 16, 
        padding: '8px 12px', 
        backgroundColor: 'rgba(255,255,255,0.1)', 
        borderRadius: '6px',
        color: '#e5e7eb',
        fontSize: 14
      }}>
        <strong>Current step:</strong> {currentDescription}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <StepLabel
          icon={<HourglassSpinner />}
          label={orchestrator.state.steps[orchestrator.state.currentStepIndex]?.label || ''}
        />
      </div>
      
      {/* Mostra preview JSON finale a fine pipeline */}
      {finalDDT && (
        <div style={{ marginTop: 24 }}>
          <h3>DDT JSON Preview</h3>
          <pre style={{ background: '#f3f3f3', padding: 12, borderRadius: 4, maxHeight: 400, overflow: 'auto', color: '#222' }}>{JSON.stringify(finalDDT, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default WizardPipelineStep;