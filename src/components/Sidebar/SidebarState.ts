import { create } from 'zustand';

interface SidebarState {
  openAccordion: string | null;
  isCollapsed: boolean;
  editingId: string | null;
  confirmingDeleteId: string | null;
  activeBuilder: string | null;
  searchTerm: string;
  sidebarWidth: number;
  setOpenAccordion: (id: string | null) => void;
  toggleCollapse: () => void;
  setEditingId: (id: string | null) => void;
  setConfirmingDeleteId: (id: string | null) => void;
  setActiveBuilder: (id: string | null) => void;
  setSearchTerm: (term: string) => void;
  setSidebarWidth: (width: number) => void;
}

export const useSidebarState = create<SidebarState>((set) => ({
  openAccordion: null,
  isCollapsed: false,
  editingId: null,
  confirmingDeleteId: null,
  activeBuilder: null,
  searchTerm: '',
  sidebarWidth: 400,
  setOpenAccordion: (id) => set({ openAccordion: id }),
  toggleCollapse: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  setEditingId: (id) => set({ editingId: id }),
  setConfirmingDeleteId: (id) => set({ confirmingDeleteId: id }),
  setActiveBuilder: (id) => set({ activeBuilder: id }),
  setSearchTerm: (term) => set({ searchTerm: term }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
}));