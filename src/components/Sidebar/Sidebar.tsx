import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Settings, ChevronLeft, ChevronRight, Bot, User, Database, GitBranch, CheckSquare, Layers, Puzzle, Square, Plus, Calendar, Mail, MapPin, FileText, Trash2 } from 'lucide-react';
import { useProjectData, useProjectDataUpdate } from '../../context/ProjectDataContext';
import { Accordion } from './Accordion';
import { CategoryItem } from './CategoryItem';
import { AddButton } from './AddButton';
import { EntityType } from '../../types/project';
import { useSidebarTheme } from './SidebarThemeContext';
import { getAllDialogueTemplates } from '../../services/ProjectDataService';

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
}

const MIN_WIDTH = 320; // px (w-80)

// FONT RESIZE SIDEBAR START
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 24;
const DEFAULT_FONT_SIZE = 16;
// FONT RESIZE SIDEBAR END

export const Sidebar: React.FC<SidebarProps> = ({ 
  isCollapsed = false, 
  onToggleCollapse,
  onOpenDDTEditor
}) => {
  const { data, loading, error } = useProjectData();
  const { 
    addCategory, 
    deleteCategory, 
    updateCategory, 
    addItem, 
    deleteItem, 
    updateItem 
  } = useProjectDataUpdate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogueTemplates, setDialogueTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string>('agentActs');
  const [sidebarWidth, setSidebarWidth] = useState(MIN_WIDTH);
  const isResizing = useRef(false);
  // FONT RESIZE SIDEBAR START
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const sidebarRef = useRef<HTMLDivElement>(null);
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
  // FONT RESIZE SIDEBAR END
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    setLoadingTemplates(true);
    getAllDialogueTemplates()
      .then((data) => {
        setDialogueTemplates(data);
      })
      .catch((err) => {
        setDialogueTemplates([]);
        console.error('Errore fetch dialogueTemplates:', err);
      })
      .finally(() => {
        setLoadingTemplates(false);
      });
  }, []);

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

  const filteredData = searchTerm
    ? Object.entries(data).reduce((acc, [entityType, categories]) => {
        const filteredCategories = categories.filter(category =>
          category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          category.items.some(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description.toLowerCase().includes(searchTerm.toLowerCase())
          )
        );
        if (filteredCategories.length > 0) {
          acc[entityType as EntityType] = filteredCategories;
        }
        return acc;
      }, {} as typeof data)
    : data;

  if (isCollapsed) {
    return (
      <div
        // FONT RESIZE SIDEBAR START
        ref={sidebarRef}
        style={{ fontSize: `${fontSize}px` }}
        // FONT RESIZE SIDEBAR END
        className="w-12 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-4 transition-all duration-300">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-slate-400 hover:text-white transition-colors mb-4"
          title="Expand sidebar"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        
        {Object.entries(entityConfig).map(([key, config]) => (
          <div key={key} className="mb-3" title={config.title}>
            {config.icon}
          </div>
        ))}
      </div>
    );
  }

  const handleDeleteDDT = async (ddtId: string) => {
    try {
      const res = await fetch(`http://localhost:3100/api/factory/dialogue-templates/${ddtId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Errore eliminazione');
      const result = await res.json();
      if (result.success) {
        setDialogueTemplates((prev) => prev.filter(dt => (dt._id || dt.id) !== ddtId));
        setShowDeleteConfirm(null);
      } else {
        alert('Errore: ' + (result.error || 'Impossibile eliminare il template.'));
      }
    } catch (err: any) {
      alert('Errore: ' + (err.message || err));
    }
  };

  return (
    <div
      // FONT RESIZE SIDEBAR START
      ref={sidebarRef}
      style={{ width: sidebarWidth, minWidth: MIN_WIDTH, fontSize: `${fontSize}px`, color: '#111', background: '#f7f7fa', border: '1px solid #111' }}
      // FONT RESIZE SIDEBAR END
      className="flex flex-col transition-all duration-100 relative">
      {/* Header */}
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
        {/* Nuova riga icone grandi - ora su fondo bianco con bordo nero */}
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
        {/* Search - ora chiara */}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* DataDialogueTemplates Accordion */}
        <Accordion
          title="Data Dialogue Templates"
          icon={<Puzzle className="w-5 h-5 text-fuchsia-400" />}
          isOpen={openAccordion === 'dataDialogueTemplates'}
          onToggle={() => {
            setOpenAccordion(openAccordion === 'dataDialogueTemplates' ? '' : 'dataDialogueTemplates');
          }}
          bgColor={{ header: '#a21caf', light: '#f3e8ff' }}
        >
          {(() => {
            const isOpen = openAccordion === 'dataDialogueTemplates';
            return loadingTemplates ? (
              <div className="text-slate-400 px-2 py-2">Caricamento...</div>
            ) : dialogueTemplates.length === 0 ? (
              <div className="text-slate-400 px-2 py-2">Nessun template trovato</div>
            ) : (
              <div className="max-h-64 overflow-y-auto pr-2">
                {dialogueTemplates.map((dt) => {
                  let icon = <FileText className="w-4 h-4 text-fuchsia-700 mr-2" />;
                  const type = dt.dataType?.type?.toLowerCase();
                  if (type === 'date') icon = <Calendar className="w-4 h-4 text-fuchsia-700 mr-2" />;
                  else if (type === 'email') icon = <Mail className="w-4 h-4 text-fuchsia-700 mr-2" />;
                  else if (type === 'address') icon = <MapPin className="w-4 h-4 text-fuchsia-700 mr-2" />;
                  const ddtId = dt._id || dt.id;
                  return (
                    <div key={ddtId} className="mb-2 p-2 rounded bg-fuchsia-50 border border-fuchsia-200 flex flex-col">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          {icon}
                          <span className="font-semibold text-fuchsia-900 truncate">{dt.label || dt.name || ddtId}</span>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <button
                            className="p-1 text-fuchsia-700 hover:text-fuchsia-900"
                            title="Impostazioni"
                            onClick={() => onOpenDDTEditor && onOpenDDTEditor(dt, {}, 'it')}
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1 text-red-500 hover:text-red-700"
                            title="Elimina template"
                            onClick={() => setShowDeleteConfirm(ddtId)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {showDeleteConfirm === ddtId && (
                        <div className="mt-2 flex gap-2 items-center bg-red-50 border border-red-200 rounded px-3 py-2">
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
            );
          })()}
        </Accordion>
        {(() => {
          const { colors } = useSidebarTheme();
          return Object.entries(filteredData)
            .filter(([entityType]) => entityConfig.hasOwnProperty(entityType))
            .map(([entityType, categories]: [string, any[]]) => {
              const config = entityConfig[entityType as EntityType];
              return (
                <Accordion
                  key={entityType}
                  title={config.title}
                  icon={config.icon}
                  isOpen={openAccordion === entityType}
                  onToggle={() => setOpenAccordion(openAccordion === entityType ? '' : entityType)}
                  bgColor={colors[entityType]}
                  action={
                    <button
                      className="p-1 text-blue-500 hover:text-blue-700 transition-colors"
                      title="Aggiungi categoria"
                      onClick={e => { e.stopPropagation(); addCategory(entityType as EntityType, 'Nuova Categoria'); }}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  }
                >
                  {categories
                    .filter((category: any) => category && typeof category.name === 'string' && Array.isArray(category.items))
                    .map((category: any) => (
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
      {/* Resizer handle */}
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