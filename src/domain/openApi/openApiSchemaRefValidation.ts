/**
 * Rileva `$ref` non risolti negli schema materializzati (dopo dereferenziazione Read API).
 */

const REF_UNRESOLVED_SUFFIX = ' — spec incompleta';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/**
 * Elenco path con ref ancora presenti (es. `constraints.horizon: ref non risolto (#/…)`).
 */
export function collectRemainingOpenApiRefs(
  schema: unknown,
  pathPrefix = ''
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (path: string, ref: string) => {
    const msg = `${path}: ref non risolto (${ref})${REF_UNRESOLVED_SUFFIX}`;
    if (!seen.has(msg)) {
      seen.add(msg);
      out.push(msg);
    }
  };

  function walk(node: unknown, path: string): void {
    if (!isRecord(node)) return;

    const marker = node['x-omnia-unresolvedRef'];
    if (typeof marker === 'string' && marker.trim()) {
      push(path || '(root)', marker.trim());
    }
    if (typeof node.$ref === 'string' && node.$ref.trim()) {
      push(path || '(root)', node.$ref.trim());
    }

    if (isRecord(node.properties)) {
      for (const [key, child] of Object.entries(node.properties)) {
        const childPath = path ? `${path}.${key}` : key;
        walk(child, childPath);
      }
    }
    if (node.items !== undefined) {
      walk(node.items, path ? `${path}[]` : '[]');
    }
    if (Array.isArray(node.allOf)) {
      for (const sub of node.allOf) walk(sub, path);
    }
    if (Array.isArray(node.oneOf)) {
      for (const sub of node.oneOf) walk(sub, path);
    }
    if (Array.isArray(node.anyOf)) {
      for (const sub of node.anyOf) walk(sub, path);
    }
  }

  walk(schema, pathPrefix);
  return out.sort((a, b) => a.localeCompare(b));
}
