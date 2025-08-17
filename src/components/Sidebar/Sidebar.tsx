import React, { useState, useEffect, useRef } from 'react';
import SidebarContainer from './SidebarContainer';
import SidebarHeader from './SidebarHeader';
import EntityAccordion from './EntityAccordion';
import DDTSection from './DDTSection';
import { useSidebarState } from './SidebarState';
import { useProjectData, useProjectDataUpdate } from '../../context/ProjectDataContext';
import { useDDTManager } from '../../context/DDTManagerContext';
import { saveDataDialogueTranslations } from '../../services/ProjectDataService';
import { EntityType } from '../../types/project';
import { sidebarTheme } from './sidebarTheme';
import { Bot, User, Database, GitBranch, CheckSquare, Layers } from 'lucide-react';
import { usePanelZoom } from '../../hooks/usePanelZoom';

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
  const { openAccordion, setOpenAccordion } = useSidebarState();
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
  const { ddtList, createDDT, openDDT, deleteDDT, isLoadingDDT, loadDDTError, selectedDDT, dataDialogueTranslations } = useDDTManager();

  const [isSavingDDT, setIsSavingDDT] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Handler implementati usando il hook
  const handleAddDDT = (newDDT: any) => {
    // Ensure new DDT is added and opened
    createDDT(newDDT);
    // open editor explicitly as well, using the id assigned by context if present in list next tick
    setTimeout(() => {
      const id = (newDDT && (newDDT.id || newDDT._id)) ? (newDDT.id || newDDT._id) : undefined;
      const candidate = id ? (ddtList.find(dt => (dt.id === id || dt._id === id)) || null) : null;
      if (candidate) {
        openDDT(candidate);
      } else if (selectedDDT) {
        openDDT(selectedDDT);
      }
    }, 0);
  };

  const handleEditDDT = (_id: string) => {
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
      const startedAt = Date.now();
      // 1) Save DataDialogueTranslations (merge existing dynamic translations with current DDT texts)
      const mergedFromDDTs: Record<string, string> = (ddtList || []).reduce((acc: Record<string, string>, ddt: any) => {
        const tr = (ddt?.translations && (ddt.translations.en || ddt.translations)) || {};
        return { ...acc, ...tr };
      }, {});
      const translationsPayload = { ...(dataDialogueTranslations || {}), ...mergedFromDDTs };
      try {
        await saveDataDialogueTranslations(translationsPayload);
      } catch (e) {
        console.warn('[Sidebar] DataDialogueTranslations save failed, continuing with DDT save:', e);
      }

      // 2) Save DDTs (strip heavy fields not needed by factory DB)
      const payload = (ddtList || []).map((d: any) => {
        const { translations, ...rest } = d || {};
        return rest; // translations are saved separately
      });
      try {
        const approxSize = new Blob([JSON.stringify(payload)]).size;
        console.log('[Sidebar] DDT save payload size ~', approxSize, 'bytes');
      } catch {}
      const res = await fetch('/api/factory/dialogue-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error('Server error: unable to save DDT');
      }
      // Nota: non ricarichiamo da backend per evitare flicker; la lista è già la sorgente del payload
      // ensure spinner is visible at least 600ms
      const elapsed = Date.now() - startedAt;
      if (elapsed < 600) {
        await new Promise(r => setTimeout(r, 600 - elapsed));
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

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { ref: zoomRef, zoomStyle } = usePanelZoom<HTMLDivElement>(scrollRef);

  return (
    <SidebarContainer>
      <SidebarHeader />
      <div
        ref={zoomRef as any}
        className="p-4 overflow-y-auto"
        style={{ flex: 1, ...zoomStyle }}
      >
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
      {/* Editor docked gestito da AppContent */}
    </SidebarContainer>
  );
};

export default Sidebar;