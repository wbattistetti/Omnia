import { useSelectionVisuals } from './hooks/useSelectionVisuals';

// Use selection visuals hook
const { 
  persistedSel, 
  setPersistedSel, 
  dragStartRef, 
  handleSelectionMouseDown, 
  handleSelectionMouseUp 
} = useSelectionVisuals();
