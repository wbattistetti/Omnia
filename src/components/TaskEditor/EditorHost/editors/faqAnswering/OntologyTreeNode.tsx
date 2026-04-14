/**
 * One ontology row: expand/collapse, drag-and-drop (react-dnd), badge, toolbar dopo il testo (5px).
 */

import React, { useEffect, useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import type { OntologyNode } from '@types/faqOntology';
import { OntologyDropPosition } from '@types/faqOntology';
import { findParentId, isLeaf } from '@domain/faqOntology/treeUtils';
import { useFaqOntology } from './FaqOntologyContext';
import OntologyInlineEditor from './OntologyInlineEditor';
import {
  OntologyIconAddChild,
  OntologyIconAddSiblingAbove,
  OntologyIconAddSiblingBelow,
} from './OntologyStructureIcons';

const DND_TYPE = 'FAQ_ONTOLOGY_NODE';
const INDENT = 20;
const DROP_BEFORE = 0.28;
const DROP_AFTER = 0.72;

type AddInlineMode = 'child' | 'siblingBefore' | 'siblingAfter' | null;

type Props = {
  node: OntologyNode;
  depth: number;
  /** Parent id, or `null` for root-level nodes. */
  parentId: string | null;
};

export default function OntologyTreeNode({ node, depth, parentId }: Props) {
  const {
    nodes,
    editMode,
    selectedNodeId,
    setSelectedNodeId,
    toggleExpanded,
    moveNode,
    deleteNode,
    renameNode,
    addNode,
    addSiblingBefore,
    addSiblingAfter,
    checkSiblingName,
    canDropOn,
  } = useFaqOntology();

  const rowRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLButtonElement>(null);
  const [dropPos, setDropPos] = useState<OntologyDropPosition | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [addInline, setAddInline] = useState<AddInlineMode>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_TYPE,
    item: () => ({ id: node.id }),
    canDrag: () => editMode && !renaming,
    collect: (m) => ({ isDragging: m.isDragging() }),
    end: () => setDropPos(null),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DND_TYPE,
    canDrop: (item: { id: string }) => editMode && canDropOn(item.id, node.id),
    hover(item: { id: string }, monitor) {
      if (!editMode || !canDropOn(item.id, node.id)) {
        setDropPos(null);
        return;
      }
      const el = rowRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const y = monitor.getClientOffset()?.y ?? 0;
      const relY = y - rect.top;
      const h = rect.height;
      if (relY < h * DROP_BEFORE) setDropPos(OntologyDropPosition.Before);
      else if (relY > h * DROP_AFTER) setDropPos(OntologyDropPosition.After);
      else setDropPos(OntologyDropPosition.Inside);
    },
    drop(item: { id: string }) {
      if (!editMode || !dropPos) return;
      moveNode(item.id, node.id, dropPos);
      setDropPos(null);
    },
    collect: (m) => ({ isOver: m.isOver({ shallow: true }) }),
  });

  drop(rowRef);
  drag(labelRef);
  void preview;

  useEffect(() => {
    if (!isOver) setDropPos(null);
  }, [isOver]);

  const leaf = isLeaf(node);
  const expanded = node.expanded !== false;
  const selected = selectedNodeId === node.id;
  const padLeft = depth * INDENT + 4;

  const parentForSiblings = findParentId(nodes, node.id);
  const validateNewSibling = (v: string) => {
    if (!v.trim()) return 'Nome obbligatorio';
    if (parentForSiblings === undefined) return 'Nodo non trovato';
    if (!checkSiblingName(parentForSiblings, v)) return 'Nome già usato tra i fratelli';
    return null;
  };

  const commitAddInline = (v: string) => {
    const t = v.trim();
    if (!t) return;
    if (addInline === 'child') {
      if (!checkSiblingName(node.id, t)) return;
      addNode(node.id, t);
      setAddInline(null);
      return;
    }
    if (addInline === 'siblingBefore') {
      if (validateNewSibling(t)) return;
      addSiblingBefore(node.id, t);
      setAddInline(null);
      return;
    }
    if (addInline === 'siblingAfter') {
      if (validateNewSibling(t)) return;
      addSiblingAfter(node.id, t);
      setAddInline(null);
    }
  };

  return (
    <div className="select-none">
      {isOver && dropPos === OntologyDropPosition.Before && (
        <div className="h-0.5 bg-blue-500" style={{ marginLeft: padLeft }} />
      )}
      <div
        ref={rowRef}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedNodeId(node.id);
        }}
        className={`group flex min-h-[32px] min-w-0 items-center gap-1 rounded py-0.5 pr-2 ${
          selected ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'
        } ${isDragging ? 'opacity-30' : ''} ${
          isOver && dropPos === OntologyDropPosition.Inside ? 'ring-2 ring-inset ring-blue-400' : ''
        }`}
        style={{ paddingLeft: padLeft }}
      >
        <button
          type="button"
          className="shrink-0 text-slate-400"
          onClick={(e) => {
            e.stopPropagation();
            if (node.children.length > 0) toggleExpanded(node.id);
          }}
        >
          {node.children.length === 0 ? (
            <span className="inline-block w-4" />
          ) : expanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-[5px] overflow-hidden">
          {renaming ? (
            <div className="min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
              <OntologyInlineEditor
                initialValue={node.name}
                validate={(v) => {
                  if (!v.trim()) return 'Nome obbligatorio';
                  const pid = findParentId(nodes, node.id);
                  if (pid === undefined) return 'Nodo non trovato';
                  if (!checkSiblingName(pid, v, node.id)) return 'Nome già usato';
                  return null;
                }}
                onConfirm={(v) => {
                  renameNode(node.id, v);
                  setRenaming(false);
                }}
                onCancel={() => setRenaming(false)}
              />
            </div>
          ) : (
            <>
              <button
                ref={labelRef}
                type="button"
                disabled={!editMode}
                className={`block min-w-0 max-w-[min(100%,18rem)] shrink truncate text-left text-sm text-slate-200 ${
                  editMode ? 'cursor-grab active:cursor-grabbing' : ''
                }`}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (editMode) setRenaming(true);
                }}
              >
                {node.name}
              </button>
              <span
                className={`hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium group-hover:inline ${
                  leaf ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                }`}
              >
                {leaf ? 'FAQ' : 'INT'}
              </span>
              {editMode ? (
                <span className="flex shrink-0 flex-nowrap gap-0.5 opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    className="rounded p-1 text-amber-400/90 hover:bg-slate-700 hover:text-amber-300"
                    title="Aggiungi figlio"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddInline('child');
                      if (!expanded) toggleExpanded(node.id);
                    }}
                  >
                    <OntologyIconAddChild title="Aggiungi figlio" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-amber-400/90 hover:bg-slate-700 hover:text-amber-300"
                    title="Fratello sopra"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddInline('siblingBefore');
                    }}
                  >
                    <OntologyIconAddSiblingAbove title="Fratello sopra" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-amber-400/90 hover:bg-slate-700 hover:text-amber-300"
                    title="Fratello sotto"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddInline('siblingAfter');
                    }}
                  >
                    <OntologyIconAddSiblingBelow title="Fratello sotto" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                    title="Rinomina"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenaming(true);
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-red-400/80 hover:bg-slate-700 hover:text-red-300"
                    title="Elimina"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNode(node.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>

      {addInline ? (
        <div
          style={{ paddingLeft: addInline === 'child' ? padLeft + INDENT : padLeft }}
          className="py-1 pr-2"
          onClick={(e) => e.stopPropagation()}
        >
          <OntologyInlineEditor
            placeholder={
              addInline === 'child'
                ? 'Nome nuovo figlio'
                : addInline === 'siblingBefore'
                  ? 'Nome nuovo nodo (sopra)'
                  : 'Nome nuovo nodo (sotto)'
            }
            validate={(v) => {
              if (addInline === 'child') {
                if (!v.trim()) return 'Nome obbligatorio';
                if (!checkSiblingName(node.id, v)) return 'Nome già usato tra i fratelli';
                return null;
              }
              return validateNewSibling(v);
            }}
            onConfirm={(v) => {
              commitAddInline(v);
            }}
            onCancel={() => setAddInline(null)}
          />
        </div>
      ) : null}

      {expanded &&
        node.children.map((ch) => (
          <OntologyTreeNode key={ch.id} node={ch} depth={depth + 1} parentId={node.id} />
        ))}

      {isOver && dropPos === OntologyDropPosition.After && (
        <div className="h-0.5 bg-blue-500" style={{ marginLeft: padLeft }} />
      )}
    </div>
  );
}
