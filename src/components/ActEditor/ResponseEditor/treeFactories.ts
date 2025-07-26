import { TreeNodeProps } from './types';
import { getTranslationText } from './responseEditorHelpers';

// Estrae i nodi dall'oggetto DDT e translations
export const estraiNodiDaDDT = (ddt: any, translations: any, lang: string): TreeNodeProps[] => {
  if (!ddt || !ddt.steps) return [];
  if (!translations || Object.keys(translations).length === 0) {
    console.warn('[estraiNodiDaDDT] Translations vuote per DDT', ddt.id || ddt._id);
  }
  const nodes: TreeNodeProps[] = [];
  for (const [stepKey, actions] of Object.entries(ddt.steps)) {
    if (Array.isArray(actions)) {
      let currentEscalationId: string | undefined = undefined;
      let escalationIdx = 0;
      actions.forEach((action: any, idx: number) => {
        if (action.type === 'escalation' && action.id) {
          currentEscalationId = action.id;
          escalationIdx++;
          nodes.push({
            id: action.id,
            text: 'recovery',
            type: 'escalation',
            level: 0,
            included: true,
          });
        } else if (action.actionInstanceId && currentEscalationId) {
          const actionInstanceId = action.actionInstanceId;
          const ddtId = ddt.id || ddt._id;
          const text = getTranslationText(translations, ddtId, stepKey, escalationIdx, actionInstanceId, lang);
          if (text === '') {
            console.warn('[estraiNodiDaDDT] Messaggio vuoto', { ddtId, stepKey, escalationIdx, actionInstanceId, lang, translations });
          }
          nodes.push({
            id: actionInstanceId,
            text,
            type: stepKey,
            level: 1,
            parentId: currentEscalationId,
          });
        }
      });
    }
  }
  console.log('[estraiNodiDaDDT] Nodi generati:', nodes);
  return nodes;
};

// Inserisce un nodo in una posizione specifica rispetto a un targetId
export function insertNodeAt(nodes: TreeNodeProps[], node: TreeNodeProps, targetId: string, position: 'before' | 'after') {
  const idx = nodes.findIndex(n => n.id === targetId);
  if (idx === -1) return nodes;
  const insertIdx = position === 'before' ? idx : idx + 1;
  return [...nodes.slice(0, insertIdx), node, ...nodes.slice(insertIdx)];
}

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

// Aggiunge un nodo in fondo
export function addNode(nodes: TreeNodeProps[], node: TreeNodeProps) {
  return [...nodes, node];
} 