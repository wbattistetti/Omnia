import React, { useRef, useState, useEffect } from 'react';
import ItemEditor from './ItemEditor';
import { classifyActInteractivity } from '../../nlp/actInteractivity';
import SidebarItem from './SidebarItem';
import { Pencil, Trash2 } from 'lucide-react';
import { Category, ProjectEntityItem, EntityType } from '../../types/project';
import DDTBuilder from '../DialogueDataTemplateBuilder/DDTBuilder';

interface SidebarCategoryProps {
  category: Category<ProjectEntityItem>;
  onAddItem: (name: string, description?: string) => void;
  onDeleteCategory: () => void;
  onUpdateCategory: (updates: Partial<Category<ProjectEntityItem>>) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, updates: Partial<ProjectEntityItem>) => void;
  entityType?: EntityType;
  onBuildFromItem?: (item: ProjectEntityItem) => void;
  hasDDTFor?: (label: string) => boolean;
  onCreateDDT?: (itemId: string, newDDT: any) => void;
  onOpenEmbedded?: (itemId: string) => void;
}

const SidebarCategory: React.FC<SidebarCategoryProps> = ({
  category,
  onUpdateCategory,
  onDeleteCategory,
  onAddItem,
  onDeleteItem,
  onUpdateItem,
  entityType,
  onBuildFromItem,
  hasDDTFor,
  onCreateDDT,
  onOpenEmbedded,
}) => {
  const [editing, setEditing] = useState(false);
  // const [showDelete, setShowDelete] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [adding, setAdding] = useState(false);
  // Inline builder state for Agent Acts
  const [inlineBuilderForId, setInlineBuilderForId] = useState<string | null>(null);
  const [inlineInitialDDT, setInlineInitialDDT] = useState<any | null>(null);
  const itemsRef = useRef<HTMLDivElement | null>(null);

  // Track last added item name to scroll/highlight after data refresh
  const [lastAddedName, setLastAddedName] = useState<string | null>(null);
  const highlightTimer = useRef<number | null>(null);

  useEffect(() => {
    const el = itemsRef.current;
    if (!el) return;
    const handler = (ev: any) => {
      if (entityType !== 'agentActs') return;
      const d = ev?.detail || {};
      if (!d.anchorId) return;
      setInlineBuilderForId(d.anchorId);
      setInlineInitialDDT(d.initialDDT || null);
      // Fill wizard textarea
      setTimeout(() => {
        try {
          document.dispatchEvent(new CustomEvent('ddtWizard:prefillDesc', { detail: { text: d.prefillUserDesc || '' } }));
        } catch {}
      }, 0);
    };
    el.addEventListener('agentAct:openInlineBuilder', handler as any);
    return () => { el.removeEventListener('agentAct:openInlineBuilder', handler as any); };
  }, [entityType]);

  useEffect(() => {
    return () => { if (highlightTimer.current) window.clearTimeout(highlightTimer.current); };
  }, []);

  // Compute sorted items every render to avoid stale memoization after in-place mutations
  const norm = (s: string) => (s || '').toLocaleLowerCase();
  const sortedItems = [...(category.items || [])].sort((a: any, b: any) => norm(a?.name || a?.label || '').localeCompare(norm(b?.name || b?.label || '')));

  return (
    <div className="mb-4 px-1 py-1 rounded">
      {/* Category row: only this div controls hover for icons */}
      <div
        className="flex items-center gap-1 min-h-[32px]"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); /* setShowDelete(false); */ }}
      >
        {editing ? (
          <ItemEditor
            value={category.name}
            onConfirm={(name) => {
              onUpdateCategory({ name });
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
            placeholder="Edit category..."
            className="font-semibold"
          />
        ) : (
          <>
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--sidebar-content-text)' }}>{category.name}</span>
            {hovered && (
              <span className="flex items-center gap-1 ml-1">
                <button
                  className="p-1 text-gray-400 hover:text-blue-400"
                  title="Modifica"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  className="p-1 text-red-500 hover:text-red-700"
                  title="Elimina categoria"
                  onClick={(e) => { e.stopPropagation(); onDeleteCategory(); }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  className="p-1 text-blue-500 hover:text-blue-700 text-xs font-medium"
                  style={{ minWidth: 0 }}
                  onClick={() => setAdding(true)}
                >
                  Aggiungi voce
                </button>
              </span>
            )}
            {/* Immediate delete on click; no confirmation overlay */}
          </>
        )}
      </div>
      {/* Add item input (immediately below category header) */}
      {adding && (
        <div className="ml-4 mt-1">
          <ItemEditor
            value=""
            onConfirm={(name) => {
              const trimmed = String(name || '').trim();
              if (!trimmed) { setAdding(false); return; }
              // Infer interactivity when creating a new Agent Act
              if (entityType === 'agentActs') {
                try {
                  const inferred = classifyActInteractivity(trimmed);
                  if (typeof inferred === 'boolean') {
                    onAddItem(trimmed);
                  } else {
                    onAddItem(trimmed);
                  }
                } catch {
                  onAddItem(trimmed);
                }
              } else {
                onAddItem(trimmed);
              }
              // mark this name to highlight on next render; clear after element is detected
              setLastAddedName(trimmed);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
            placeholder="Nuova voce..."
          />
        </div>
      )}
      {/* Items (listen for inline builder events here) */}
      <div className="ml-4 mt-1" ref={itemsRef}>
        {sortedItems.map((item: ProjectEntityItem) => {
          const isNew = lastAddedName && String(item?.name || '').toLocaleLowerCase() === lastAddedName.toLocaleLowerCase();
          return (
            <div
              key={item.id}
              ref={(el) => {
                if (el && isNew) {
                  try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); } catch {}
                  if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
                  highlightTimer.current = window.setTimeout(() => setLastAddedName(null), 1600);
                }
              }}
              style={{ ['--ddt-accent' as any]: (entityType === 'agentActs' ? (((item as any)?.mode === 'DataRequest') ? '#3b82f6' : ((item as any)?.mode === 'DataConfirmation' ? '#f59e0b' : '#22c55e')) : undefined), background: isNew ? 'rgba(99,102,241,0.18)' : undefined, border: isNew ? '1px solid rgba(99,102,241,0.55)' : undefined, borderRadius: isNew ? 6 : undefined }}
            >
              <SidebarItem
                item={item}
                categoryType={entityType}
                onBuildFromItem={onBuildFromItem}
                hasDDTFor={hasDDTFor}
                onCreateDDT={onCreateDDT ? ((newDDT: any) => onCreateDDT(item.id, newDDT)) : undefined}
                onOpenEmbedded={() => onOpenEmbedded && onOpenEmbedded(item.id)}
                onUpdate={(updates: Partial<ProjectEntityItem>) => onUpdateItem(item.id, updates)}
                onDelete={() => onDeleteItem(item.id)}
              />
              {entityType === 'agentActs' && inlineBuilderForId === item.id && (
                <div className="mt-2 mb-2" style={{ padding: 0 }}>
                  <DDTBuilder
                    initialDDT={inlineInitialDDT || undefined}
                    startOnStructure={false}
                    onCancel={() => { setInlineBuilderForId(null); setInlineInitialDDT(null); }}
                    onComplete={(newDDT: any) => { setInlineBuilderForId(null); setInlineInitialDDT(null); onCreateDDT && onCreateDDT(item.id, newDDT); }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SidebarCategory;