import React, { useEffect, useState, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { useOrchestrator } from '../orchestrator/useOrchestrator';
import { buildDDT } from '../DDTAssembler/DDTBuilder';
import { buildSteps } from '../DDTAssembler/buildStepMessagesFromResults';
import { generateStepsSkipDetectType } from '../orchestrator/stepGenerator';
import DataTypeLabel from './DataTypeLabel';
import StepLabel from './StepLabel';
import HourglassSpinner from './HourglassSpinner';

interface DataNode {
  name: string;
  type?: string;
}

interface Props {
  dataNode: DataNode;
  detectTypeIcon: string | null;
  onCancel: () => void;
  onComplete?: (finalDDT: any) => void;
  skipDetectType?: boolean;
  confirmedLabel?: string; // <--- AGGIUNTA
}

const WizardPipelineStep: React.FC<Props> = ({ dataNode, detectTypeIcon, onCancel, onComplete, skipDetectType, confirmedLabel }) => {
  const orchestrator = useOrchestrator(dataNode, (data) => generateStepsSkipDetectType(data, !!skipDetectType));
  const [finalDDT, setFinalDDT] = useState<any>(null);
  const alreadyStartedRef = useRef(false);

  useEffect(() => {
    console.log('[WizardPipelineStep] MOUNT. skipDetectType:', skipDetectType);
    return () => {
      console.log('[WizardPipelineStep] UNMOUNT');
    };
  }, []);

  useEffect(() => {
    console.log('[WizardPipelineStep] RENDER', { dataNode });
  });

  // Resetta il ref anti-rilancio ogni volta che cambia dataNode
  useEffect(() => {
    alreadyStartedRef.current = false;
  }, [dataNode]);

  // Avvia pipeline ogni volta che cambia dataNode o currentStepIndex
  useEffect(() => {
    console.log('[WizardPipelineStep] Avvio pipeline su ogni step', orchestrator.state.currentStepIndex, dataNode);
    orchestrator.runNextStep();
  }, [dataNode, orchestrator.state.currentStepIndex]);

  // Avanza step quando debugModal si chiude
  useEffect(() => {
    if (orchestrator.debugModal) {
      setTimeout(() => {
        console.log('[WizardPipelineStep] closeDebugModalAndContinue', { dataNode });
        orchestrator.closeDebugModalAndContinue();
      }, 400);
    }
  }, [orchestrator.debugModal]);

  // Logga ogni avanzamento di step
  useEffect(() => {
    console.log('[WizardPipelineStep] currentStepIndex:', orchestrator.state.currentStepIndex, 'step:', orchestrator.state.steps[orchestrator.state.currentStepIndex]?.key);
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
      console.log('[WizardPipelineStep] stepMessages built for assembleMainData:', stepMessages);
      // Assembla il DDT finale passando solo stepResults (stepMessages è già usato internamente)
      const structureResult = stepResults.find(r => r.stepKey === 'suggestStructureAndConstraints');
      const mainData = structureResult?.payload?.mainData || structureResult?.payload;
      console.log('[WizardPipelineStep] RAW AI mainData:', JSON.stringify(mainData, null, 2));
      if (mainData && Array.isArray(mainData.subData)) {
        mainData.subData.forEach((sub: any, idx: number) => {
          console.log(`[WizardPipelineStep] RAW AI subData[${idx}]:`, JSON.stringify(sub, null, 2));
        });
      }
      const ddtId = mainData?.name || dataNode.name || 'ddt_' + (dataNode?.name || 'unknown');
      const final = buildDDT(ddtId, mainData, stepResults);
      setFinalDDT(final);
      console.log('[WizardPipelineStep] DDT finale generato', final);
      console.log('[WizardPipelineStep] DDT finale (JSON):\n' + JSON.stringify(final, null, 2));
      if (onComplete) onComplete(final);
    }
  }, [orchestrator.state.currentStepIndex, orchestrator.state.steps.length, orchestrator.state.stepResults, finalDDT, onComplete, confirmedLabel, dataNode]);

  return (
    <div style={{ padding: '18px 0 12px 0', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontWeight: 600, fontSize: 18, color: '#fff', marginBottom: 6 }}>Creating...</div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <DataTypeLabel
          icon={detectTypeIcon === 'Calendar' ? <Calendar size={18} style={{ color: '#a21caf' }} /> : null}
          label={dataNode.name}
        />
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