import React, { useState } from 'react';
import { ProjectEntityItem, EntityType } from '../../types/project';
import { Megaphone, Headphones, HelpCircle } from 'lucide-react';
import ItemEditor from './ItemEditor';
import DeleteConfirmation from './DeleteConfirmation';
import { Pencil, Trash2 } from 'lucide-react';

interface SidebarItemProps {
  item: ProjectEntityItem;
  onUpdate: (updates: Partial<ProjectEntityItem>) => void;
  onDelete: () => void;
  categoryType?: EntityType;
  onBuildFromItem?: (item: ProjectEntityItem) => void;
  hasDDTFor?: (label: string) => boolean;
  onCreateDDT?: (newDDT: any) => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ item, onUpdate, onDelete, categoryType, onBuildFromItem: _onBuildFromItem, hasDDTFor, onCreateDDT: _onCreateDDT }) => {
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isAgentAct = categoryType === 'agentActs' || (item as any)?.type === 'agent_act' || (item as any)?.categoryType === 'agentActs';
  const interactive = isAgentAct ? ((item as any)?.isInteractive ?? Boolean((item as any)?.data?.type) ?? Boolean((item as any)?.userActs?.length)) : false;
  const nameColor = isAgentAct ? (interactive ? '#38bdf8' /* sky-400 */ : '#22c55e' /* emerald-500 */) : 'var(--sidebar-content-text)';
  // Expose the accent for nested wizard via CSS var
  const accentStyle: React.CSSProperties = isAgentAct ? { ['--ddt-accent' as any]: nameColor } : {};

  return (
    <div
      className="flex items-center gap-1 text-sm py-0.5 px-1 rounded min-h-[32px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowDelete(false); }}
      style={accentStyle}
    >
      {editing ? (
        <ItemEditor
          value={item.name}
          onConfirm={(name) => {
            onUpdate({ name });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          placeholder="Edit item..."
        />
      ) : (
        <>
          {/* Leading icon for Agent Acts */}
          {isAgentAct && (
            <span className="inline-flex items-center justify-center mr-1" title={interactive ? 'Agent asks (expects input)' : 'Agent informs'}>
              {interactive ? (
                <span className="relative inline-flex items-center justify-center" style={{ width: 16, height: 16 }}>
                  <Headphones className="w-4 h-4 text-slate-500 hover:text-sky-500" />
                  <HelpCircle className="w-2.5 h-2.5 text-sky-500 absolute -right-1 -bottom-1" />
                </span>
              ) : (
                <Megaphone className="w-4 h-4 text-slate-500 hover:text-emerald-500" />
              )}
            </span>
          )}
          <span
            className="truncate"
            style={{ color: nameColor }}
            title={isAgentAct ? (interactive ? 'Interactive act (expects input)' : 'Emissive act (informative)') : undefined}
          >
            {item.name}
          </span>
          <span className="flex items-center gap-1 ml-1" style={{ visibility: hovered ? 'visible' : 'hidden' }}>
            <button
              className="p-1 text-gray-400 hover:text-blue-400"
              title="Modifica"
              onClick={() => setEditing(true)}
            >
              <Pencil className="w-4 h-4" />
            </button>
            {categoryType === 'agentActs' && (
              <button
                className="p-1 text-amber-500 hover:text-amber-600"
                title={(hasDDTFor && hasDDTFor(item.name)) ? 'Edit DDT (already built)' : 'Build DDT from this act'}
                onClick={(e) => {
                  e.stopPropagation();
                  try {
                    const exists = hasDDTFor ? hasDDTFor(item.name) : false;
                    console.log('[DDT][BuildFromAct][click]', { name: item?.name, exists, isAgentAct });
                  } catch {}
                  // Toggle an inline builder panel just under this row by emitting a targeted event
                  const ev: any = new CustomEvent('agentAct:openInlineBuilder', {
                    detail: {
                      anchorId: (item as any)?.id,
                      prefillUserDesc: String(item?.name || ''),
                      initialDDT: { label: item?.name || 'Data', mainData: [] },
                    },
                    bubbles: true,
                  });
                  (e.currentTarget as any).dispatchEvent(ev);
                }}
                type="button"
              >
                {(hasDDTFor && hasDDTFor(item.name)) ? (
                  // Gear icon when DDT exists
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82h0A1.65 1.65 0 0 0 20.91 11H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                ) : (
                  // Construction helmet icon (simple SVG)
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 19a9 9 0 0 1 18 0z"/><path d="M13 5a3 3 0 0 0-2 0v6h2z"/><path d="M12 5V3"/></svg>
                )}
              </button>
            )}
            <button
              className="p-1 text-red-500 hover:text-red-700"
              title="Elimina"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </span>
          {showDelete && (
            <DeleteConfirmation
              onConfirm={onDelete}
              triggerClass="hidden"
              icon={null}
            />
          )}
        </>
      )}
    </div>
  );
};

export default SidebarItem;