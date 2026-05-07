'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Coercizione `req.body` guidata da JSON Schema OpenAPI 3 (tipi boolean / integer / number;
 * oggetti annidati con `properties`). Utile quando ConvAI/ElevenLabs inviano `"true"` al posto di `true`.
 *
 * @param {Record<string, unknown>} doc OpenAPI root document
 * @param {string} routePath es. `/api/runtime/bookfromagenda`
 * @param {string} method lowercase es. `post`
 * @param {unknown} body
 * @returns {unknown}
 */
function coerceRequestBodyByOpenApiOperation(doc, routePath, method, body) {
  if (!doc || typeof doc !== 'object') return body;
  const paths = doc.paths;
  if (!paths || typeof paths !== 'object') return body;
  const pathItem = paths[routePath];
  if (!pathItem || typeof pathItem !== 'object') return body;
  const op = pathItem[method.toLowerCase()];
  if (!op || typeof op !== 'object') return body;
  const rb = op.requestBody;
  if (!rb || typeof rb !== 'object') return body;
  const content = rb.content;
  if (!content || typeof content !== 'object') return body;
  const json =
    content['application/json'] ||
    content['application/*+json'] ||
    content[Object.keys(content).find((k) => k.includes('json')) || ''];
  if (!json || typeof json !== 'object') return body;
  const schema = json.schema;
  if (!schema) return body;
  return coerceInstanceByJsonSchema(body, schema, doc, 0);
}

/**
 * @param {unknown} rootDoc
 * @param {string} ref
 * @returns {unknown}
 */
function resolveJsonPointer(rootDoc, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return null;
  const parts = ref.slice(2).split('/');
  let cur = rootDoc;
  for (const p of parts) {
    const key = p.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!cur || typeof cur !== 'object' || !(key in cur)) return null;
    cur = cur[key];
  }
  return cur;
}

/**
 * @param {unknown} rootDoc
 * @param {unknown} schema
 * @param {number} depth
 * @returns {unknown}
 */
function resolveSchema(rootDoc, schema, depth) {
  if (depth > 24) return schema;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return schema;
  const ref = schema.$ref;
  if (typeof ref === 'string') {
    const resolved = resolveJsonPointer(rootDoc, ref);
    if (!resolved || typeof resolved !== 'object') return schema;
    return resolveSchema(rootDoc, resolved, depth + 1);
  }
  return schema;
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function coerceBooleanLoose(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const tr = value.trim().toLowerCase();
    if (tr === 'true' || tr === '1') return true;
    if (tr === 'false' || tr === '0') return false;
  }
  if (value === 1) return true;
  if (value === 0) return false;
  return value;
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function coerceIntegerLoose(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return parseInt(value, 10);
  return value;
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function coerceNumberLoose(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const t = value.trim();
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) return Number(t);
  }
  return value;
}

/**
 * @param {unknown} rootDoc
 * @param {unknown} schema
 * @param {unknown} value
 * @param {number} depth
 * @returns {unknown}
 */
function mergeAllOfSubSchemas(rootDoc, allOfList, depth) {
  const merged = { type: 'object', properties: {} };
  if (!Array.isArray(allOfList)) return merged;
  for (const sub of allOfList) {
    const r = resolveSchema(rootDoc, sub, depth);
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    if (r.properties && typeof r.properties === 'object') {
      merged.properties = { ...merged.properties, ...r.properties };
    }
    if (typeof r.type === 'string') merged.type = r.type;
  }
  return merged;
}

function coerceInstanceByJsonSchema(value, schema, rootDoc, depth) {
  if (depth > 32) return value;
  const sch = resolveSchema(rootDoc, schema, 0);
  if (!sch || typeof sch !== 'object' || Array.isArray(sch)) return value;

  if (Array.isArray(sch.allOf) && sch.allOf.length > 0) {
    const merged = mergeAllOfSubSchemas(rootDoc, sch.allOf, depth + 1);
    if (
      merged.properties &&
      Object.keys(merged.properties).length > 0 &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      return coerceObjectProperties(value, merged, rootDoc, depth + 1);
    }
  }

  if (Array.isArray(sch.oneOf) && sch.oneOf.length > 0) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const branch of sch.oneOf) {
        const br = resolveSchema(rootDoc, branch, 0);
        if (br && typeof br === 'object' && !Array.isArray(br) && br.type === 'object' && br.properties) {
          return coerceObjectProperties(value, br, rootDoc, depth + 1);
        }
      }
      return value;
    }
    for (const branch of sch.oneOf) {
      const br = resolveSchema(rootDoc, branch, 0);
      if (br && typeof br === 'object' && br.type === 'boolean') {
        return coerceBooleanLoose(value);
      }
    }
    return value;
  }

  const rawType = sch.type;
  const types = Array.isArray(rawType) ? rawType : rawType ? [rawType] : [];
  const primary = types.map((t) => String(t).toLowerCase())[0] || '';

  if (primary === 'array' && sch.items && Array.isArray(value)) {
    return value.map((item) => coerceInstanceByJsonSchema(item, sch.items, rootDoc, depth + 1));
  }

  if (primary === 'object' && sch.properties && value && typeof value === 'object' && !Array.isArray(value)) {
    return coerceObjectProperties(value, sch, rootDoc, depth + 1);
  }

  if (primary === 'boolean') return coerceBooleanLoose(value);
  if (primary === 'integer') return coerceIntegerLoose(value);
  if (primary === 'number') return coerceNumberLoose(value);

  return value;
}

/**
 * @param {Record<string, unknown>} obj
 * @param {Record<string, unknown>} schema
 * @param {unknown} rootDoc
 * @param {number} depth
 * @returns {Record<string, unknown>}
 */
function coerceObjectProperties(obj, schema, rootDoc, depth) {
  const sch = resolveSchema(rootDoc, schema, 0);
  const props = sch && typeof sch === 'object' && sch.properties && typeof sch.properties === 'object'
    ? sch.properties
    : {};
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
    const propSchema = props[key];
    out[key] = coerceInstanceByJsonSchema(out[key], propSchema, rootDoc, depth);
  }
  return out;
}

let cachedBookFromAgendaDoc = null;

function getBookFromAgendaOpenApiDoc() {
  if (cachedBookFromAgendaDoc) return cachedBookFromAgendaDoc;
  const specPath = path.join(__dirname, '..', 'services', 'bookFromAgenda.openapi.json');
  const buf = fs.readFileSync(specPath, 'utf8');
  cachedBookFromAgendaDoc = JSON.parse(buf);
  return cachedBookFromAgendaDoc;
}

/**
 * Coercizione body BookFromAgenda (POST) secondo lo spec locale.
 *
 * @param {unknown} body
 * @returns {unknown}
 */
function coerceBookFromAgendaRequestBody(body) {
  const doc = getBookFromAgendaOpenApiDoc();
  return coerceRequestBodyByOpenApiOperation(doc, '/api/runtime/bookfromagenda', 'post', body);
}

module.exports = {
  coerceRequestBodyByOpenApiOperation,
  coerceBookFromAgendaRequestBody,
  coerceInstanceByJsonSchema,
  resolveSchema,
  getBookFromAgendaOpenApiDoc,
};
