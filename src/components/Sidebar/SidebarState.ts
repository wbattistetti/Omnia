import { useState } from 'react';

/**
 * Stato centralizzato per Sidebar (top engineered):
 * - accordion aperto (solo uno)
 * - builder/modal attivo
 * - editing label (categoria/voce)
 * - conferma cancellazione (categoria/voce)
 * - search term
 * - sidebar width/font size
 * - spinner salvataggio
 * TODO: estendere con altri campi se necessario
 */
export interface SidebarState {
  openAccordion: string;
  activeBuilder: string | null;
  editingLabelId: string | null;
  editingLabelValue: string;
  confirmDeleteId: string | null;
  searchTerm: string;
  sidebarWidth: number;
  fontSize: number;
  isSaving: boolean;
}

export function useSidebarState(initialAccordion: string = 'agentActs') {
  const [state, setState] = useState<SidebarState>({
    openAccordion: initialAccordion,
    activeBuilder: null,
    editingLabelId: null,
    editingLabelValue: '',
    confirmDeleteId: null,
    searchTerm: '',
    sidebarWidth: 320,
    fontSize: 16,
    isSaving: false,
  });

  // TODO: aggiungi qui tutte le funzioni di update/setter centralizzate

  return [state, setState] as const;
}