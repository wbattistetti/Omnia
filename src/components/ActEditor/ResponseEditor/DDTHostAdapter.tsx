import React from 'react';
import type { EditorProps } from '../EditorHost/types';
import ResponseEditor from './index';
import { useDDTManager } from '../../../context/DDTManagerContext';

export default function DDTHostAdapter({ act, onClose }: EditorProps){
  const { openDDT } = useDDTManager();
  
  const placeholder = React.useMemo(() => ({
    id: `temp_ddt_${act.id}`,
    label: act.label || 'Data',
    _userLabel: act.label,  // Preserve user's original input for header display
    _sourceAct: { id: act.id, label: act.label, type: act.type },  // Preserve act info for header display
    mainData: []
  }), [act.id, act.label, act.type]);
  
  // When ResponseEditor completes wizard and has a final DDT:
  // 1. Close ActEditorOverlay (this component)
  // 2. Open DDT in DDTManager (which will mount ResizableResponseEditor in AppContent)
  const handleComplete = React.useCallback((finalDDT: any) => {
    console.log('[DDTHostAdapter][complete]', {
      ddtId: finalDDT?.id || finalDDT?._id,
      ddtLabel: finalDDT?.label,
      action: 'closing ActEditorOverlay and opening in DDTManager'
    });
    
    // Close this overlay first
    if (onClose) onClose();
    
    // Then open in DDTManager (AppContent will mount ResizableResponseEditor)
    if (finalDDT) {
      setTimeout(() => {
        openDDT(finalDDT);
      }, 50);
    }
  }, [onClose, openDDT]);
  
  return (
    <ResponseEditor 
      ddt={placeholder} 
      onClose={onClose}
      onWizardComplete={handleComplete}
      act={act}
    />
  );
}


