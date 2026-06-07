/**
 * Parse agentKbDialogIndexJson dal task agente.
 */

'use strict';

function parseKbDialogRuntimeIndex(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || parsed.schemaVersion !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

module.exports = {
  parseKbDialogRuntimeIndex,
};
