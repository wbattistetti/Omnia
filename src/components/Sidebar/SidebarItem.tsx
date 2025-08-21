import React, { useState } from 'react';
import { ProjectEntityItem, EntityType } from '../../types/project';
import { Megaphone, Headphones, HelpCircle } from 'lucide-react';
import ItemEditor from './ItemEditor';
import { classifyActInteractivity } from '../../nlp/actInteractivity';
import DeleteConfirmation from './DeleteConfirmation';
import { Pencil, Trash2, Wrench, Settings } from 'lucide-react';

interface SidebarItemProps {
  item: ProjectEntityItem;
  onUpdate: (updates: Partial<ProjectEntityItem>) => void;
  onDelete: () => void;
  categoryType?: EntityType;
  onBuildFromItem?: (item: ProjectEntityItem) => void;
  hasDDTFor?: (label: string) => boolean;
  onCreateDDT?: (newDDT: any) => void;
  onOpenEmbedded?: (item: ProjectEntityItem) => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ item, onUpdate, onDelete, categoryType, onBuildFromItem: _onBuildFromItem, hasDDTFor, onCreateDDT: _onCreateDDT, onOpenEmbedded }) => {
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isAgentAct = categoryType === 'agentActs' || (item as any)?.type === 'agent_act' || (item as any)?.categoryType === 'agentActs';
  const interactive = isAgentAct ? ((item as any)?.isInteractive ?? Boolean((item as any)?.data?.type) ?? Boolean((item as any)?.userActs?.length)) : false;
  const nameColor = isAgentAct ? (interactive ? '#38bdf8' /* sky-400 */ : '#22c55e' /* emerald-500 */) : 'var(--sidebar-content-text)';
  // Expose the accent for nested wizard via CSS var
  const accentStyle: React.CSSProperties = isAgentAct ? { ['--ddt-accent' as any]: nameColor } : {};
  const hasEmbedded = Boolean((item as any)?.ddt);
  const iconColor = hasEmbedded ? nameColor : '#94a3b8' /* slate-400 */;
  const leadingIconColor = iconColor; // same rule for left icon (headphones/megaphone)

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
            // Infer interactivity by simple rules when creating/editing agent acts
            let updates: any = { name };
            try {
              if (isAgentAct) {
                const inferred = classifyActInteractivity(name);
                console.log('[Interactivity][infer][onConfirm]', { title: name, inferred });
                if (typeof inferred === 'boolean') updates.isInteractive = inferred;
              }
            } catch {}
            onUpdate(updates);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          placeholder="Edit item..."
        />
      ) : (
        <>
          {/* Leading icon for Agent Acts */}
          {isAgentAct && (
            <span className="inline-flex items-center justify-center mr-1" title={interactive ? 'Agent asks (expects input)' : 'Agent informs'} style={{ color: leadingIconColor }}>
              {interactive ? (
                <span className="relative inline-flex items-center justify-center" style={{ width: 16, height: 16 }}>
                  <Headphones className="w-4 h-4" style={{ color: leadingIconColor }} />
                  <HelpCircle className="w-2.5 h-2.5 absolute -right-1 -bottom-1" style={{ color: leadingIconColor }} />
                </span>
              ) : (
                <Megaphone className="w-4 h-4" style={{ color: leadingIconColor }} />
              )}
            </span>
          )}
          <span
            className="truncate"
            style={{ color: nameColor, opacity: hasEmbedded ? 1 : 0.6 }}
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
                className="p-1"
                title={hasEmbedded || (hasDDTFor && hasDDTFor(item.name)) ? 'Edit DDT (already built)' : 'Build DDT from this act'}
                onClick={(e) => {
                  e.stopPropagation();
                  try {
                    const exists = hasEmbedded || (hasDDTFor ? hasDDTFor(item.name) : false);
                    console.log('[DDT][BuildFromAct][click]', { name: item?.name, exists, isAgentAct });
                  } catch {}
                  if (hasEmbedded && onOpenEmbedded) {
                    onOpenEmbedded(item);
                  } else {
                    // Toggle an inline builder panel just under this row
                    const ev: any = new CustomEvent('agentAct:openInlineBuilder', {
                      detail: {
                        anchorId: (item as any)?.id,
                        prefillUserDesc: String(item?.name || ''),
                        initialDDT: { label: item?.name || 'Data', mainData: [] },
                      },
                      bubbles: true,
                    });
                    (e.currentTarget as any).dispatchEvent(ev);
                  }
                }}
                type="button"
                style={{ color: iconColor }}
              >
                {(hasEmbedded || (hasDDTFor && hasDDTFor(item.name))) ? (
                  <Settings className="w-4 h-4" />
                ) : (
                  <Wrench className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              className="p-1 text-red-500 hover:text-red-700"
              title="Elimina"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </span>
          {/* Immediate delete on click; no confirmation overlay */}
        </>
      )}
    </div>
  );
};

export default SidebarItem;