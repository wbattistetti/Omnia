/**
 * Log diagnostici catalogo IA (mai segreti: niente chiavi API in chiaro).
 */

'use strict';

/**
 * @param {string} event
 * @param {Record<string, unknown>} fields
 */
function diag(event, fields) {
  try {
    console.log(`[iaCatalog:${event}]`, JSON.stringify(fields));
  } catch {
    console.log(`[iaCatalog:${event}]`, fields);
  }
}

module.exports = { diag };
