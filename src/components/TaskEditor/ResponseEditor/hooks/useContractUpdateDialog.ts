// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { mapNode, closeTab } from '../../../../dock/ops';
import DialogueTaskService from '../../../../services/DialogueTaskService';

export interface UseContractUpdateDialogParams {
  showContractDialog: boolean;
  setShowContractDialog: React.Dispatch<React.SetStateAction<boolean>>;
  pendingContractChange: {
    templateId: string;
    templateLabel: string;
    modifiedContract: any;
  } | null;
  setPendingContractChange: React.Dispatch<React.SetStateAction<{
    templateId: string;
    templateLabel: string;
    modifiedContract: any;
  } | null>>;
  contractChangeRef: React.MutableRefObject<{
    hasUnsavedChanges: boolean;
    modifiedContract: any;
    originalContract: any;
    nodeTemplateId: string | undefined;
    nodeLabel: string | undefined;
  }>;
  tabId: string | undefined;
  setDockTree: ((updater: (prev: any) => any) => void) | undefined;
  onClose?: () => void;
}

export interface UseContractUpdateDialogResult {
  handleKeep: () => void;
  handleDiscard: () => void;
  handleCancel: () => void;
}

/**
 * Hook that provides handlers for ContractUpdateDialog.
 */
export function useContractUpdateDialog(params: UseContractUpdateDialogParams): UseContractUpdateDialogResult {
  const {
    showContractDialog,
    setShowContractDialog,
    pendingContractChange,
    setPendingContractChange,
    contractChangeRef,
    tabId,
    setDockTree,
    onClose,
  } = params;

  const handleKeep = useCallback(() => {
    // Mantieni: chiudi editor, modifiche già in memoria (NON salvare nel DB)
    console.log('[ResponseEditor][DIALOG] ✅ Mantieni modifiche - chiudendo editor');
    setShowContractDialog(false);
    setPendingContractChange(null);
    contractChangeRef.current = {
      hasUnsavedChanges: false,
      modifiedContract: null,
      originalContract: null,
      nodeTemplateId: undefined,
      nodeLabel: undefined
    };

    // Chiudi tab
    if (tabId && setDockTree) {
      console.log('[ResponseEditor][DIALOG] Closing tab via setDockTree', { tabId });
      setDockTree(prev => closeTab(prev, tabId));
    } else if (onClose) {
      console.log('[ResponseEditor][DIALOG] Closing via onClose (legacy)');
      onClose();
    }
  }, [setShowContractDialog, setPendingContractChange, contractChangeRef, tabId, setDockTree, onClose]);

  const handleDiscard = useCallback(() => {
    // Scarta: ripristina originale in memoria, poi chiudi
    console.log('[ResponseEditor][DIALOG] ❌ Scarta modifiche - ripristinando originale');
    const template = DialogueTaskService.getTemplate(pendingContractChange?.templateId || '');
    if (template && contractChangeRef.current.originalContract !== undefined) {
      // Ripristina contract originale in memoria
      template.dataContract = contractChangeRef.current.originalContract
        ? JSON.parse(JSON.stringify(contractChangeRef.current.originalContract))
        : null;
      // Rimuovi template dalla lista dei modificati (è tornato allo stato originale)
      DialogueTaskService.clearModifiedTemplate(pendingContractChange?.templateId || '');
      console.log('[ResponseEditor][DIALOG] ✅ Template ripristinato in memoria', {
        templateId: pendingContractChange?.templateId,
        hasOriginalContract: !!contractChangeRef.current.originalContract
      });
    }

    setShowContractDialog(false);
    setPendingContractChange(null);
    contractChangeRef.current = {
      hasUnsavedChanges: false,
      modifiedContract: null,
      originalContract: null,
      nodeTemplateId: undefined,
      nodeLabel: undefined
    };

    // Chiudi tab
    if (tabId && setDockTree) {
      console.log('[ResponseEditor][DIALOG] Closing tab via setDockTree', { tabId });
      setDockTree(prev => closeTab(prev, tabId));
    } else if (onClose) {
      console.log('[ResponseEditor][DIALOG] Closing via onClose (legacy)');
      onClose();
    }
  }, [pendingContractChange, contractChangeRef, setShowContractDialog, setPendingContractChange, tabId, setDockTree, onClose]);

  const handleCancel = useCallback(() => {
    // Annulla: non chiudere editor
    console.log('[ResponseEditor][DIALOG] ⏸️ Annulla - non chiudere editor');
    setShowContractDialog(false);
    setPendingContractChange(null);
    // NON resettare contractChangeRef, così se riprova a chiudere ricompare il dialog
  }, [setShowContractDialog, setPendingContractChange]);

  return {
    handleKeep,
    handleDiscard,
    handleCancel,
  };
}
