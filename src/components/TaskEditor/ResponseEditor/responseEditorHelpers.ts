// Estrae il parametro principale da una action
export function estraiParametroPrincipale(action: any) {
  if (!action || !action.parameters) return null;
  if (Array.isArray(action.parameters)) {
    return action.parameters[0] || null;
  }
  return null;
}

// Estrae il valore tradotto per una chiave
export function estraiValoreTradotto(key: string, translations: any, lang: string) {
  if (!key) return '';
  if (!translations) return '';
  let value = '';
  if (Array.isArray(translations)) {
    const t = translations.find((t: any) => t.key === key);
    if (t && t.value && t.value[lang]) {
      value = t.value[lang];
    }
  } else if (typeof translations === 'object') {
    if (translations[key] && translations[key][lang]) {
      value = translations[key][lang];
    }
  }
  return value;
}

// Funzione di lookup con tipi espliciti
export function getTranslationText(
  translations: Record<string, any>,
  ddtId: string,
  step: string,
  escalation: number,
  actionInstanceId: string,
  lang: string
) {
  const key = `runtime.${ddtId}.${step}#${escalation}.${actionInstanceId}.text`;
  const fallbackKey = `runtime.${ddtId}.${step}.${actionInstanceId}.text`;
  const actionsKey = `Actions.${actionInstanceId}.text`;
  if (translations[key] && translations[key][lang]) {
    return translations[key][lang];
  }
  if (translations[fallbackKey] && translations[fallbackKey][lang]) {
    return translations[fallbackKey][lang];
  }
  if (translations[actionsKey] && translations[actionsKey][lang]) {
    return translations[actionsKey][lang];
  }
  return '';
}

// Funzione per numerale ordinale italiano (1° 2° 3° ...)
export function ordinalIt(n: number) {
  return n + '°';
}

// Estrae la label di un'azione
export function estraiLabelAzione(actionType: string, translations: any, lang: string) {
  const key = `action.${actionType}.label`;
  if (!translations) return '';
  if (Array.isArray(translations)) {
    const t = translations.find((t: any) => t.key === key);
    return t && t.value && t.value[lang] ? t.value[lang] : '';
  } else if (typeof translations === 'object') {
    return translations[key] && translations[key][lang] ? translations[key][lang] : '';
  }
  return '';
} 