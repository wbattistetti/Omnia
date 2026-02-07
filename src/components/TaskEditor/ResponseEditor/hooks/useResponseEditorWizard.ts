/**
 * useResponseEditorWizard
 *
 * Custom hook that manages ContractWizard logic for ResponseEditor.
 * Extracted from index.tsx to improve maintainability and separation of concerns.
 *
 * NOTE: TaskWizard is now external (TaskTreeWizardModal) and no longer managed here.
 *
 * This hook handles:
 * - ContractWizard handlers (onComplete, onClose, onNodeUpdate)
 */

import { useCallback } from 'react';
import { info } from '@utils/logger';

export interface UseResponseEditorWizardProps {
  showContractWizard: boolean;
  setShowContractWizard: (value: boolean) => void;
  setTaskTreeVersion: React.Dispatch<React.SetStateAction<number>>;
}

export interface UseResponseEditorWizardResult {
  handleGenerateAll: () => void;
  handleContractWizardClose: () => void;
  handleContractWizardNodeUpdate: (nodeId: string) => void;
  handleContractWizardComplete: (results: any) => void;
}

/**
 * Hook that manages ContractWizard logic for ResponseEditor
 */
export function useResponseEditorWizard({
  showContractWizard,
  setShowContractWizard,
  setTaskTreeVersion,
}: UseResponseEditorWizardProps): UseResponseEditorWizardResult {

  // ✅ Handler for Generate All button (opens ContractWizard)
  const handleGenerateAll = useCallback(() => {
    setShowContractWizard(true);
  }, [setShowContractWizard]);

  // ✅ Handler for ContractWizard close
  const handleContractWizardClose = useCallback(() => {
    setShowContractWizard(false);
  }, [setShowContractWizard]);

  // ✅ Handler for ContractWizard node update
  const handleContractWizardNodeUpdate = useCallback((nodeId: string) => {
    // ✅ Trigger refresh of parser status in Sidebar
    info('RESPONSE_EDITOR', 'Node updated in ContractWizard', { nodeId });
    // Force re-render of Sidebar to show updated parser status
    setTaskTreeVersion(v => v + 1);
  }, [setTaskTreeVersion]);

  // ✅ Handler for ContractWizard complete
  const handleContractWizardComplete = useCallback((results: any) => {
    info('RESPONSE_EDITOR', 'Contract wizard completed', { results });
    setShowContractWizard(false);
    // Force re-render of Sidebar to show updated parser status
    setTaskTreeVersion(v => v + 1);
  }, [setShowContractWizard, setTaskTreeVersion]);

  return {
    handleGenerateAll,
    handleContractWizardClose,
    handleContractWizardNodeUpdate,
    handleContractWizardComplete,
  };
}
