/**
 * Estrae dialogStatus dalla risposta omnia_dialog_step.
 */

'use strict';

const { DIALOG_STATUS } = require('./types');

/**
 * @param {unknown} responseBody
 * @returns {string|null}
 */
function extractDialogStatus(responseBody) {
  if (!responseBody || typeof responseBody !== 'object' || Array.isArray(responseBody)) {
    return null;
  }
  const status = String(responseBody.status ?? '').trim();
  if (DIALOG_STATUS.has(status)) return status;
  return null;
}

/**
 * @param {string|null|undefined} preview
 * @returns {string|null}
 */
function extractDialogStatusFromPreview(preview) {
  if (!preview || typeof preview !== 'string') return null;
  try {
    return extractDialogStatus(JSON.parse(preview));
  } catch {
    return null;
  }
}

module.exports = { extractDialogStatus, extractDialogStatusFromPreview };
