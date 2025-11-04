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

    // ✅ Se ProblemClassification, verifica che il DDT abbia kind === "intent"
    if (act.type === 'ProblemClassification') {
      // Verifica se il DDT esistente ha kind === "intent"
      const firstMain = instanceDDT?.mainData?.[0];
      const hasCorrectKind = firstMain?.kind === 'intent';

      // Se NON esiste DDT o ha kind sbagliato, inizializza/resetta con kind: "intent"
      if (!instanceDDT || !hasCorrectKind) {
        const newDDT = {
          id: `temp_ddt_${act.id}`,
          label: act.label || 'Data',
          _userLabel: act.label,
          _sourceAct: { id: act.id, label: act.label, type: act.type },
          mainData: [{
            label: act.label || 'Intent',
            kind: 'intent', // ✅ FISSO per ProblemClassification
            steps: {},
            subData: []
          }]
        };

        // ✅ Se l'istanza esiste ma ha DDT con kind sbagliato, correggilo
        if (instance && instanceDDT && !hasCorrectKind) {
          console.log('[DDTHostAdapter] Correcting DDT with wrong kind for ProblemClassification', {
            instanceId: instanceKey,
            oldKind: firstMain?.kind,
            newKind: 'intent'
          });
          instanceRepository.updateDDT(instanceKey, newDDT, currentProjectId || undefined);
        }

        return newDDT;
      }

      // Se il DDT esiste e ha kind === "intent", usalo
      return instanceDDT;
    }

    // ✅ Per altri tipi, se esiste instanceDDT usalo, altrimenti placeholder vuoto
    if (instanceDDT) {
      return instanceDDT;
    }

    // Default: placeholder vuoto per altri tipi
    return {
      id: `temp_ddt_${act.id}`,
      label: act.label || 'Data',
      _userLabel: act.label,
      _sourceAct: { id: act.id, label: act.label, type: act.type },
      mainData: []
    };
  });

  // Aggiorna currentDDT quando existingDDT cambia (al primo load se c'è un DDT salvato)
  React.useEffect(() => {
    // ✅ Se esiste existingDDT, usalo SEMPRE (è quello salvato dall'utente)
    if (existingDDT) {
      // Solo se currentDDT è ancora un placeholder (non è stato ancora caricato)
      const currentIsPlaceholder = currentDDT.id?.startsWith('temp_ddt_');
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


