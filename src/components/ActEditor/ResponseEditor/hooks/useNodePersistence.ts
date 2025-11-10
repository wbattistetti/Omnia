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
    // Postpone updateSelectedNode to avoid setState during render
    setTimeout(() => {
      updateSelectedNode((node) => {
      // Normalizza azioni: conserva anche azioni non testuali senza testo
      const normalized = (nextEscalations || []).map((esc: any) => ({
        actions: (esc.actions || []).map((a: any) => {
          if (!a) return null;
          const id = a.actionId || 'sayMessage';
          const out: any = { actionId: id };

          // Copia parametri/props generiche
          if (Array.isArray(a.parameters)) out.parameters = a.parameters;
          if (a.color) out.color = a.color;
          // icon e label vengono sempre da getActionIconNode/getActionLabel centralizzate

          // Per azioni testuali, aggiungi contenuto se presente (non scartare i vuoti)
          if (id === 'sayMessage' || id === 'askQuestion') {
            // Always preserve textKey if present (for translation reference)
            if (typeof a.textKey === 'string') {
              out.parameters = [{ parameterId: 'text', value: a.textKey }];
            }
            // If text is provided (especially when editing), save it directly in the node
            // This ensures edited text persists even when switching steps
            if (typeof a.text === 'string' && a.text.trim().length > 0) {
              out.text = a.text;
            }
          }
          return out;
        }).filter((x: any) => x != null)
      }));

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
          if (!escs[i]) escs[i] = { actions: [] };
          escs[i] = { actions: esc.actions };
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
          if (!escs[i]) escs[i] = { actions: [] };
          escs[i] = { actions: esc.actions };
        });
        obj[selectedStepKey] = { ...group, escalations: escs, type: selectedStepKey };
        return { ...(node || {}), steps: obj };
      }
      }, false); // notifyProvider = false (gestito internamente)
    }, 0);
  }, [selectedStepKey, updateSelectedNode]);

  return { normalizeAndPersistModel };
}

