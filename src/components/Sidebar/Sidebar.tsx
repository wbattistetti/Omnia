import React, { useState, useEffect } from 'react';
import SidebarContainer from './SidebarContainer';
import SidebarHeader from './SidebarHeader';
import EntityAccordion from './EntityAccordion';
import DDTSection from './DDTSection';
import { useSidebarState } from './SidebarState';
import { useProjectData, useProjectDataUpdate } from '../../context/ProjectDataContext';
import { useDDTManager } from '../../context/DDTManagerContext';
import { EntityType } from '../../types/project';
import { sidebarTheme } from './sidebarTheme';
import { Bot, User, Database, GitBranch, CheckSquare, Layers, Loader, Save } from 'lucide-react';

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

  // Usa il nuovo hook per DDT
  const { ddtList, createDDT, openDDT, deleteDDT, isLoadingDDT, loadDDTError } = useDDTManager();

  const [isSavingDDT, setIsSavingDDT] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Handler implementati usando il hook
  const handleAddDDT = (newDDT: any) => {
    createDDT(newDDT);
  };

  const handleEditDDT = (id: string) => {
    // TODO: Implementare editing
  };

  const handleDeleteDDT = (id: string) => {
    deleteDDT(id);
  };

  const handleOpenEditor = (id: string) => {
    const ddt = ddtList.find(dt => dt.id === id || dt._id === id);
    if (ddt) {
      openDDT(ddt);
    } else {
      console.error('[Sidebar] DDT non trovato per ID:', id);
    }
  };

  const handleSaveDDT = async () => {
    setIsSavingDDT(true);
    setSaveError(null);
    try {
      const res = await fetch('http://localhost:3100/api/factory/dialogue-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ddtList)
      });
      if (!res.ok) {
        throw new Error('Server error: unable to save DDT');
      }
      // TODO: Mostrare feedback di successo (toast/snackbar)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore nel salvataggio DDT';
      setSaveError(errorMessage);
      console.error('[Sidebar] Errore salvataggio DDT:', err);
      // TODO: Mostrare toast/alert con l'errore
    } finally {
      setIsSavingDDT(false);
    }
  };

  // Mostra errori di salvataggio
  useEffect(() => {
    if (saveError) {
      console.error('[Sidebar] Errore salvataggio DDT:', saveError);
      // TODO: Mostrare toast/alert con l'errore
    }
  }, [saveError]);

  // Mostra errori di caricamento
  useEffect(() => {
    if (loadDDTError) {
      console.error('[Sidebar] Errore caricamento DDT:', loadDDTError);
      // TODO: Mostrare toast/alert con l'errore
    }
  }, [loadDDTError]);

  if (!data) return null;

  return (
    <SidebarContainer>
      <SidebarHeader />
      <div className="p-4 overflow-y-auto" style={{ flex: 1 }}>
        <DDTSection
          ddtList={ddtList}
          onAdd={handleAddDDT}
          onEdit={handleEditDDT}
          onDelete={handleDeleteDDT}
          onOpenEditor={handleOpenEditor}
          isSaving={isSavingDDT}
          onSave={handleSaveDDT}
          isLoading={isLoadingDDT}
        />
        {entityTypes.map(type => (
          <EntityAccordion
            key={type}
            entityKey={type}
            title={type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
            icon={ICON_MAP[sidebarTheme[type].icon]}
            data={data[type] || []}
            isOpen={openAccordion === type}
            onToggle={() => setOpenAccordion(openAccordion === type ? '' : type)}
            onAddCategory={name => addCategory(type, name)}
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