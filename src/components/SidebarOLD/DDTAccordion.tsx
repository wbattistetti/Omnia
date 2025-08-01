import React from 'react';
import { Puzzle, Plus, Loader, Save, Calendar, Mail, MapPin, FileText, Settings, Trash2 } from 'lucide-react';
import SidebarAccordion from './SidebarAccordion';

/**
 * DDTAccordion: lista DDT, header con icona Puzzle, +, spinner su save, wizard sempre montato.
 * TODO: implementare tutte le micro-interazioni, chiamate endpoint, spinner, conferma cancellazione.
 */
const DDTAccordion: React.FC<{
  ddtList: any[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenEditor: (id: string) => void;
  isSaving: boolean;
  onSave: () => void;
  activeBuilder: string | null;
  setActiveBuilder: (b: string | null) => void;
}> = ({ ddtList, onAdd, onEdit, onDelete, onOpenEditor, isSaving, onSave, activeBuilder, setActiveBuilder }) => {
  // TODO: Spinner su save, conferma cancellazione inline, wizard/modal sempre montato
  return (
    <SidebarAccordion
      title="Data Dialogue Templates"
      icon={<Puzzle className="w-5 h-5 text-fuchsia-400" />}
      color="#a21caf"
      isOpen={true /* TODO: gestire apertura centralizzata */}
      onToggle={() => {}}
      action={
        <>
          <button title="Aggiungi DDT" onClick={onAdd} style={{ color: '#a21caf', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Plus className="w-5 h-5" />
          </button>
          <button title="Salva tutti i DDT" onClick={onSave} disabled={isSaving} style={{ color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8 }}>
            {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          </button>
        </>
      }
    >
      <div>
        {ddtList.map((dt, idx) => {
          let icon = <FileText className="w-5 h-5 text-fuchsia-700" />;
          if (/date/i.test(dt.label)) icon = <Calendar className="w-5 h-5 text-violet-700" />;
          if (/mail|email/i.test(dt.label)) icon = <Mail className="w-5 h-5 text-blue-700" />;
          if (/address|location|place/i.test(dt.label)) icon = <MapPin className="w-5 h-5 text-green-700" />;
          // TODO: altre regole icona
          return (
            <div key={dt.id || idx} style={{ display: 'flex', alignItems: 'center', background: '#f3e8ff', margin: 4, padding: 8, borderRadius: 8, border: '2px solid #a21caf', position: 'relative' }}>
              <span style={{ marginRight: 10 }}>{icon}</span>
              {/* TODO: label viola, edit inline, matita, ingranaggio, cestino, conferma cancellazione inline */}
              <span style={{ fontWeight: 700, color: '#a21caf', flex: 1, marginRight: 8 }}>{dt.label || dt.id || 'NO LABEL'}</span>
              <button title="Modifica label" style={{ background: 'none', border: 'none', marginLeft: 4, cursor: 'pointer' }} onClick={() => onEdit(dt.id)}>
                {/* TODO: matita svg coerente */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a21caf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
              </button>
              <button title="Apri/chiudi response editor" style={{ background: 'none', border: 'none', marginLeft: 4, cursor: 'pointer' }} onClick={() => onOpenEditor(dt.id)}>
                <Settings className="w-5 h-5" style={{ color: '#a21caf' }} />
              </button>
              <button title="Elimina" style={{ background: 'none', border: 'none', marginLeft: 8, cursor: 'pointer' }} onClick={() => onDelete(dt.id)}>
                <Trash2 className="w-5 h-5 text-fuchsia-700 hover:text-red-600" />
              </button>
              {/* TODO: conferma cancellazione inline qui */}
            </div>
          );
        })}
      </div>
      {/* TODO: Wizard/modal DDT sempre montato (invisible tabs) */}
    </SidebarAccordion>
  );
};

export default DDTAccordion;