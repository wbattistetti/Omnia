/**
 * Audit body HTTP per Test API / Esegui (log dev e avvisi body vuoto).
 */

/** True se il body JSON è assente o oggetto `{}`. */
export function isEmptyBackendTestBodyJson(bodyJson: string | null | undefined): boolean {
  if (bodyJson == null || bodyJson.trim() === '') return true;
  try {
    const parsed: unknown = JSON.parse(bodyJson);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    return Object.keys(parsed as Record<string, unknown>).length === 0;
  } catch {
    return false;
  }
}

export type BackendTestHttpPayloadAudit = {
  emptyBody: boolean;
  bodyJson: string | null;
  url: string;
  method: string;
};
