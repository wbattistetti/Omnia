// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback, useMemo } from 'react';
import type { TaskTree } from '@types/taskTypes';
import type { WizardTaskTreeNode } from '../types';
import { convertTaskTreeToWizardTaskTree } from '@components/TaskTreeBuilder/TaskBuilderAIWizardAdapter';
import { generateVariableNames, applyVariableNamesToStructure } from '../services/VariableNameGeneratorService';
import { syncTranslationsWithStructure } from '../services/TranslationSyncService';
import { variableCreationService } from '@services/VariableCreationService';
import { commitWizardStructureToEditor } from '@utils/wizard/wizardStructureFromTaskTree';

type UseWizardSyncProps = {
  taskTree?: TaskTree | null | undefined;
  /** Deprecated local wizard state (useWizardState); used when TaskTree is empty */
  legacyWizardRoots?: WizardTaskTreeNode[];
  replaceSelectedTaskTree?: (taskTree: TaskTree) => void;
  taskLabel: string;
  rowId?: string;
  projectId?: string;
  locale: string;
};

/**
 * Variable name synchronisation during the wizard structure proposal phase.
 * PR2: Writes through the same TaskTree pipeline as manual (Zustand + replaceSelectedTaskTree).
 */
export function useWizardSync(props: UseWizardSyncProps) {
  const {
    taskTree,
    legacyWizardRoots,
    replaceSelectedTaskTree,
    taskLabel,
    rowId,
    projectId,
    locale,
  } = props;

  const syncVariables = useCallback(async () => {
    const wizardNodes = taskTree?.nodes?.length
      ? convertTaskTreeToWizardTaskTree(taskTree)
      : (legacyWizardRoots && legacyWizardRoots.length > 0 ? legacyWizardRoots : []);

    if (!wizardNodes.length || !rowId) {
      return;
    }

    try {
      const existingVariables = projectId
        ? variableCreationService.getAllVarNames(projectId)
        : [];
      const variableNames = generateVariableNames(wizardNodes, taskLabel.trim(), existingVariables);
      applyVariableNamesToStructure(wizardNodes, variableNames, rowId);

      if (projectId) {
        await syncTranslationsWithStructure(wizardNodes, projectId, locale);
      }

      commitWizardStructureToEditor(wizardNodes, {
        taskLabel,
        replaceSelectedTaskTree,
      });
    } catch (error) {
      console.error('[useWizardSync] Error during variable name synchronisation:', error);
    }
  }, [taskTree, legacyWizardRoots, taskLabel, rowId, projectId, locale, replaceSelectedTaskTree]);

  return useMemo(() => ({ syncVariables }), [syncVariables]);
}
