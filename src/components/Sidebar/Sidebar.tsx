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
  onDeleteDDT
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
  const [dialogueTemplates, setDialogueTemplates] = useState<any[]>([]);
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
  useEffect(() => {
    setLoadingTemplates(true);
    getAllDialogueTemplates()
      .then((data) => {
        setDialogueTemplates(data);
      })
      .catch((err) => {
        setDialogueTemplates([]);
      })
      .finally(() => {
        setLoadingTemplates(false);
      });
  }, []);

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
                  setShowDDTBuilder(true);
                } else {
                  setShowDDTBuilder(v => !v);
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
                onComplete={(newDDT, messages) => {
                  setDialogueTemplates(prev => [...prev, newDDT]);
                  setShowDDTBuilder(false);
                  if (onOpenDDTEditor) onOpenDDTEditor(newDDT, messages || {}, 'it');
                }}
                onCancel={() => setShowDDTBuilder(false)}
              />
            </div>
          )}
          {/* Lista scrollabile dei template */}
          {loadingTemplates ? (
            <div className="text-slate-400 px-2 py-2">Caricamento...</div>
          ) : dialogueTemplates.length === 0 ? (
            <div className="text-slate-400 px-2 py-2">Nessun template trovato</div>
          ) : (
            <div
              className="overflow-y-auto pr-2"
              style={{ maxHeight: 260 }}
            >
              {dialogueTemplates.map((dt, idx) => {
                const ddtId = dt._id || dt.id;
                let icon = <FileText className="w-4 h-4 text-fuchsia-700 mr-2" />;
                const type = dt.dataType?.type?.toLowerCase();
                if (type === 'date') icon = <Calendar className="w-4 h-4 text-fuchsia-700 mr-2" />;
                else if (type === 'email') icon = <Mail className="w-4 h-4 text-fuchsia-700 mr-2" />;
                else if (type === 'address') icon = <MapPin className="w-4 h-4 text-fuchsia-700 mr-2" />;
                return (
                  <div key={ddtId} ref={el => { cardRefs.current[ddtId] = el; }} style={{ marginBottom: 2, padding: 4, borderRadius: 8, background: '#f3e8ff', border: '1px solid #f3e8ff', display: 'flex', flexDirection: 'column' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {icon}
                        <span className="font-semibold text-fuchsia-900 truncate">{dt.label || dt.name || ddtId}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <button
                          className={`p-1 transition-colors ${
                            openedDDTId === ddtId
                              ? 'text-fuchsia-900 font-bold'
                              : 'text-fuchsia-700 hover:text-fuchsia-900'
                          }`}
                          style={
                            openedDDTId === ddtId
                              ? {
                                  borderRadius: '50%',
                                  background: '#f3e8ff',
                                  border: '2px solid #a21caf',
                                  boxShadow: '0 0 0 2px #a21caf33',
                                  padding: 4,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 32,
                                  height: 32
                                }
                              : { padding: 4 }
                          }
                          title="Impostazioni"
                          onClick={() => handleOpenDDTEditor(dt, {}, 'it')}
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Elimina template"
                          onClick={() => {
                            setShowDeleteConfirm(ddtId);
                            if (openAccordion !== 'dataDialogueTemplates') setOpenAccordion('dataDialogueTemplates');
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {showDeleteConfirm === ddtId && (
                      <div
                        className="mt-2 flex gap-2 items-center bg-red-50 border border-red-200 rounded px-3 py-2"
                        style={{ position: 'relative', zIndex: 10, minHeight: 56, overflow: 'visible' }}
                      >
                        <button
                          className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 font-semibold"
                          onClick={() => handleDeleteDDT(ddtId)}
                        >
                          Conferma
                        </button>
                        <button
                          className="bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 font-semibold"
                          onClick={() => setShowDeleteConfirm(null)}
                        >
                          Annulla
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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