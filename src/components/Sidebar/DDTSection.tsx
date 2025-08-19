import React, { useState } from 'react';
import SidebarEntityAccordion from './SidebarEntityAccordion';
import { Calendar, Mail, MapPin, FileText, Settings, Trash2, Loader, Plus, Save } from 'lucide-react';
import DDTBuilder from '../DialogueDataTemplateBuilder/DDTBuilder';

interface DDTSectionProps {
  ddtList: any[];
  onAdd: (newDDT: any) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenEditor: (id: string) => void;
  isSaving: boolean;
  onSave: () => void;
  isLoading?: boolean;
}

const DDTSection: React.FC<DDTSectionProps> = ({ ddtList, onAdd, onEdit, onDelete, onOpenEditor, isSaving, onSave, isLoading = false }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [showDDTBuilder, setShowDDTBuilder] = useState(false);
  const [builderStartOnStructure, setBuilderStartOnStructure] = useState(false);
  const [builderInitialDDT, setBuilderInitialDDT] = useState<any | null>(null);

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Previene la propagazione all'header dell'accordion
    // Nuovo DDT: apri il wizard dalla schermata iniziale (non struttura)
    setBuilderStartOnStructure(false);
    setBuilderInitialDDT(null);
    setShowDDTBuilder(true);
  };

  // Allow external trigger to open wizard inline below the DDT header (plus button behavior)
  React.useEffect(() => {
    const openBelowHeader = (e: any) => {
      const detail = e?.detail || {};
      console.log('[DDT][Section][openBelowHeader event]', detail);
      setBuilderStartOnStructure(Boolean(detail.startOnStructure));
      setBuilderInitialDDT(detail.initialDDT || null);
      setShowDDTBuilder(true);
      if (typeof detail.prefillUserDesc === 'string') {
        setTimeout(() => {
          console.log('[DDT][Section][prefill emit below]', detail.prefillUserDesc);
          document.dispatchEvent(new CustomEvent('ddtWizard:prefillDesc', { detail: { text: detail.prefillUserDesc } }));
        }, 0);
      }
    };
    document.addEventListener('ddt:openBuilderBelowHeader', openBelowHeader as any);
    return () => { document.removeEventListener('ddt:openBuilderBelowHeader', openBelowHeader as any); };
  }, []);

  const handleBuilderComplete = (newDDT: any) => {
    setShowDDTBuilder(false);
    onAdd(newDDT);
    // Nota: l'apertura dell'editor è gestita da createDDT (seleziona subito il DDT)
  };

  const handleBuilderCancel = () => {
    setShowDDTBuilder(false);
    setBuilderInitialDDT(null);
    setBuilderStartOnStructure(false);
  };

  const getIconForType = (type?: string, label?: string) => {
    if (/date/i.test(label)) return <Calendar className="w-4 h-4 text-violet-700" />;
    if (/mail|email/i.test(label)) return <Mail className="w-4 h-4 text-blue-700" />;
    if (/address|location|place/i.test(label)) return <MapPin className="w-4 h-4 text-green-700" />;
    return <FileText className="w-4 h-4 text-fuchsia-700" />;
  };

  // Listen to custom openBuilder events dispatched from siblings (e.g., Agent Acts items)
  React.useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail || {};
      console.log('[DDT][Section][openBuilder event]', detail);
      if (typeof detail.prefillUserDesc === 'string') {
        // Start the wizard on input step, prefilled with description
        setBuilderStartOnStructure(false);
        setBuilderInitialDDT(detail.initialDDT || null);
        setShowDDTBuilder(true);
        // Hack: set textarea value after mount via event
        setTimeout(() => {
          console.log('[DDT][Section][prefill emit]', detail.prefillUserDesc);
          document.dispatchEvent(new CustomEvent('ddtWizard:prefillDesc', { detail: { text: detail.prefillUserDesc } }));
        }, 0);
      }
    };
    document.addEventListener('ddt:openBuilder', handler as any);
    return () => { document.removeEventListener('ddt:openBuilder', handler as any); };
  }, []);

  return (
    <SidebarEntityAccordion
      title={
        <span className="flex items-center gap-2">
          Data Dialogue Templates
        </span>
      }
      icon={<FileText className="w-5 h-5 text-fuchsia-400" />}
      isOpen={isOpen}
      onToggle={() => setIsOpen((prev) => !prev)}
      action={
        <>
          {isOpen && (
            <button title="Aggiungi DDT" onClick={handleAddClick} style={{ color: '#a21caf', background: 'none', border: 'none', cursor: 'pointer' }}>
              <Plus className="w-5 h-5" />
            </button>
          )}
          <button
            title="Salva tutti i DDT"
            onClick={async (e) => {
              e.stopPropagation();
              await onSave();
              // Alla fine del salvataggio, chiudi l'accordion per mostrare la lista
              setIsOpen(true);
            }}
            disabled={isSaving}
            style={{ color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8 }}
          >
            {isSaving ? (
              <svg width="20" height="20" viewBox="0 0 50 50" role="progressbar" aria-label="Saving">
                <circle cx="25" cy="25" r="20" fill="none" stroke="#16a34a" strokeWidth="4" opacity="0.2" />
                <path d="M25 5 A20 20 0 0 1 45 25" fill="none" stroke="#16a34a" strokeWidth="4">
                  <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite" />
                </path>
              </svg>
            ) : (
              <Save className="w-5 h-5" />
            )}
          </button>
        </>
      }
    >
      {isOpen && (
        <>
          {showDDTBuilder && (
            <div data-ddt-section style={{ background: 'var(--sidebar-content-bg)', borderBottom: '1px solid #e5e7eb', paddingBottom: 8, marginBottom: 8, borderRadius: 8 }}>
              <DDTBuilder
                onComplete={handleBuilderComplete}
                onCancel={handleBuilderCancel}
                initialDDT={builderInitialDDT || undefined}
                startOnStructure={builderStartOnStructure}
              />
            </div>
          )}
          <div style={{ maxHeight: 300, overflowY: 'auto', background: 'var(--sidebar-content-bg)' }}>
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, color: 'var(--sidebar-content-text)' }}>
                <svg width="18" height="18" viewBox="0 0 50 50" role="progressbar" aria-label="Loading" style={{ marginRight: 8 }}>
                  <circle cx="25" cy="25" r="20" fill="none" stroke="#a21caf" strokeWidth="4" opacity="0.2" />
                  <path d="M25 5 A20 20 0 0 1 45 25" fill="none" stroke="#a21caf" strokeWidth="4">
                    <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite" />
                  </path>
                </svg>
                <span>Caricamento DDT...</span>
              </div>
            ) : ddtList.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, color: 'var(--sidebar-content-text)', fontStyle: 'italic' }}>
                <span>Nessun DDT trovato</span>
              </div>
            ) : (
              ddtList.map((dt, idx) => (
                <div key={dt.id || idx} style={{ display: 'flex', alignItems: 'center', margin: 4, padding: 8, borderRadius: 8, border: '2px solid #a21caf', position: 'relative', background: 'var(--sidebar-content-bg)' }}>
                  <span style={{ marginRight: 10 }}>{getIconForType(dt.type, dt.label)}</span>
                  <span style={{ fontWeight: 700, color: 'var(--sidebar-content-text)', flex: 1, marginRight: 8 }}>{dt.label || dt.id || 'NO LABEL'}</span>
                  <button title="Modifica struttura (apri il wizard)" style={{ background: 'none', border: 'none', marginLeft: 4, cursor: 'pointer', color: 'var(--sidebar-content-text)' }} onClick={(e) => { e.stopPropagation(); setBuilderInitialDDT(dt); setBuilderStartOnStructure(true); setShowDDTBuilder(true); }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a21caf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                  </button>
                  <button title="Apri/chiudi response editor" style={{ background: 'none', border: 'none', marginLeft: 4, cursor: 'pointer', color: 'var(--sidebar-content-text)' }} onClick={() => onOpenEditor(dt.id)}>
                    <Settings className="w-4 h-4" style={{ color: '#a21caf' }} />
                  </button>
                  <button title="Elimina" style={{ background: 'none', border: 'none', marginLeft: 8, cursor: 'pointer', color: 'var(--sidebar-content-text)' }} onClick={() => onDelete(dt.id)}>
                    <Trash2 className="w-5 h-5 hover:text-red-600" />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </SidebarEntityAccordion>
  );
};

export default DDTSection;