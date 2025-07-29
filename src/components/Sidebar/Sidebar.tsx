// Sidebar.tsx
// Sidebar component for project structure navigation and DDT management.
// Features: search/filter, font resize, resizable width, DDT builder, memoized category rendering.

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Search, Settings, ChevronLeft, ChevronRight, Bot, User, Database, GitBranch, CheckSquare, Layers, Puzzle, Square, Plus, Calendar, Mail, MapPin, FileText, Trash2 } from 'lucide-react';
import { useProjectData, useProjectDataUpdate } from '../../context/ProjectDataContext';
import Accordion from './Accordion';
import CategoryItem from './CategoryItem';
import { AddButton } from './AddButton';
import { EntityType } from '../../types/project';
import { useSidebarTheme } from './SidebarThemeContext';
import { getAllDialogueTemplates } from '../../services/ProjectDataService';
import DDTBuilder from '../DialogueDataTemplateBuilder/DDTBuilder';
import { useFilteredProjectData } from './useFilteredProjectData';

// Configuration for each entity type in the sidebar
const entityConfig = {
  agentActs: { 
    title: 'Agent Acts', 
    icon: <Bot className="w-5 h-5 text-purple-400" /> 
  },
  userActs: { 
    title: 'User Acts', 
    icon: <User className="w-5 h-5 text-green-400" /> 
  },
  backendActions: { 
    title: 'Backend Actions', 
    icon: <Database className="w-5 h-5 text-blue-400" /> 
  },
  conditions: { 
    title: 'Conditions', 
    icon: <GitBranch className="w-5 h-5 text-yellow-400" /> 
  },
  tasks: { 
    title: 'Tasks', 
    icon: <CheckSquare className="w-5 h-5 text-orange-400" /> 
  },
  macrotasks: { 
    title: 'Macrotasks', 
    icon: <Layers className="w-5 h-5 text-red-400" /> 
  }
};

interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenDDTEditor?: (ddt: any, translations: any, lang: string) => void;
  openedDDTId?: string | null;
  onDeleteDDT?: (ddtId: string) => void;
  dialogueTemplates: any[];
  setDialogueTemplates: React.Dispatch<React.SetStateAction<any[]>>;
}

const MIN_WIDTH = 320; // px (w-80)
// Font resize constants
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 24;
const DEFAULT_FONT_SIZE = 16;

/**
 * Sidebar component for project navigation and DDT management.
 * - Displays project entities (Agent Acts, User Acts, etc.) in accordions.
 * - Allows searching/filtering entities and categories.
 * - Supports font resizing (Ctrl + mouse wheel).
 * - Sidebar width is resizable by dragging the right edge.
 * - Data Dialogue Templates (DDT) are managed in a dedicated accordion.
 * - Uses memoized components (Accordion, CategoryItem) for performance.
 */
