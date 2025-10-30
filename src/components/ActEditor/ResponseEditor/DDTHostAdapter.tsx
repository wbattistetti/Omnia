import React from 'react';
import type { EditorProps } from '../EditorHost/types';
import ResponseEditor from './index';
import { useDDTManager } from '../../../context/DDTManagerContext';
import { instanceRepository } from '../../../services/InstanceRepository';

export default function DDTHostAdapter({ act, onClose }: EditorProps) {
  const { openDDT } = useDDTManager();
  const instanceKey = React.useMemo(() => act.instanceId || act.id, [act.instanceId, act.id]);

  // Debug mount log
  React.useEffect(() => {
    console.log('🔧 [DDTHostAdapter][MOUNT]', {
      actId: act.id,
      instanceId: act.instanceId,
      instanceKey,
      actType: act.type,
      actLabel: act.label
    });
    // Also try logger centralizzato
    try {
      const { info } = require('../../../utils/logger');
      info('RESPONSE_EDITOR', 'DDTHostAdapter mounted', { actId: act.id, instanceId: act.instanceId });
    } catch { }
  }, []);

  // 1. Cerca DDT nell'istanza, se non esiste cerca nel provider globale
  const existingDDT = React.useMemo(() => {
    let instance = instanceRepository.getInstance(instanceKey);
    let ddt = instance?.ddt;

    console.log('🔍 [DDTHostAdapter] APERTURA GEAR - Looking for existing DDT', {
      actId: act.id,
      instanceId: instanceKey,
      actLabel: act.label,
      instanceFound: !!instance,
      hasDDT: !!ddt,
      ddtMainData: ddt?.mainData?.length || 0
    });

    // Se non c'è DDT nell'istanza, cerca nel provider globale
    if (!ddt) {
      console.log('🔍 [DDTHostAdapter] No DDT in instance, checking global provider...');
      // Qui potresti aggiungere la logica per cercare nel provider globale
      // Per ora restituiamo null per aprire il wizard
    }

    return ddt || null;
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
    console.log('💾 [DDTHostAdapter] COMPLETAMENTO WIZARD - Saving DDT', {
      actId: act.id,
      instanceId: instanceKey,
      actLabel: act.label,
      ddtId: finalDDT?.id || finalDDT?._id,
      ddtLabel: finalDDT?.label,
      mainDataCount: finalDDT?.mainData?.length || 0
    });

    // Salva il DDT nell'istanza
    const saved = instanceRepository.updateDDT(instanceKey, finalDDT);
    console.log('💾 [DDTHostAdapter] Save result:', saved ? '✅ SUCCESS' : '❌ FAILED');

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


