import { useCallback } from 'react';
import { TaskType, templateIdToTaskType } from '@types/taskTypes';

/**
 * Hook for normalizing and persisting node model changes in ResponseEditor.
 * Handles the conversion from EscalationModel[] to the DDT node structure.
 *
 * @param selectedStepKey - Current step key being edited
 * @param updateSelectedNode - Function to update the selected node
 * @returns normalizeAndPersistModel function to use as onModelChange
 */
export function useNodePersistence(
  selectedStepKey: string,
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void
) {
  const normalizeAndPersistModel = useCallback((nextEscalations: any[]) => {
    const debugDrop = () => {
      try { return localStorage.getItem('debug.drop') === '1'; } catch { return false; }
    };

    if (debugDrop()) {
      console.log('[DROP_DEBUG][useNodePersistence] 📥 normalizeAndPersistModel called', {
        nextEscalationsCount: nextEscalations?.length || 0,
        firstEscTasksCount: nextEscalations?.[0]?.tasks?.length || 0
      });
    }

    // ✅ Chiamata sincrona diretta - no setTimeout
    updateSelectedNode((node) => {
      // ✅ Normalizza tasks al formato DDT
      const normalized = (nextEscalations || []).map((esc: any) => {
        const items = esc.tasks || [];

        if (debugDrop()) {
          console.log('[DROP_DEBUG][useNodePersistence] 🔄 Normalizing escalation', {
            itemsCount: items.length,
            hasTasks: !!esc.tasks
          });
        }

        // Normalizza ogni task al formato DDT
        const normalizedItems = items.map((item: any) => {
          if (!item) return null;

          const id = item.templateId || 'sayMessage';
          // ✅ Determina TaskType dal templateId se non presente
          const taskType = item.type ?? templateIdToTaskType(id) || TaskType.SayMessage;

          const out: any = {
            type: taskType, // ✅ Aggiunto campo type (enum numerico)
            templateId: id
          };

          // ✅ Preserve taskId if present
          if (item.taskId) {
            out.taskId = item.taskId;
          }

          // Copia parametri/props generiche
          if (Array.isArray(item.parameters)) {
            out.parameters = item.parameters;
          }
          if (item.color) out.color = item.color;

          // Per azioni testuali, aggiungi contenuto se presente (non scartare i vuoti)
          if (id === 'sayMessage') {
            // Always preserve textKey if present (for translation reference)
            if (typeof item.textKey === 'string') {
              out.parameters = [{ parameterId: 'text', value: item.textKey }];
            } else {
              // Extract textKey from parameters if available
              const textParam = item.parameters?.find((p: any) => p.parameterId === 'text');
              if (textParam?.value && typeof textParam.value === 'string') {
                out.parameters = [{ parameterId: 'text', value: textParam.value }];
              }
            }
            // ❌ RIMOSSO: Non salvare item.text - il task deve contenere solo GUID
            // Il modello corretto è: task contiene solo GUID, traduzione in translations[GUID]
          }
          return out;
        }).filter((x: any) => x != null);

        return {
          tasks: normalizedItems
        };
      });

      // Se non c'è nulla da committare, non toccare lo step
      if (normalized.length === 0) return node;

      const currentSteps = (node as any).steps;
      if (Array.isArray(currentSteps)) {
        // Case: steps as array [{ type: 'start', escalations: [...] }, ...]
        const arr = [...currentSteps];
        let idx = arr.findIndex((g: any) => g?.type === selectedStepKey);
        if (idx < 0) {
          // Step non esiste, crealo
          arr.push({ type: selectedStepKey, escalations: normalized });
          return { ...(node || {}), steps: arr };
        }
        // Step esiste, aggiornalo
        const group = { ...(arr[idx] || {}) };
        const escs = Array.isArray(group.escalations) ? [...group.escalations] : [];
        // Aggiorna solo gli indici presenti in normalized
        normalized.forEach((esc: any, i: number) => {
          if (!escs[i]) escs[i] = { tasks: [] };
          escs[i] = {
            tasks: esc.tasks,  // ✅ New field (normalizedItems)
          };
        });
        group.escalations = escs;
        arr[idx] = { ...group, type: selectedStepKey };
        return { ...(node || {}), steps: arr };
      } else {
        // Case: steps as object { start: { escalations: [...] } }
        const obj: any = { ...(currentSteps || {}) };
        const group = { ...(obj[selectedStepKey] || { type: selectedStepKey, escalations: [] }) };
        const escs = Array.isArray(group.escalations) ? [...group.escalations] : [];
        normalized.forEach((esc: any, i: number) => {
          if (!escs[i]) escs[i] = { tasks: [] };
          escs[i] = {
            tasks: esc.tasks,  // ✅ New field (normalizedItems)
          };
        });
        obj[selectedStepKey] = { ...group, escalations: escs, type: selectedStepKey };

        if (debugDrop()) {
          console.log('[DROP_DEBUG][useNodePersistence] ✅ Saved to DDT (object format)', {
            selectedStepKey,
            escalationsCount: escs.length,
            firstEscTasksCount: escs[0]?.tasks?.length || 0,
            firstEscTasksCount: escs[0]?.tasks?.length || 0
          });
        }

        return { ...(node || {}), steps: obj };
      }
    });
  }, [selectedStepKey, updateSelectedNode]);

  return { normalizeAndPersistModel };
}

