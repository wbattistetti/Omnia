// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Converts UICode (with [label] placeholders) to ExecCode (with ctx["guid"])
 * Used when saving conditions to database
 */
export function convertUICodeToExecCode(
  uiCode: string,
  variableMappings: Map<string, string> // Map<guid, label>
): string {
  if (!uiCode || typeof uiCode !== 'string') {
    return uiCode;
  }

  // Replace [label] with ctx["guid"]
  return uiCode.replace(/\[\s*([A-Za-z0-9 _-]+)\s*\]/g, (match, label) => {
    // Find guid by label (reverse lookup)
    const guid = Array.from(variableMappings.entries()).find(
      ([g, l]) => l === label
    )?.[0];

    if (!guid) {
      console.warn(`[ConditionCodeConverter] Variable [${label}] not found in mappings`);
      return match; // Keep original if not found
    }

    return `ctx["${guid}"]`;
  });
}

/**
 * Converts ExecCode (with ctx["guid"]) to UICode (with [label] placeholders)
 * Used when loading conditions from database for display in editor
 */
export function convertExecCodeToUICode(
  execCode: string,
  variableMappings: Map<string, string> // Map<guid, label>
): string {
  if (!execCode || typeof execCode !== 'string') {
    return execCode;
  }

  // Replace ctx["guid"] with [label]
  return execCode.replace(/ctx\["([^"]+)"\]/g, (match, guid) => {
    const label = variableMappings.get(guid);

    if (!label) {
      console.warn(`[ConditionCodeConverter] GUID ${guid} not found in mappings`);
      return match; // Keep original if not found
    }

    return `[${label}]`;
  });
}

/**
 * Creates variable mappings from FlowchartVariablesService
 * Returns Map<guid, label> for conversion
 */
export function createVariableMappings(): Map<string, string> {
  const mappings = new Map<string, string>();

  try {
    const { flowchartVariablesService } = require('../services/FlowchartVariablesService');

    // Use nodeIdToReadableName map directly (nodeId -> readableName)
    // We need to access the private map, so we'll use a helper method if available
    // For now, iterate through all readable names and get their nodeIds
    const allReadableNames = flowchartVariablesService.getAllReadableNames?.() || [];

    for (const readableName of allReadableNames) {
      const nodeId = flowchartVariablesService.getNodeId(readableName);
      if (nodeId) {
        mappings.set(nodeId, readableName);
      }
    }
  } catch (error) {
    console.warn('[ConditionCodeConverter] Could not load variable mappings', error);
  }

  return mappings;
}
