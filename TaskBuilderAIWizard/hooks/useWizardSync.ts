// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import type { WizardTaskTreeNode } from '../types';
import { generateVariableNames, applyVariableNamesToStructure } from '../services/VariableNameGeneratorService';
import { syncTranslationsWithStructure } from '../services/TranslationSyncService';
import { syncVariablesWithStructure } from '../services/VariableSyncService';
import { flowchartVariablesService } from '@services/FlowchartVariablesService';

type UseWizardSyncProps = {
  dataSchema: WizardTaskTreeNode[];
  setDataSchema: (schema: WizardTaskTreeNode[] | ((prev: WizardTaskTreeNode[]) => WizardTaskTreeNode[])) => void;
  taskLabel: string;
  rowId?: string; // ✅ ALWAYS equals row.id (which equals task.id when task exists)
  projectId?: string;
  locale: string;
};

/**
 * Hook che gestisce SOLO la sincronizzazione delle variabili.
 * Nessuna pipeline, nessuna transizione wizardMode, nessuna creazione template.
 */
export function useWizardSync(props: UseWizardSyncProps) {
  const {
    dataSchema,
    setDataSchema,
    taskLabel,
    rowId, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
    projectId,
    locale,
  } = props;

  /**
   * Sincronizza variabili dopo la generazione della struttura
   * - Genera readableName e dottedName
   * - Applica nomi alla struttura
   * - Sincronizza con Translations (se projectId disponibile)
   * - Sincronizza con FlowchartVariablesService
   * - Aggiorna dataSchema con nomi variabili
   */
  const syncVariables = useCallback(async () => {
    if (!dataSchema || dataSchema.length === 0 || !rowId) {
      return;
    }

    try {
      // 1. Genera readableName e dottedName
      const existingVariables = flowchartVariablesService.getAllReadableNames();
      const variableNames = generateVariableNames(dataSchema, taskLabel.trim(), existingVariables);

      // 2. Applica nomi alla struttura
      const schemaWithNames = [...dataSchema];
      applyVariableNamesToStructure(schemaWithNames, variableNames, rowId); // ✅ ALWAYS equals row.id

      // 3. Sincronizza con Translations (se projectId disponibile)
      if (projectId) {
        await syncTranslationsWithStructure(schemaWithNames, projectId, locale);
      }

      // 4. Sincronizza con FlowchartVariablesService
      await syncVariablesWithStructure(schemaWithNames, rowId, taskLabel.trim()); // ✅ rowId equals row.id which equals task.id

      // 5. Aggiorna dataSchema con nomi variabili
      setDataSchema(schemaWithNames);
    } catch (error) {
      console.error('[useWizardSync] ❌ Errore nella generazione variabili/sincronizzazione:', error);
      // Continua comunque: la struttura è stata generata
    }
  }, [dataSchema, taskLabel, rowId, projectId, locale, setDataSchema]);

  return {
    syncVariables,
  };
}
