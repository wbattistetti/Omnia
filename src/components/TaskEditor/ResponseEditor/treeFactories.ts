import { TreeNodeProps } from './types';
import { getTranslationText } from './responseEditorHelpers';

// Estrae i nodi dall'oggetto DDT e translations
export const estraiNodiDaDDT = (ddt: any, translations: any, lang: string): TreeNodeProps[] => {
  if (!ddt || !ddt.steps) return [];
  if (!translations || Object.keys(translations).length === 0) {
  }
  const nodes: TreeNodeProps[] = [];

  // Supporta nuova struttura: steps è un array
  if (Array.isArray(ddt.steps)) {
    ddt.steps.forEach((stepGroup: any) => {
      const stepKey = stepGroup.type;
      const escalations = stepGroup.escalations || [];
      let escalationIdx = 0;
      escalations.forEach((escalation: any) => {
        if (escalation.escalationId) {
          const currentEscalationId = escalation.escalationId;
          escalationIdx++;
          nodes.push({
            id: currentEscalationId,
            text: 'recovery',
            type: 'escalation',
            stepType: stepKey,
            level: 0,
            included: true,
          });
          const taskRefs = escalation.tasks || [];
          taskRefs.forEach((taskRef: any) => {
            // ✅ UNIFIED MODEL: Use task.id (complete Task object)
            if (!taskRef.id) {
              console.warn('[treeFactories] Task missing id, skipping');
              return;
            }
            const taskId = taskRef.id;
            if (taskId) {
              const ddtId = getNodeIdStrict(ddt);
              const key = taskRef.parameters && taskRef.parameters[0] && taskRef.parameters[0].value;
              const testo = translations[key];
              const text = testo || '';
              if (text === '') {
              }
              nodes.push({
                id: taskId,
                text,
                type: stepKey,
                level: 1,
                parentId: currentEscalationId,
              });
            }
          });
        }
      });
    });
  } else {
    // steps come oggetto: supporta due forme
    for (const [stepKey, val] of Object.entries(ddt.steps)) {
      // Forma A: azioni flat (legacy)
      if (Array.isArray(val)) {
        let currentEscalationId: string | undefined = undefined;
        let escalationIdx = 0;
        val.forEach((action: any) => {
          if (action.type === 'escalation' && action.id) {
            currentEscalationId = action.id;
            escalationIdx++;
            nodes.push({ id: action.id, text: 'recovery', type: 'escalation', level: 0, included: true });
          } else if (action.actionInstanceId && currentEscalationId) {
            const actionInstanceId = action.actionInstanceId;
            const ddtId = ddt.id || ddt._id;
            const text = getTranslationText(translations, ddtId, stepKey, escalationIdx, actionInstanceId, lang);
            nodes.push({ id: actionInstanceId, text, type: stepKey, level: 1, parentId: currentEscalationId });
          }
        });
        continue;
      }
      // Forma B: { type, escalations: [{ tasks: [...] }] }
      if (val && typeof val === 'object' && Array.isArray((val as any).escalations)) {
        const escs = (val as any).escalations as any[];
        escs.forEach((esc: any, idx: number) => {
          const escId = esc.escalationId || `${stepKey}_${idx + 1}`;
          nodes.push({ id: escId, text: 'recovery', type: 'escalation', level: 0, included: true });
          (esc.tasks || []).forEach((a: any) => {
            const actionInstanceId = a.actionInstanceId || `${stepKey}_${idx + 1}_a`;
            const p = Array.isArray(a.parameters) ? a.parameters.find((x: any) => x?.parameterId === 'text') : undefined;
            const key = p?.value;
            const text = (key && translations[key]) || '';
            nodes.push({ id: actionInstanceId, text, type: stepKey, level: 1, parentId: escId });
          });
        });
      }
    }
  }

  return nodes;
};

// Rimuove un nodo (e opzionalmente i figli)
export function removeNodePure(nodes: TreeNodeProps[], id: string, removeChildren: boolean) {
  if (!removeChildren) return nodes.filter(n => n.id !== id);
  const toRemove = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
        toRemove.add(n.id);
        changed = true;
      }
    }
  }
  return nodes.filter(n => !toRemove.has(n.id));
}