export const Sidebar: React.FC<SidebarProps> = ({ 
  isCollapsed = false, 
  onToggleCollapse,
  onOpenDDTEditor,
  openedDDTId,
  onDeleteDDT,
  dialogueTemplates,
  setDialogueTemplates
}) => {
  // Project data and update handlers from context
  const { data, loading, error } = useProjectData();
  const { 
    addCategory, 
    deleteCategory, 
    updateCategory, 
    addItem, 
    deleteItem, 
    updateItem 
  } = useProjectDataUpdate();
  
  // Custom hook: handles search/filter logic and exposes filteredData, searchTerm, setSearchTerm
  const { filteredData, searchTerm, setSearchTerm } = useFilteredProjectData(data);

  // State for DDT templates and UI
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string>('agentActs');
  const [sidebarWidth, setSidebarWidth] = useState(MIN_WIDTH);
  const isResizing = useRef(false);
  // Font size state for Ctrl+wheel zoom
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const sidebarRef = useRef<HTMLDivElement>(null);
  // Confirm dialog for DDT deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  // Show/hide DDTBuilder inline
  const [showDDTBuilder, setShowDDTBuilder] = useState(false);
  // Stato per mostrare il wizard dopo apertura accordion
  const [pendingShowWizard, setPendingShowWizard] = useState(false);
  // Ref per ogni card DDT per scroll automatico
  const cardRefs = useRef<{ [id: string]: HTMLDivElement | null }>({});
  useEffect(() => {
    if (showDeleteConfirm && cardRefs.current[showDeleteConfirm]) {
      cardRefs.current[showDeleteConfirm]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [showDeleteConfirm]);

  // Font resize: handle Ctrl+wheel to zoom font size
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setFontSize((prev) => {
          let next = prev + (e.deltaY < 0 ? 1 : -1);
          next = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, next));
          return next;
        });
      }
    };
    const node = sidebarRef.current;
    if (node) node.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      if (node) node.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Fetch DDT templates from backend on mount
  // useEffect(() => {
  //   setLoadingTemplates(true);
  //   getAllDialogueTemplates()
  //     .then((data) => {
  //       setDialogueTemplates(data);
  //     })
  //     .catch((err) => {
  //       setDialogueTemplates([]);
  //     })
  //     .finally(() => {
  //       setLoadingTemplates(false);
  //     });
  // }, []);

  // Sidebar width resize logic
  const handleMouseDown = () => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
  };
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = Math.max(MIN_WIDTH, e.clientX);
    setSidebarWidth(newWidth);
  }, []);
  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = '';
  }, []);
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Loading and error states
  if (loading) {
    return (
      <div className={`bg-slate-800 border-r border-slate-700 flex items-center justify-center ${
        isCollapsed ? 'w-12' : 'w-80'
      } transition-all duration-300`}>
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className={`bg-slate-800 border-r border-slate-700 flex items-center justify-center ${
        isCollapsed ? 'w-12' : 'w-80'
      } transition-all duration-300`}>
        <div className="text-red-400 text-sm p-4">Error: {error}</div>
      </div>
    );
  }
  if (!data) {
    return null;
  }

  // Handler for DDT deletion (in-memory only)
  const handleDeleteDDT = (ddtId: string) => {
    setDialogueTemplates((prev) => prev.filter(dt => (dt._id || dt.id) !== ddtId));
    setShowDeleteConfirm(null);
    if (onDeleteDDT) {
      onDeleteDDT(ddtId);
    }
    // TODO: trigger toast/snackbar "Template eliminato" se vuoi feedback
  };

  // Handler to open the DDT editor (calls parent prop)
  const handleOpenDDTEditor = (ddt: any, translations: any, lang: any) => {
    if (onOpenDDTEditor) onOpenDDTEditor(ddt, translations, lang);
  };
  // Handler per chiudere il ResponseEditor non serve più qui

  // useEffect per mostrare il wizard dopo apertura accordion
  useEffect(() => {
    if (pendingShowWizard && openAccordion === 'dataDialogueTemplates') {
      setShowDDTBuilder(true);
      setPendingShowWizard(false);
    }
  }, [pendingShowWizard, openAccordion]);

  // Logga la lista ogni volta che cambia
  useEffect(() => {
    console.log('LISTA DDT aggiornata:', dialogueTemplates);
  }, [dialogueTemplates]);

  // Handler per aggiunta DDT dal wizard
  const handleAddDDT = (newDDT: any) => {
    setDialogueTemplates(prev => {
      const next = [...prev, newDDT];
      console.log('LISTA DDT dopo aggiunta:', next);
      return next;
    });
    setShowDDTBuilder(false);
    if (onOpenDDTEditor) onOpenDDTEditor(newDDT, {}, 'it');
  };

  // Collapsed sidebar UI (icons only)
  if (isCollapsed) {
    return (
      <div
        ref={sidebarRef}
        style={{ fontSize: `${fontSize}px` }}
        className="w-12 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-4 transition-all duration-300">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-slate-400 hover:text-white transition-colors mb-4"
          title="Expand sidebar"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        {/* Entity icons */}
        {Object.entries(entityConfig).map(([key, config]) => (
          <div key={key} className="mb-3" title={config.title}>
            {config.icon}
          </div>
        ))}
      </div>
    );
  }

  // Main sidebar UI
  return (
    <div
      ref={sidebarRef}
      style={{ width: sidebarWidth, minWidth: MIN_WIDTH, fontSize: `${fontSize}px`, color: '#111', background: '#f7f7fa', border: '1px solid #111' }}
      className="flex flex-col transition-all duration-100 relative">
      {/* Header: project structure, collapse/settings, entity icons */}
      <div className="p-4 border-b border-slate-300">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Project Structure</h2>
          <div className="flex items-center space-x-2">
            <button
              className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Large entity icons row */}
        <div className="flex gap-4 justify-center items-center py-3 border-b" style={{ background: '#fff', borderBottom: '1px solid #111' }}>
          <div className="flex flex-col items-center">
            <div className="rounded-full bg-violet-100 p-3 border border-violet-300">
              <Layers className="w-7 h-7 text-violet-700" />
            </div>
            <span className="text-xs text-violet-700 mt-1">MacroTask</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="rounded-full bg-blue-100 p-3 border border-blue-300">
              <CheckSquare className="w-7 h-7 text-blue-700" />
            </div>
            <span className="text-xs text-blue-700 mt-1">Task</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="rounded-full bg-gray-100 p-3 border border-gray-300">
              <Square className="w-7 h-7 text-gray-700" />
            </div>
            <span className="text-xs text-gray-700 mt-1">Nodo</span>
          </div>
        </div>
        {/* Search input for filtering entities/categories */}
        <div className="relative mt-2 mb-2">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search entities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>
      </div>

      {/* Main content: DDT accordion and entity accordions */}
      <div className="flex-1 p-4">
        {/* Data Dialogue Templates (DDT) accordion */}
        <Accordion
          title="Data Dialogue Templates"
          icon={<Puzzle className="w-5 h-5 text-fuchsia-400" />}
          isOpen={openAccordion === 'dataDialogueTemplates'}
          onToggle={() => {
            setOpenAccordion(openAccordion === 'dataDialogueTemplates' ? '' : 'dataDialogueTemplates');
          }}
          bgColor={{ header: '#a21caf', light: '#f3e8ff' }}
          action={
            <button
              className="p-1 text-fuchsia-500 hover:text-fuchsia-700 transition-colors"
              title="Aggiungi DDT"
              onClick={e => {
                e.stopPropagation();
                if (openAccordion !== 'dataDialogueTemplates') {
                  setOpenAccordion('dataDialogueTemplates');
                  setPendingShowWizard(true);
                } else if (!showDDTBuilder) {
                  setShowDDTBuilder(true);
                }
              }}
            >
              <Plus className="w-5 h-5" />
            </button>
          }
        >
          {/* DDT list and builder */}
          {/* Wizard SEMPRE fuori dal div scrollabile */}
          {showDDTBuilder && (
            <div style={{
              background: '#f3e8ff',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: 8,
              marginBottom: 8,
              borderRadius: 8,
            }}>
              <DDTBuilder
                onComplete={handleAddDDT}
                onCancel={() => setShowDDTBuilder(false)}
              />
            </div>
          )}
          {/* Lista scrollabile dei template */}
          <div>
            {dialogueTemplates.map((dt, idx) => {
              // Scegli icona in base al tipo/label
              let icon = <FileText className="w-5 h-5 text-fuchsia-700" />;
              if (/date/i.test(dt.label)) icon = <Calendar className="w-5 h-5 text-violet-700" />;
              if (/mail|email/i.test(dt.label)) icon = <Mail className="w-5 h-5 text-blue-700" />;
              if (/address|location|place/i.test(dt.label)) icon = <MapPin className="w-5 h-5 text-green-700" />;
              // ...altre regole se vuoi
              return (
                <div
                  key={dt.id || idx}
                  ref={el => cardRefs.current[dt.id || idx] = el}
                  style={{
                    background: '#f3e8ff',
                    margin: 4,
                    padding: 8,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    border: '2px solid #a21caf',
                    position: 'relative'
                  }}
                >
                  <span style={{ marginRight: 10 }}>{icon}</span>
                  <span style={{ fontWeight: 700, color: '#a21caf', flex: 1 }}>{dt.label || dt.id || 'NO LABEL'}</span>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      marginLeft: 8,
                      cursor: 'pointer'
                    }}
                    onClick={() => setShowDeleteConfirm(dt.id)}
                    title="Elimina"
                  >
                    <Trash2 className="w-5 h-5 text-fuchsia-700 hover:text-red-600" />
                  </button>
                  {/* Dialog conferma cancellazione */}
                  {showDeleteConfirm === dt.id && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      marginTop: 10,
                      padding: 12,
                      background: '#181028',
                      border: '1px solid #a21caf',
                      borderRadius: 8,
                      boxShadow: '0 2px 8px rgba(80,0,80,0.08)'
                    }}>
                      <button
                        style={{
                          color: '#fff',
                          background: '#ef4444',
                          border: 'none',
                          borderRadius: 4,
                          padding: '10px 0',
                          fontWeight: 700,
                          fontSize: 16,
                          cursor: 'pointer',
                          marginBottom: 10,
                          width: 140
                        }}
                        onClick={() => handleDeleteDDT(dt.id)}
                      >Elimina</button>
                      <button
                        style={{
                          color: '#a21caf',
                          background: 'none',
                          border: '1px solid #a21caf',
                          borderRadius: 4,
                          padding: '10px 0',
                          fontWeight: 700,
                          fontSize: 16,
                          cursor: 'pointer',
                          width: 140
                        }}
                        onClick={() => setShowDeleteConfirm(null)}
                      >Annulla</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Accordion>
        {/* Entity accordions (Agent Acts, User Acts, etc.) */}
        {(() => {
          const { colors } = useSidebarTheme();
          return Object.entries(filteredData)
            .filter(([entityType]) => entityConfig.hasOwnProperty(entityType))
            .map(([entityType, categories]: [string, any[]]) => {
              const config = entityConfig[entityType as EntityType];
              // Calcola filteredCategories SENZA useMemo
              const filteredCategories = (categories as any[]).filter((category: any) => category && typeof category.name === 'string' && Array.isArray(category.items));
              return (
                <Accordion
                  key={entityType}
                  title={config.title}
                  icon={config.icon}
                  isOpen={openAccordion === entityType}
                  onToggle={() => setOpenAccordion(openAccordion === entityType ? '' : entityType)}
                  bgColor={colors[entityType as EntityType]}
                  action={
                    <button
                      className="p-1 text-blue-500 hover:text-blue-700 transition-colors"
                      title="Aggiungi categoria"
                      onClick={e => { e.stopPropagation(); setOpenAccordion(entityType); addCategory(entityType as EntityType, 'Nuova Categoria'); }}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  }
                >
                  {/* Render each category with memoized CategoryItem */}
                  {filteredCategories.map((category: any) => (
                    <CategoryItem
                      key={category.id}
                      category={category}
                      entityType={entityType as EntityType}
                      onAddItem={(name: string, description?: string) => 
                        addItem(entityType as EntityType, category.id, name, description || '')
                      }
                      onDeleteCategory={() => 
                        deleteCategory(entityType as EntityType, category.id)
                      }
                      onUpdateCategory={(updates: any) => 
                        updateCategory(entityType as EntityType, category.id, updates)
                      }
                      onDeleteItem={(itemId: string) => 
                        deleteItem(entityType as EntityType, category.id, itemId)
                      }
                      onUpdateItem={(itemId: string, updates: any) => 
                        updateItem(entityType as EntityType, category.id, itemId, updates)
                      }
                    />
                  ))}
                </Accordion>
              );
            });
        })()}
      </div>
      {/* Sidebar resizer handle */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 8,
          height: '100%',
          cursor: 'col-resize',
          zIndex: 10,
          background: 'transparent',
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(100,100,100,0.1)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        title="Trascina per ridimensionare"
      />
    </div>
  );
};