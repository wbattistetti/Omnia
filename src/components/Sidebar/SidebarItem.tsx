import React, { useState } from 'react';
import { ProjectEntityItem, EntityType } from '../../types/project';
import { Megaphone, Headphones, HelpCircle } from 'lucide-react';
import ItemEditor from './ItemEditor';
import { classifyActInteractivity } from '../../nlp/actInteractivity';
// import DeleteConfirmation from './DeleteConfirmation';
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
  // const [showDelete, setShowDelete] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isAgentAct = categoryType === 'agentActs' || (item as any)?.type === 'agent_act' || (item as any)?.categoryType === 'agentActs';
  const interactive = isAgentAct ? ((item as any)?.isInteractive ?? Boolean((item as any)?.data?.type) ?? Boolean((item as any)?.userActs?.length)) : false;
  const nameColor = isAgentAct ? (interactive ? '#38bdf8' /* sky-400 */ : '#22c55e' /* emerald-500 */) : 'var(--sidebar-content-text)';
  // Expose the accent for nested wizard via CSS var
  const accentStyle: React.CSSProperties = isAgentAct ? { ['--ddt-accent' as any]: nameColor } : {};
  const hasEmbedded = Boolean((item as any)?.ddt);
  const hasMessage = Boolean(((item as any)?.prompts && (((item as any)?.prompts?.informal || (item as any)?.prompts?.formal || '').trim().length > 0)));
  const iconColor = (hasEmbedded || (!interactive && hasMessage)) ? nameColor : '#94a3b8' /* slate-400 */;
  const leadingIconColor = iconColor; // same rule for left icon (headphones/megaphone)

  // Condition helpers
  const isCondition = categoryType === 'conditions' || (item as any)?.categoryType === 'conditions';
  const hasConditionScript = Boolean((item as any)?.data && (item as any).data?.script);

  return (
    <div
      className="flex items-center gap-1 text-sm py-0.5 px-1 rounded min-h-[32px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); }}
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
            role={isCondition ? 'button' : undefined}
            tabIndex={isCondition ? 0 : undefined}
            onClick={(e) => {
              if (!isCondition) return;
              e.stopPropagation();
              try {
                const variables = (window as any).__omniaVars || {};
                const script = (item as any)?.data?.script || '';
                const label = String((item as any)?.name || (item as any)?.label || 'Condition');
                const ev: any = new CustomEvent('conditionEditor:open', { detail: { variables, script, label, name: label }, bubbles: true });
                (e.currentTarget as any).dispatchEvent(ev);
              } catch {}
            }}
            onKeyDown={(e) => {
              if (!isCondition) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                try {
                  const variables = (window as any).__omniaVars || {};
                  const script = (item as any)?.data?.script || '';
                  const label = String((item as any)?.name || (item as any)?.label || 'Condition');
                  const ev: any = new CustomEvent('conditionEditor:open', { detail: { variables, script, label, name: label }, bubbles: true });
                  (e.currentTarget as any).dispatchEvent(ev);
                } catch {}
              }
            }}
          >
            {item.name}
          </span>
          <span className="flex items-center gap-1 ml-1" style={{ visibility: hovered ? 'visible' : 'hidden' }}>
            {/* Pencil */}
            <button
              className="p-1 text-gray-400 hover:text-blue-400"
              title="Modifica"
              onClick={() => setEditing(true)}
            >
              <Pencil className="w-4 h-4" />
            </button>

            {/* Agent Acts gear/wrench */}
            {categoryType === 'agentActs' && (
              <button
                className="p-1"
                title={interactive
                  ? ((hasEmbedded || (hasDDTFor && hasDDTFor(item.name))) ? 'Edit DDT (already built)' : 'Build DDT from this act')
                  : (hasMessage ? 'Edit message' : 'Add message')}
                onClick={(e) => {
                  e.stopPropagation();
                  try {
                    const exists = hasEmbedded || (hasDDTFor ? hasDDTFor(item.name) : false);
                    console.log('[DDT][BuildFromAct][click]', { name: item?.name, exists, isAgentAct });
                  } catch {}
                  const act = item as any;
                  const interactiveAct = interactive; // precomputed above
                  if (interactiveAct) {
                    if (hasEmbedded && onOpenEmbedded) {
                      onOpenEmbedded(item);
                    } else {
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
                  } else {
                    // Non-interactive → open bottom panel text editor
                    const promptText = (act?.prompts && (act.prompts.informal || act.prompts.formal)) || act?.description || '';
                    const accentColor = nameColor || '#22c55e'; // use computed act forecolor
                    try {
                      const openEvt: any = new CustomEvent('nonInteractiveEditor:open', {
                        detail: { title: String(item?.name || 'Agent message'), template: String(promptText || ''), accentColor },
                        bubbles: true,
                      });
                      (e.currentTarget as any).dispatchEvent(openEvt);
                    } catch {}
                  }
                }}
                type="button"
                style={{ color: iconColor }}
              >
                {interactive
                  ? ((hasEmbedded || (hasDDTFor && hasDDTFor(item.name))) ? (
                      <Settings className="w-4 h-4" />
                    ) : (
                      <Wrench className="w-4 h-4" />
                    ))
                  : (hasMessage ? (
                      <Settings className="w-4 h-4" />
                    ) : (
                      <Wrench className="w-4 h-4" />
                    ))}
              </button>
            )}

            {/* Conditions: wrench/gear + open ConditionEditor */}
            {isCondition && (
              <button
                className="p-1 text-gray-400 hover:text-blue-400"
                title={hasConditionScript ? 'Edit condition' : 'Create condition'}
                onClick={(e) => {
                  e.stopPropagation();
                  try {
                    const variables = (window as any).__omniaVars || {};
                    const script = (item as any)?.data?.script || '';
                    const label = String((item as any)?.name || (item as any)?.label || 'Condition');
                    const ev: any = new CustomEvent('conditionEditor:open', { detail: { variables, script, label, name: label }, bubbles: true });
                    (e.currentTarget as any).dispatchEvent(ev);
                  } catch {}
                }}
              >
                {hasConditionScript ? <Settings className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
              </button>
            )}

            {/* Trash */}
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