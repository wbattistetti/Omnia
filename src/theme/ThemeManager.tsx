import React, { createContext, useContext, useState, useCallback } from 'react';
import { sidebarTheme } from '../components/Sidebar/sidebarTheme';

// Tipi semplici
interface SidebarColors {
  agentActs: string;
  userActs: string;
  backendActions: string;
  conditions: string;
  tasks: string;
  macrotasks: string;
}

interface ThemeContextType {
  // Colori attuali
  colors: SidebarColors;
  
  // Modalità editing
  isEditMode: boolean;
  toggleEditMode: () => void;
  
  // Funzioni per modificare i colori
  updateColor: (entityType: keyof SidebarColors, color: string) => void;
  resetColors: () => void;
  
  // Editor modale
  isEditorOpen: boolean;
  editingEntity: keyof SidebarColors | null;
  targetElement: HTMLElement | null;
  openEditor: (entityType: keyof SidebarColors, element: HTMLElement) => void;
  closeEditor: () => void;
  applyChanges: (color: string) => void;
  cancelChanges: () => void;
  
  // Preview in tempo reale
  previewColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Colori di default
const defaultColors: SidebarColors = {
  agentActs: sidebarTheme.agentActs.color,
  userActs: sidebarTheme.userActs.color,
  backendActions: sidebarTheme.backendActions.color,
  conditions: sidebarTheme.conditions.color,
  tasks: sidebarTheme.tasks.color,
  macrotasks: sidebarTheme.macrotasks.color,
};

export const ThemeManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Stato dei colori
  const [colors, setColors] = useState<SidebarColors>(defaultColors);
  
  // Modalità editing
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Editor modale
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<keyof SidebarColors | null>(null);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [originalColor, setOriginalColor] = useState<string>('');

  // Toggle modalità editing
  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
  }, []);

  // Aggiorna colore
  const updateColor = useCallback((entityType: keyof SidebarColors, color: string) => {
    setColors(prev => ({
      ...prev,
      [entityType]: color
    }));
  }, []);

  // Reset colori
  const resetColors = useCallback(() => {
    setColors(defaultColors);
  }, []);

  // Apri editor
  const openEditor = useCallback((entityType: keyof SidebarColors, element: HTMLElement) => {
    setEditingEntity(entityType);
    setTargetElement(element);
    setOriginalColor(colors[entityType]);
    setIsEditorOpen(true);
  }, [colors]);

  // Chiudi editor
  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
    setEditingEntity(null);
    setTargetElement(null);
    setOriginalColor('');
  }, []);

  // Applica modifiche
  const applyChanges = useCallback((color: string) => {
    if (editingEntity) {
      updateColor(editingEntity, color);
    }
    closeEditor();
  }, [editingEntity, updateColor, closeEditor]);

  // Annulla modifiche
  const cancelChanges = useCallback(() => {
    if (editingEntity && originalColor) {
      updateColor(editingEntity, originalColor);
    }
    closeEditor();
  }, [editingEntity, originalColor, updateColor, closeEditor]);

  // Preview in tempo reale
  const previewColor = useCallback((color: string) => {
    if (editingEntity) {
      updateColor(editingEntity, color);
    }
  }, [editingEntity, updateColor]);

  const value: ThemeContextType = {
    colors,
    isEditMode,
    toggleEditMode,
    updateColor,
    resetColors,
    isEditorOpen,
    editingEntity,
    targetElement,
    openEditor,
    closeEditor,
    applyChanges,
    cancelChanges,
    previewColor,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeManager = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeManager must be used within a ThemeManagerProvider');
  }
  return context;
}; 