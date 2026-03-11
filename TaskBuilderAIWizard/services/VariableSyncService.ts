// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { WizardTaskTreeNode } from '../types';

/**
 * VariableSyncService
 *
 * Previously responsible for registering variable name mappings in the old
 * FlowchartVariablesService during the wizard structure proposal phase.
 *
 * In the new architecture, variables are created in TemplateCloningService
 * (the single authoritative creation point) after the user confirms the
 * structure. This function is kept as a no-op placeholder so call-sites do
 * not need to be changed immediately; it can be removed once all callers
 * have been updated.
 */
export async function syncVariablesWithStructure(
  _structure: WizardTaskTreeNode[],
  _rowId: string,
  _taskLabel: string
): Promise<void> {
  // No-op: variable creation is now handled by TemplateCloningService.
}
