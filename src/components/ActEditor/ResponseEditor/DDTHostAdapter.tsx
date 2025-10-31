import React from 'react';
import type { EditorProps } from '../EditorHost/types';
import ResponseEditor from './index';
import { instanceRepository } from '../../../services/InstanceRepository';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';

export default function DDTHostAdapter({ act, onClose }: EditorProps) {
  // Ottieni projectId corrente per salvare le istanze nel progetto corretto
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;
  const instanceKey = React.useMemo(() => act.instanceId || act.id, [act.instanceId, act.id]);


  // 1. Cerca DDT nell'istanza, crea l'istanza se non esiste
  // USO useMemo sincrono per evitare che il primo render mostri DDT vuoto
  // getInstance() è O(1) Map lookup, quindi veloce e sicuro durante il render
  const existingDDT = React.useMemo(() => {
    console.log('🔍 [DDTHostAdapter] useMemo START - Looking for instance:', instanceKey);
    let instance = instanceRepository.getInstance(instanceKey);

    if (!instance) {
      console.log('🔧 [DDTHostAdapter] Creating missing instance for:', instanceKey);
      instance = instanceRepository.createInstanceWithId(instanceKey, act.id, []);
    } else {
      console.log('✅ [DDTHostAdapter] Found instance:', {
        instanceId: instance.instanceId,
        hasDDT: !!instance.ddt,
        ddtType: typeof instance.ddt,
        ddtIsObject: instance.ddt && typeof instance.ddt === 'object',
        ddtKeys: instance.ddt ? Object.keys(instance.ddt) : [],
        ddtMainData: instance.ddt?.mainData,
        ddtMainDataLength: instance.ddt?.mainData?.length || 0,
        ddtId: instance.ddt?.id,
        ddtLabel: instance.ddt?.label,
        ddtFull: instance.ddt // Log completo per debugging
      });
    }

    const result = instance?.ddt || null;
    console.log('📦 [DDTHostAdapter] useMemo RETURN:', {
      resultExists: !!result,
      resultType: typeof result,
      resultIsObject: result && typeof result === 'object',
      resultKeys: result ? Object.keys(result) : [],
      resultMainDataLength: result?.mainData?.length || 0,
      resultId: result?.id
    });

    return result;
  }, [instanceKey, act.id]); // Dipendenze: solo instanceKey e act.id

  // 2. Se esiste, usalo; altrimenti crea un placeholder vuoto
  const ddt = React.useMemo(() => {
    console.log('🔧 [DDTHostAdapter] Building final DDT:', {
      hasExistingDDT: !!existingDDT,
      existingDDTId: existingDDT?.id,
      existingDDTMainDataLength: existingDDT?.mainData?.length || 0
    });

    const finalDDT = existingDDT || {
      id: `temp_ddt_${act.id}`,
      label: act.label || 'Data',
      _userLabel: act.label,
      _sourceAct: { id: act.id, label: act.label, type: act.type },
      mainData: []
    };

    console.log('📤 [DDTHostAdapter] Final DDT:', {
      id: finalDDT.id,
      label: finalDDT.label,
      mainDataLength: finalDDT.mainData?.length || 0,
      isFromInstance: !!existingDDT,
      isTemp: finalDDT.id.startsWith('temp_ddt_')
    });

    return finalDDT;
  }, [existingDDT, act.id, act.label, act.type]);

  // 3. Quando completi il wizard, salva nell'istanza
  const handleComplete = React.useCallback((finalDDT: any) => {
    // Salva il DDT nell'istanza
    const saved = instanceRepository.updateDDT(instanceKey, finalDDT, currentProjectId || undefined);

    // Close this overlay first
    if (onClose) onClose();

    // Non serve più aprire in DDTManager: l'editor è già stato aperto tramite ctx.act
    // Se l'utente vuole riaprire, può cliccare di nuovo l'ingranaggio
  }, [instanceKey, onClose]);

  console.log('🎨 [DDTHostAdapter] Rendering ResponseEditor with:', {
    hasDDT: !!ddt,
    ddtIsEmpty: ddt && (!ddt.mainData || ddt.mainData.length === 0),
    ddtMainDataLength: ddt?.mainData?.length || 0,
    ddtId: ddt?.id,
    actId: act.id,
    instanceKey
  });

  return (
    <ResponseEditor
      ddt={ddt}
      onClose={onClose}
      onWizardComplete={handleComplete}
      act={act}
    />
  );
}


