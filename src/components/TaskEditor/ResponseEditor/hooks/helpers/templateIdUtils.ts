// templateIdUtils.ts
// Utility per normalizzazione e validazione templateId
// Evita bug silenziosi con valori "undefined", null, stringa vuota

/**
 * Normalizza templateId: gestisce undefined, null, stringa vuota, "undefined"
 *
 * @param templateId - TemplateId da normalizzare
 * @returns TemplateId normalizzato o null
 */
export function normalizeTemplateId(templateId: string | null | undefined): string | null {
  if (!templateId) return null;

  const normalized = typeof templateId === 'string' ? templateId.trim() : String(templateId).trim();

  if (normalized === '' || normalized.toLowerCase() === 'undefined') {
    return null;
  }

  return normalized;
}

/**
 * Verifica se templateId è valido (non null, non undefined, non "undefined")
 *
 * @param templateId - TemplateId da verificare
 * @returns true se templateId è valido
 */
export function isValidTemplateId(templateId: string | null | undefined): boolean {
  const normalized = normalizeTemplateId(templateId);
  return normalized !== null;
}


