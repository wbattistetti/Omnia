import React from 'react';
import type { EditorProps } from '../EditorHost/types';
import ResponseEditor from './index';
import { useDDTManager } from '../../../context/DDTManagerContext';
import { instanceRepository } from '../../../services/InstanceRepository';

export default function DDTHostAdapter({ act, onClose }: EditorProps) {
  const { openDDT } = useDDTManager();
  const instanceKey = React.useMemo(() => act.instanceId || act.id, [act.instanceId, act.id]);


  // 1. Cerca DDT nell'istanza, crea l'istanza se non esiste
  const existingDDT = React.useMemo(() => {
    let instance = instanceRepository.getInstance(instanceKey);

    // Se l'istanza non esiste, creala
    if (!instance) {
      console.log('🔧 [DDTHostAdapter] Creating missing instance for:', instanceKey);
      instance = instanceRepository.createInstanceWithId(instanceKey, act.id, []);
    }

    return instance?.ddt || null;
  }, [instanceKey, act.id]);

  // 2. Se esiste, usalo; altrimenti crea un placeholder vuoto
  const ddt = React.useMemo(() =>
    existingDDT || {
      id: `temp_ddt_${act.id}`,
      label: act.label || 'Data',
      _userLabel: act.label,
      _sourceAct: { id: act.id, label: act.label, type: act.type },
      mainData: []
    },
    [existingDDT, act.id, act.label, act.type]
  );

  // 3. Quando completi il wizard, salva nell'istanza
  const handleComplete = React.useCallback((finalDDT: any) => {
    // Salva il DDT nell'istanza
    const saved = instanceRepository.updateDDT(instanceKey, finalDDT);

    // Close this overlay first
    if (onClose) onClose();

    // Then open in DDTManager (AppContent will mount ResizableResponseEditor)
    if (finalDDT) {
      setTimeout(() => {
        openDDT(finalDDT);
      }, 50);
    }
  }, [act.id, instanceKey, onClose, openDDT]);

  return (
    <ResponseEditor
      ddt={ddt}
      onClose={onClose}
      onWizardComplete={handleComplete}
      act={act}
    />
  );
}


