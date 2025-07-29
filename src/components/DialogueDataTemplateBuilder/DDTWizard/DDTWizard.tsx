import React, { useState, useEffect, useRef, useMemo } from 'react';
import WizardInputStep from './WizardInputStep';
import WizardLoadingStep from './WizardLoadingStep';
import WizardConfirmTypeStep from './WizardConfirmTypeStep';
import WizardPipelineStep from './WizardPipelineStep';
import WizardErrorStep from './WizardErrorStep';
import WizardSupportModal from './WizardSupportModal';

// Tipo per dataNode
interface DataNode {
  name: string;
}

const DDTWizard: React.FC<{ onCancel: () => void; onComplete?: (newDDT: any, messages?: any) => void }> = ({ onCancel, onComplete }) => {
  const [step, setStep] = useState<string>('input');
  const [userDesc, setUserDesc] = useState('');
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [detectTypeIcon, setDetectTypeIcon] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dataNode, setDataNode] = useState<DataNode | null>(null);
  const [closed, setClosed] = useState(false);
  const dataNodeSet = useRef(false);

  // Memo per dataNode stabile
  const stableDataNode = useMemo(() => dataNode, [dataNode]);

  useEffect(() => {
    console.log('[DDTWizard] MOUNT');
    return () => {
      console.log('[DDTWizard] UNMOUNT');
    };
  }, []);

  useEffect(() => {
    console.log('[DDTWizard] step:', step);
    if (step === 'pipeline') {
      console.log('[DDTWizard] PIPELINE PARTITA con dataNode:', dataNode);
    }
  }, [step]);

  useEffect(() => {
    console.log('[DDTWizard] dataNode changed:', dataNode);
  }, [dataNode]);

  // Funzione per chiamare la detection AI
  const handleDetectType = async () => {
    if (step === 'pipeline' || closed) return; // Blocca ogni setState durante la pipeline
    setStep('loading');
    setErrorMsg(null);
    try {
      const res = await fetch('/step2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userDesc.trim()),
      });
      if (!res.ok) throw new Error('Errore comunicazione IA');
      const result = await res.json();
      const ai = result.ai || result;
      setDetectedType(ai.type || '');
      setDetectTypeIcon(ai.icon || null);
      setStep('confirm');
    } catch (err: any) {
      setErrorMsg('Errore IA: ' + (err.message || ''));
      setStep('error');
    }
  };

  // Quando confermi il tipo, crea dataNode UNA SOLA VOLTA
  const handleConfirmType = () => {
    if (step === 'pipeline' || closed) return; // Blocca ogni setState durante la pipeline
    console.log('[DDTWizard] handleConfirmType', { detectedType });
    if (detectedType && !dataNodeSet.current) {
      setDataNode({ name: detectedType });
      dataNodeSet.current = true;
      console.log('[DDTWizard] setDataNode chiamato', { name: detectedType });
      console.log('[DDTWizard] Passo a pipeline con dataNode:', { name: detectedType });
      setStep('pipeline');
    } else if (dataNodeSet.current) {
      console.log('[DDTWizard] setDataNode BLOCCATO: già chiamato');
    }
  };

  // Handler per chiusura (annulla o completamento)
  const handleClose = (result?: any, messages?: any) => {
    setClosed(true);
    if (result && onComplete) onComplete(result, messages);
    else onCancel();
  };

  // Se chiuso, non renderizzare nulla
  if (closed) return null;

  // Durante la pipeline mostra SOLO la pipeline
  if (step === 'pipeline') {
    if (!stableDataNode) {
      console.log('[DDTWizard] ERRORE: dataNode è null durante la pipeline!');
      return null;
    }
    return (
      <WizardPipelineStep
        key={`pipeline-${stableDataNode.name || 'unknown'}`}
        dataNode={stableDataNode}
        detectTypeIcon={detectTypeIcon}
        onCancel={() => handleClose()}
        onComplete={(finalDDT) => {
          // Propaga il DDT finale al genitore
          handleClose(finalDDT);
        }}
        skipDetectType={true}
        confirmedLabel={detectedType || ''}
      />
    );
  }

  // Tutti gli altri step e stati sono gestiti solo prima della pipeline
  if (step === 'input') {
    return <WizardInputStep userDesc={userDesc} setUserDesc={setUserDesc} onNext={handleDetectType} onCancel={() => handleClose()} />;
  }
  if (step === 'loading') {
    return <WizardLoadingStep />;
  }
  if (step === 'confirm') {
    return <WizardConfirmTypeStep detectedType={detectedType} detectTypeIcon={detectTypeIcon} onCorrect={handleConfirmType} onWrong={() => setStep('input')} onCancel={() => handleClose()} />;
  }
  if (step === 'error') {
    return <WizardErrorStep errorMsg={errorMsg} onRetry={handleDetectType} onSupport={() => setStep('support')} onCancel={() => handleClose()} />;
  }
  if (step === 'support') {
    return <WizardSupportModal onOk={() => handleClose()} />;
  }
  return null;
};

export default DDTWizard;