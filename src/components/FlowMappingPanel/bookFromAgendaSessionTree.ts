/**
 * Raggruppamento visivo "Session" per BookFromAgenda: wireKey `Session.projectId` / `Session.conversationId`
 * senza alterare le chiavi API (apiField resta `projectId` / `conversationId`). Round-trip in {@link mappingEntriesToBackendInputs}.
 */

import type { MappingEntry } from './mappingTypes';

const SESSION = 'Session';
const SESSION_DOT = `${SESSION}.`;
const SESSION_CHILD_KEYS = new Set(['projectId', 'conversationId']);

export function isBookFromAgendaEndpointUrl(url: string | undefined | null): boolean {
  return String(url || '')
    .trim()
    .toLowerCase()
    .includes('bookfromagenda');
}

/** Presentazione tree: inserisce prefisso Session. su projectId e conversationId top-level. */
export function wrapBookFromAgendaSessionEntries(
  entries: MappingEntry[],
  endpointUrl: string | undefined | null
): MappingEntry[] {
  if (!isBookFromAgendaEndpointUrl(endpointUrl)) return entries;
  return entries.map((e) => {
    const w = e.wireKey.trim();
    if (!w.includes('.') && SESSION_CHILD_KEYS.has(w)) {
      return { ...e, wireKey: `${SESSION_DOT}${w}` };
    }
    return e;
  });
}

export function unwrapSessionTreeWireKey(wireKey: string): string {
  const t = wireKey.trim();
  if (t.startsWith(SESSION_DOT)) return t.slice(SESSION_DOT.length);
  return t;
}

/** Ripristina internalName persistito (senza prefisso Session.) */
export function unwrapBookFromAgendaSessionEntries(entries: MappingEntry[]): MappingEntry[] {
  return entries.map((e) => ({ ...e, wireKey: unwrapSessionTreeWireKey(e.wireKey) }));
}
