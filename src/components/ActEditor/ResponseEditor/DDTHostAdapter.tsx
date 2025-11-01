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

  // 2. STATE per mantenere il DDT corrente (aggiornato dopo salvataggio)
  // Questo risolve il problema: useMemo non ricalcola quando l'istanza viene aggiornata
  const [currentDDT, setCurrentDDT] = React.useState<any>(() => {
    // Inizializza dall'istanza se esiste, altrimenti placeholder
    const instance = instanceRepository.getInstance(instanceKey);
    const instanceDDT = instance?.ddt;

    console.log('[WIZARD_FLOW] DDTHostAdapter: Initializing currentDDT', {
      hasInstanceDDT: !!instanceDDT,
      instanceDDTMainDataLength: instanceDDT?.mainData?.length || 0,
      instanceKey
    });

    return instanceDDT || {
      id: `temp_ddt_${act.id}`,
      label: act.label || 'Data',
      _userLabel: act.label,
      _sourceAct: { id: act.id, label: act.label, type: act.type },
      mainData: []
    };
  });

  // Aggiorna currentDDT quando existingDDT cambia (al primo load se c'è un DDT salvato)
  React.useEffect(() => {
    // Solo se existingDDT ha dati e currentDDT è ancora il placeholder vuoto
    if (existingDDT && existingDDT.mainData && existingDDT.mainData.length > 0) {
      const currentIsPlaceholder = currentDDT.id?.startsWith('temp_ddt_') && (!currentDDT.mainData || currentDDT.mainData.length === 0);
      if (currentIsPlaceholder) {
        console.log('[WIZARD_FLOW] DDTHostAdapter: Updating currentDDT from existingDDT', {
          currentDDTId: currentDDT.id,
          existingDDTId: existingDDT.id,
          existingDDTMainDataLength: existingDDT.mainData.length
        });
        setCurrentDDT(existingDDT);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDDT]); // currentDDT intenzionalmente non incluso: controlliamo solo quando existingDDT cambia

  // 3. Quando completi il wizard, salva nell'istanza E aggiorna lo state
  const handleComplete = React.useCallback((finalDDT: any) => {
    console.log('[WIZARD_FLOW] DDTHostAdapter: handleComplete called', {
      hasFinalDDT: !!finalDDT,
      finalDDTId: finalDDT?.id,
      finalDDTLabel: finalDDT?.label,
      instanceKey,
      currentProjectId
    });

    // Salva il DDT nell'istanza
    const saved = instanceRepository.updateDDT(instanceKey, finalDDT, currentProjectId || undefined);
    console.log('[WIZARD_FLOW] DDTHostAdapter: DDT saved to instance', {
      saved: !!saved,
      instanceKey
    });

    // CRITICO: Aggiorna immediatamente currentDDT per aggiornare il prop ddt
    // Questo evita che useDDTInitialization sincronizzi localDDT con il placeholder vuoto
    console.log('[WIZARD_FLOW] DDTHostAdapter: Updating currentDDT state with saved DDT', {
      finalDDTId: finalDDT?.id,
      finalDDTMainDataLength: finalDDT?.mainData?.length || 0
    });
    setCurrentDDT(finalDDT);

    // NON chiudere l'overlay - lascia che l'utente veda l'editor con i messaggi generati
    // L'utente può chiudere manualmente cliccando "Close" nell'header
    console.log('[WIZARD_FLOW] DDTHostAdapter: Overlay will remain open for user to review editor');
  }, [instanceKey, currentProjectId]);

  console.log('🎨 [DDTHostAdapter] Rendering ResponseEditor with:', {
    hasDDT: !!currentDDT,
    ddtIsEmpty: currentDDT && (!currentDDT.mainData || currentDDT.mainData.length === 0),
    ddtMainDataLength: currentDDT?.mainData?.length || 0,
    ddtId: currentDDT?.id,
    actId: act.id,
    instanceKey
  });

  return (
    <ResponseEditor
      ddt={currentDDT}
      onClose={onClose}
      onWizardComplete={handleComplete}
      act={act}
    />
  );
}


