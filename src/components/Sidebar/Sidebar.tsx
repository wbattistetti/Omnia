import React, { useState, useEffect } from 'react';
import SidebarContainer from './SidebarContainer';
import SidebarHeader from './SidebarHeader';
import EntityAccordion from './EntityAccordion';
import DDTSection from './DDTSection';
import { useSidebarState } from './SidebarState';
import { useProjectData, useProjectDataUpdate } from '../../context/ProjectDataContext';
import { EntityType } from '../../types/project';
import { sidebarTheme } from './sidebarTheme';
import { Bot, User, Database, GitBranch, CheckSquare, Layers } from 'lucide-react';

const ICON_MAP: Record<string, React.ReactNode> = {
  bot: <Bot className="w-5 h-5" />,
  user: <User className="w-5 h-5" />,
  database: <Database className="w-5 h-5" />,
  gitBranch: <GitBranch className="w-5 h-5" />,
  checkSquare: <CheckSquare className="w-5 h-5" />,
  layers: <Layers className="w-5 h-5" />,
};

const entityTypes: EntityType[] = [
  'agentActs',
  'userActs',
  'backendActions',
  'conditions',
  'tasks',
  'macrotasks'
];

const Sidebar: React.FC = () => {
  const { openAccordion, setOpenAccordion, toggleCollapse } = useSidebarState();
  const { data } = useProjectData();
  const {
    addCategory,
    deleteCategory,
    updateCategory,
    addItem,
    deleteItem,
    updateItem
  } = useProjectDataUpdate();

  // DDT list as top-level state
  const [dialogueTemplates, setDialogueTemplates] = useState<any[]>([]);
  const [isSavingDDT, setIsSavingDDT] = useState(false);

  useEffect(() => {
    // TODO: Replace with real fetch logic
    setDialogueTemplates([]); // or fetch from backend
  }, []);

  // Handler stubs (replace with real logic)
  const handleAddDDT = () => {};
  const handleEditDDT = (id: string) => {};
  const handleDeleteDDT = (id: string) => {};
  const handleOpenEditor = (id: string) => {};
  const handleSaveDDT = () => {};

  if (!data) return null;

  return (
    <SidebarContainer>
      <SidebarHeader onToggleCollapse={toggleCollapse} />
      <div className="p-4 overflow-y-auto" style={{ flex: 1 }}>
        <DDTSection
          ddtList={dialogueTemplates}
          onAdd={handleAddDDT}
          onEdit={handleEditDDT}
          onDelete={handleDeleteDDT}
          onOpenEditor={handleOpenEditor}
          isSaving={isSavingDDT}
          onSave={handleSaveDDT}
        />
        {entityTypes.map(type => (
          <EntityAccordion
            key={type}
            entityKey={type}
            title={type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
            icon={ICON_MAP[sidebarTheme[type].icon]}
            color={sidebarTheme[type].color}
            data={data[type] || []}
            isOpen={openAccordion === type}
            onToggle={() => setOpenAccordion(openAccordion === type ? '' : type)}
            onAddCategory={() => addCategory(type, 'Nuova categoria')}
            onDeleteCategory={categoryId => deleteCategory(type, categoryId)}
            onUpdateCategory={(categoryId, updates) => updateCategory(type, categoryId, updates)}
            onAddItem={(categoryId, name, desc) => addItem(type, categoryId, name, desc)}
            onDeleteItem={(categoryId, itemId) => deleteItem(type, categoryId, itemId)}
            onUpdateItem={(categoryId, itemId, updates) => updateItem(type, categoryId, itemId, updates)}
          />
        ))}
      </div>
    </SidebarContainer>
  );
};

export default Sidebar;