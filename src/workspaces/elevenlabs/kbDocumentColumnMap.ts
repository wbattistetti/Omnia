/**
 * Derives KB variable names from document column headers only (no semantic aliases).
 */

export function normalizeKbHeaderKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

/** camelCase from header text: «NOME» → nome, «Nome Ufficiale» → nomeUfficiale. */
export function toCamelCaseIdentifier(label: string): string {
  const parts = label
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
    .split(/[\s_-]+/)
    .filter(Boolean);
  if (parts.length === 0) return 'field';
  return parts
    .map((p, i) => {
      const lower = p.toLowerCase();
      if (i === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

/** Variable id = normalized column title only (never remapped to other semantics). */
export function columnNameToVariable(sourceColumn: string): string {
  return toCamelCaseIdentifier(sourceColumn);
}

export function toKbPlaceholder(internalName: string): string {
  return `{{${internalName}}}`;
}
