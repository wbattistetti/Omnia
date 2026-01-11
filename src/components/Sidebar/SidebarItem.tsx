import React, { useState } from 'react';
import { ProjectEntityItem, EntityType } from '../../types/project';
import { Megaphone, Ear, CheckCircle2 } from 'lucide-react';
import ItemEditor from './ItemEditor';
import { classifyTaskInteractivity } from '../../nlp/taskInteractivity';
// import DeleteConfirmation from './DeleteConfirmation';
import { Pencil, Trash2, Wrench, Settings } from 'lucide-react';
import { getTaskIconColor } from '../../utils/taskIconColor';
import { useProjectData } from '../../context/ProjectDataContext';

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
  const { data: projectData } = useProjectData();

  const isAgentAct = categoryType === 'taskTemplates' || (item as any)?.type === 'agent_act' || (item as any)?.categoryType === 'taskTemplates';
  const mode: 'DataRequest' | 'DataConfirmation' | 'Message' = (isAgentAct ? ((item as any)?.mode || 'Message') : 'Message');
  const isInteractive = mode === 'DataRequest' || mode === 'DataConfirmation'; // Keep for backward compatibility
  const nameColor = isAgentAct
    ? (mode === 'DataRequest' ? getTaskIconColor(item as any) : mode === 'DataConfirmation' ? '#f59e0b' : '#22c55e')
    : 'var(--sidebar-content-text)';

  // Debug logging removed to prevent excessive console output
  // Expose the accent for nested wizard via CSS var
  const accentStyle: React.CSSProperties = isAgentAct ? { ['--ddt-accent' as any]: nameColor } : {};
  const hasEmbedded = Boolean((item as any)?.ddt);
  const hasMessage = Boolean(((item as any)?.prompts && (((item as any)?.prompts?.informal || (item as any)?.prompts?.formal || '').trim().length > 0)));
  const iconColor = isAgentAct ? nameColor : ((hasEmbedded || (!isInteractive && hasMessage)) ? nameColor : '#94a3b8' /* slate-400 */);
  const leadingIconColor = iconColor; // same rule for left icon (headphones/megaphone)

  // Condition helpers
  const isCondition = categoryType === 'conditions' || (item as any)?.categoryType === 'conditions';
  const hasConditionScript = Boolean((item as any)?.data && (item as any).data?.script);

  return (
    <div
      className="flex items-center gap-1 py-0.5 px-1 rounded min-h-[32px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); }}
      style={accentStyle}
    >
      {editing ? (
        <ItemEditor
          value={item.name}
          onConfirm={(name) => {
            let updates: any = { name };
            try { /* optional mode inference here */ } catch {}
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
            <span className="inline-flex items-center justify-center mr-1 flex-shrink-0" title={mode} style={{ color: leadingIconColor }}>
              {mode === 'DataRequest' ? (
                <Ear className="w-4 h-4" style={{ color: leadingIconColor }} />
              ) : mode === 'DataConfirmation' ? (
                <CheckCircle2 className="w-4 h-4" style={{ color: leadingIconColor }} />
              ) : (
                <Megaphone className="w-4 h-4" style={{ color: leadingIconColor }} />
              )}
            </span>
          )}
          <span
            className="flex-1 min-w-0 break-words"
            style={{ color: nameColor, opacity: hasEmbedded ? 1 : 0.6 }}
            title={isAgentAct ? mode : undefined}
            role={isCondition ? 'button' : undefined}
            tabIndex={isCondition ? 0 : undefined}
            onClick={async (e) => {
              if (!isCondition) return;
              e.stopPropagation();
              try {
                const variables = (window as any).__omniaVars || {};
                const script = (item as any)?.data?.script || '';
                const label = String((item as any)?.name || (item as any)?.label || 'Condition');
                console.log('[LOAD_SCRIPT] 🔍 From SidebarItem (click)', {
                  conditionName: label,
                  hasScript: !!script,
                  scriptLength: script.length
                });
                (await import('../../ui/events')).emitConditionEditorOpen({ variables, script, label, name: label });
              } catch {}
            }}
            onKeyDown={async (e) => {
              if (!isCondition) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                try {
                  const variables = (window as any).__omniaVars || {};
                  const script = (item as any)?.data?.script || '';
                  const label = String((item as any)?.name || (item as any)?.label || 'Condition');
                  (await import('../../ui/events')).emitConditionEditorOpen({ variables, script, label, name: label });
                } catch {}
              }
            }}
          >
            {item.name}
          </span>
          <span className="flex items-center gap-1 ml-1 flex-shrink-0" style={{ visibility: hovered ? 'visible' : 'hidden' }}>
            {/* Pencil */}
            <button
              className="p-1 text-gray-400 hover:text-blue-400"
              title="Modifica"
              onClick={() => setEditing(true)}
            >
              <Pencil className="w-4 h-4" />
            </button>

            {/* Agent Acts gear/wrench */}
            {categoryType === 'taskTemplates' && (
              <button
                className="p-1"
                title={isInteractive
                  ? ((hasEmbedded || (hasDDTFor && hasDDTFor(item.name))) ? 'Edit DDT (already built)' : 'Build DDT from this act')
                  : (hasMessage ? 'Edit message' : 'Add message')}
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const exists = hasEmbedded || (hasDDTFor ? hasDDTFor(item.name) : false);
                    console.log('[DDT][BuildFromAct][click]', { name: item?.name, exists, isAgentAct });
                  } catch {}
                  const act = item as any;
                  const interactiveAct = isInteractive; // precomputed above
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
                    try { (await import('../../ui/events')).emitNonInteractiveEditorOpen({ title: String(item?.name || 'Agent message'), template: String(promptText || ''), accentColor }); } catch {}
                  }
                }}
                type="button"
                style={{ color: iconColor }}
              >
                {isInteractive
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
                    console.log('[LOAD_SCRIPT] 🔍 From SidebarItem (gear)', {
                      conditionName: label,
                      hasScript: !!script,
                      scriptLength: script.length
                    });
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