import { useCallback } from 'react';

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
  updateSelectedNode: (updater: (node: any) => any, notifyProvider?: boolean) => void
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
      // ✅ MIGRATION: Normalizza sia tasks (new) che actions (legacy)
      // Preferisce tasks se presente, altrimenti usa actions
      const normalized = (nextEscalations || []).map((esc: any) => {
        // ✅ Prefer tasks over actions
        const items = esc.tasks || esc.actions || [];

        if (debugDrop()) {
          console.log('[DROP_DEBUG][useNodePersistence] 🔄 Normalizing escalation', {
            itemsCount: items.length,
            hasTasks: !!esc.tasks,
            hasActions: !!esc.actions
          });
        }

        // Normalizza ogni item (task o action) al formato DDT
        const normalizedItems = items.map((item: any) => {
          if (!item) return null;

          // ✅ Support both task (new) and action (legacy) formats
          const id = item.templateId || item.actionId || 'sayMessage';
          const out: any = {
            actionId: id, // Legacy field (required by DDT structure)
            templateId: id // New field
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
          if (id === 'sayMessage' || id === 'askQuestion') {
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
            // If text is provided (especially when editing), save it directly in the node
            // This ensures edited text persists even when switching steps
            if (typeof item.text === 'string' && item.text.trim().length > 0) {
              out.text = item.text;
            }
          }
          return out;
        }).filter((x: any) => x != null);

        return {
          tasks: normalizedItems, // ✅ New field
          actions: normalizedItems  // ✅ Legacy alias (required by DDT structure)
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
          if (!escs[i]) escs[i] = { tasks: [], actions: [] };
          // ✅ normalized già contiene sia tasks che actions con lo stesso contenuto
          escs[i] = {
            tasks: esc.tasks,  // ✅ New field (normalizedItems)
            actions: esc.actions  // ✅ Legacy alias (normalizedItems)
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
          if (!escs[i]) escs[i] = { tasks: [], actions: [] };
          // ✅ normalized già contiene sia tasks che actions con lo stesso contenuto
          escs[i] = {
            tasks: esc.tasks,  // ✅ New field (normalizedItems)
            actions: esc.actions  // ✅ Legacy alias (normalizedItems)
          };
        });
        obj[selectedStepKey] = { ...group, escalations: escs, type: selectedStepKey };

        if (debugDrop()) {
          console.log('[DROP_DEBUG][useNodePersistence] ✅ Saved to DDT (object format)', {
            selectedStepKey,
            escalationsCount: escs.length,
            firstEscTasksCount: escs[0]?.tasks?.length || 0,
            firstEscActionsCount: escs[0]?.actions?.length || 0
          });
        }

        return { ...(node || {}), steps: obj };
      }
    }, false); // notifyProvider = false (gestito internamente)
  }, [selectedStepKey, updateSelectedNode]);

  return { normalizeAndPersistModel };
}

