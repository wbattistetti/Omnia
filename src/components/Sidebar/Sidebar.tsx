import React, { useState, useCallback } from 'react';
import { Search, Settings, ChevronLeft, ChevronRight, Bot, User, Database, GitBranch, CheckSquare, Layers } from 'lucide-react';
import { useProjectData, useProjectDataUpdate } from '../../context/ProjectDataContext';
import { Accordion } from './Accordion';
import { CategoryItem } from './CategoryItem';
import { AddButton } from './AddButton';
import { EntityType } from '../../types/project';

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
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isCollapsed = false, 
  onToggleCollapse 
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
  const [openAccordion, setOpenAccordion] = useState<string>('agentActs');

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
      <div className="w-12 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-4 transition-all duration-300">
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

  return (
    <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Project Structure</h2>
          <div className="flex items-center space-x-2">
            <button
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search entities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {Object.entries(filteredData).map(([entityType, categories]) => {
          const config = entityConfig[entityType as EntityType];
          
          return (
            <Accordion
              key={entityType}
              title={config.title}
              icon={config.icon}
              isOpen={openAccordion === entityType}
              onToggle={() => setOpenAccordion(openAccordion === entityType ? '' : entityType)}
            >
              {categories.map((category) => (
                <CategoryItem
                  key={category.id}
                  category={category}
                  entityType={entityType as EntityType}
                  onAddItem={(name, description) => 
                    addItem(entityType as EntityType, category.id, name, description)
                  }
                  onDeleteCategory={() => 
                    deleteCategory(entityType as EntityType, category.id)
                  }
                  onUpdateCategory={(updates) => 
                    updateCategory(entityType as EntityType, category.id, updates)
                  }
                  onDeleteItem={(itemId) => 
                    deleteItem(entityType as EntityType, category.id, itemId)
                  }
                  onUpdateItem={(itemId, updates) => 
                    updateItem(entityType as EntityType, category.id, itemId, updates)
                  }
                />
              ))}
              
              <div className="mt-3">
                <AddButton
                  label="Nuova Categoria"
                  onAdd={(name) => addCategory(entityType as EntityType, name)}
                  placeholder="Enter category name..."
                />
              </div>
            </Accordion>
          );
        })}
      </div>
    </div>
  );
};