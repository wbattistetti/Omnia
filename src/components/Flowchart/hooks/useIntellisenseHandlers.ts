import { useCallback } from 'react';

export function useIntellisenseHandlers(
  nodeIntellisenseTarget: string | null,
  setNodes: any,
  setShowNodeIntellisense: any,
  setNodeIntellisenseTarget: any
) {
  // Handler per gestire selezione items nell'IntellisenseMenu
  const handleIntellisenseSelect = useCallback((item: any) => {
    if (!nodeIntellisenseTarget) return;
    
    console.log("✅ [INTELLISENSE] Item selected:", { 
      item, 
      targetNode: nodeIntellisenseTarget,
      timestamp: Date.now()
    });
    
    // Aggiorna la prima riga del nodo temporaneo con l'item selezionato
    setNodes(nds => nds.map(n => {
      if (n.id === nodeIntellisenseTarget) {
        const updatedRows = [{ 
          id: `${nodeIntellisenseTarget}-1`, 
          text: item.label || item.value || item,
          included: true,
          mode: 'Message'
        }];
        
        return {
          ...n,
          data: {
            ...n.data,
            rows: updatedRows
          }
        };
      }
      return n;
    }));
    
    // Chiudi il menu
    setShowNodeIntellisense(false);
    setNodeIntellisenseTarget(null);
    
  }, [nodeIntellisenseTarget, setNodes, setShowNodeIntellisense, setNodeIntellisenseTarget]);
  
  // Handler per chiudere l'IntellisenseMenu
  const handleIntellisenseClose = useCallback(() => {
    setShowNodeIntellisense(false);
    setNodeIntellisenseTarget(null);
  }, [setShowNodeIntellisense, setNodeIntellisenseTarget]);

  return {
    handleIntellisenseSelect,
    handleIntellisenseClose
  };
}
