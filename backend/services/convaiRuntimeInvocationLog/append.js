/**
 * Append record V2 al log runtime ConvAI.
 */

'use strict';

const { readLog, writeLog, MAX_RECORDS } = require('./persist');
const { normalizeConvaiRuntimeInvocation } = require('./normalize');

/**
 * @param {object} draft
 * @returns {object|null}
 */
function appendConvaiRuntimeInvocation(draft) {
  try {
    const record = normalizeConvaiRuntimeInvocation(draft);
    const log = readLog();
    const next = [record, ...log.records].slice(0, MAX_RECORDS);
    writeLog({ records: next });
    return record;
  } catch (err) {
    console.warn('[convai-runtime-log] append failed:', err.message);
    return null;
  }
}

module.exports = { appendConvaiRuntimeInvocation };
