import { ActionNode, ActionParameter } from './types';

export function mapDDTtoActionNodes(ddt: any, actionsCatalog: any[], translations: any, lang = 'it'): ActionNode[] {
  if (!ddt || !ddt.steps) return [];
  const nodes: ActionNode[] = [];

  Object.entries(ddt.steps).forEach(([stepKey, actions]: [string, any]) => {
    const actionList = Array.isArray(actions) ? actions : actions.actions;
    if (!Array.isArray(actionList)) return;
    actionList.forEach((action: any, idx: number) => {
      const catalog = actionsCatalog.find((a: any) => a.id === action.actionType);
      if (!catalog) return;

      // Primary parameter: per ora prendi il primo stringa richiesto
      const primaryParamKey = Object.keys(catalog.params).find(
        k => catalog.params[k].type === 'string'
      ) || '';
      const primaryKey = action[primaryParamKey];
      let primaryValue = '';
      if (primaryKey && translations) {
        if (Array.isArray(translations)) {
          const t = translations.find((t: any) => t.key === primaryKey);
          primaryValue = t && t.value && t.value[lang] ? t.value[lang] : '';
        } else if (typeof translations === 'object') {
          primaryValue = translations[primaryKey] && translations[primaryKey][lang] ? translations[primaryKey][lang] : '';
        }
      }

      // Altri parametri
      const parameters: ActionParameter[] = Object.keys(catalog.params)
        .filter(k => k !== primaryParamKey)
        .map(paramKey => {
          const key = action[paramKey];
          let value = '';
          if (key && translations) {
            if (Array.isArray(translations)) {
              const t = translations.find((t: any) => t.key === key);
              value = t && t.value && t.value[lang] ? t.value[lang] : '';
            } else if (typeof translations === 'object') {
              value = translations[key] && translations[key][lang] ? translations[key][lang] : '';
            }
          }
          return { key: paramKey, value };
        });

      nodes.push({
        id: action.actionInstanceId || `${stepKey}_${idx}`,
        actionType: action.actionType,
        icon: catalog.icon,
        label: stepKey,
        primaryParameter: primaryValue || 'Scrivi messaggio qui...',
        parameters,
        children: [], // TODO: mappa figli se presenti
        parentId: undefined,
      });
    });
  });

  return nodes;
} 