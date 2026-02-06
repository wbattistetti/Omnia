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