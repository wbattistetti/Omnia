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
    let instance = instanceRepository.getInstance(instanceKey);

    if (!instance) {
      instance = instanceRepository.createInstanceWithId(instanceKey, act.id, []);
    }

    return instance?.ddt || null;
  }, [instanceKey, act.id]); // Dipendenze: solo instanceKey e act.id

  // 2. STATE per mantenere il DDT corrente (aggiornato dopo salvataggio)
  // Questo risolve il problema: useMemo non ricalcola quando l'istanza viene aggiornata
  const [currentDDT, setCurrentDDT] = React.useState<any>(() => {
    // Inizializza dall'istanza se esiste, altrimenti placeholder
    const instance = instanceRepository.getInstance(instanceKey);
    const instanceDDT = instance?.ddt;


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
        setCurrentDDT(existingDDT);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDDT]); // currentDDT intenzionalmente non incluso: controlliamo solo quando existingDDT cambia

  // 3. Quando completi il wizard, salva nell'istanza E aggiorna lo state
  const handleComplete = React.useCallback((finalDDT: any) => {
    // Salva il DDT nell'istanza
    instanceRepository.updateDDT(instanceKey, finalDDT, currentProjectId || undefined);

    // CRITICO: Aggiorna immediatamente currentDDT per aggiornare il prop ddt
    // Questo evita che useDDTInitialization sincronizzi localDDT con il placeholder vuoto
    setCurrentDDT(finalDDT);
  }, [instanceKey, currentProjectId]);


  return (
    <ResponseEditor
      ddt={currentDDT}
      onClose={onClose}
      onWizardComplete={handleComplete}
      act={act}
    />
  );
}


