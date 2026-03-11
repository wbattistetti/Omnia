// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback, useMemo } from 'react';
import type { WizardTaskTreeNode } from '../types';
import { generateVariableNames, applyVariableNamesToStructure } from '../services/VariableNameGeneratorService';
import { syncTranslationsWithStructure } from '../services/TranslationSyncService';
import { variableCreationService } from '@services/VariableCreationService';

type UseWizardSyncProps = {
  dataSchema: WizardTaskTreeNode[];
  setDataSchema: (schema: WizardTaskTreeNode[] | ((prev: WizardTaskTreeNode[]) => WizardTaskTreeNode[])) => void;
  taskLabel: string;
  rowId?: string; // ALWAYS equals row.id (which equals task.id when task exists)
  projectId?: string;
  locale: string;
};

/**
 * Hook that manages variable name synchronisation during the wizard structure
 * proposal phase.
 *
 * Responsibilities:
 * 1. Generate readableName / dottedName for each node in the dataSchema.
 * 2. Apply those names back onto the schema so the wizard sidebar shows them.
 * 3. Sync translation keys for the new variable names.
 *
 * Variable creation (varId, DB persistence) is handled later by
 * TemplateCloningService when the user confirms the structure.
 */
export function useWizardSync(props: UseWizardSyncProps) {
  const {
    dataSchema,
    setDataSchema,
    taskLabel,
    rowId,
    projectId,
    locale,
  } = props;

  const syncVariables = useCallback(async () => {
    if (!dataSchema || dataSchema.length === 0 || !rowId) {
      return;
    }

    try {
      // 1. Collect already-known variable names to avoid collisions
      const existingVariables = projectId
        ? variableCreationService.getAllVarNames(projectId)
        : [];

      // 2. Generate readable / dotted names for the proposed structure
      const variableNames = generateVariableNames(dataSchema, taskLabel.trim(), existingVariables);

      // 3. Apply names onto the schema nodes
      const schemaWithNames = [...dataSchema];
      applyVariableNamesToStructure(schemaWithNames, variableNames, rowId);

      // 4. Sync translation keys for the new variable names
      if (projectId) {
        await syncTranslationsWithStructure(schemaWithNames, projectId, locale);
      }

      // 5. Commit updated schema
      setDataSchema(schemaWithNames);
    } catch (error) {
      console.error('[useWizardSync] Error during variable name synchronisation:', error);
    }
  }, [dataSchema, taskLabel, rowId, projectId, locale, setDataSchema]);

  // Stable reference: prevents spurious re-runs of effects that depend on this hook.
  return useMemo(() => ({ syncVariables }), [syncVariables]);
}
