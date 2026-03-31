/**
 * Recursive sidebar rows for nested manual task data (path-based selection and DnD).
 */

import React from 'react';
import { Check } from 'lucide-react';
import { getNodeLabel, getSubNodes } from '@responseEditor/core/domain';
import getIconComponent from '@responseEditor/icons';
import ParserStatusRow from '@responseEditor/Sidebar/ParserStatusRow';
import type { EngineType } from '@types/semanticContract';
import { getNodeIdStrict } from '@responseEditor/core/domain/nodeStrict';
import type { NestedDropIndicator } from './useSidebarDropIndicator';
import { dropPlacementFromEvent } from './useSidebarDropIndicator';
import type { SelectPathHandler } from '@responseEditor/features/node-editing/selectPathTypes';
import { SidebarInlineEditInput } from '@responseEditor/Sidebar/SidebarInlineEditInput';
import { sidebarLabelWidthMode, sidebarPathEditKey } from '@responseEditor/Sidebar/sidebarLabelEditWidth';
import { SIDEBAR_ROW_LABEL_INPUT_STYLE } from '@responseEditor/Sidebar/sidebarRowLabelInputStyle';

function pathsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function pathKey(path: number[]): string {
  return path.join(':');
}

export interface SidebarNestedListProps {
  nodes: any[];
  /** Path to the parent whose `subNodes` list is `nodes`. */
  siblingParentPath: number[];
  depth: number;
  translations: Record<string, string>;
  selectedPathProp?: number[];
  onSelectPath?: SelectPathHandler;
  expandedKeys: Set<string>;
  toggleExpanded: (path: number[]) => void;
  onReorderAtPath: (parentPath: number[] | null, fromIdx: number, toIdx: number) => void;
  onRenameAtPath: (path: number[], label: string) => void;
  onDeleteAtPath: (path: number[]) => void;
  onChangeRequiredAtPath: (path: number[], required: boolean) => void;
  nestedDragRef: React.MutableRefObject<{ parentKey: string | null; fromIdx: number | null }>;
  nestedDrop: NestedDropIndicator | null;
  setNestedDrop: React.Dispatch<React.SetStateAction<NestedDropIndicator | null>>;
  itemStyle: (active: boolean, isSub: boolean, disabled?: boolean) => React.CSSProperties;
  borderColor: string;
  bgGroup: string;
  sidebarSelectedClass: string;
  indentStep: number;
  baseMarginLeft: number;
  editingPath: number[] | null;
  editDraft: string;
  /** Matches sidebar fill key for new-node full-width label (`p:...`). */
  fillLabelPathKey: string | null;
  setEditingPath: (path: number[] | null) => void;
  setEditDraft: (s: string) => void;
  setOverlay: (
    o: { type: 'nested'; path: number[]; left: number; top: number } | null
  ) => void;
  maybeHideOverlay: (delay?: number) => void;
  hoverPathRef: React.MutableRefObject<string | null>;
  onParserCreate?: (nodeId: string, node: any) => void;
  onParserModify?: (nodeId: string, node: any) => void;
  onEngineChipClick?: (nodeId: string, node: any, editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
}

const editorTypeMap: Record<EngineType, 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings'> = {
  regex: 'regex',
  rule_based: 'extractor',
  ner: 'ner',
  llm: 'llm',
  embedding: 'embeddings',
};

export function SidebarNestedList(props: SidebarNestedListProps) {
  const {
    nodes,
    siblingParentPath,
    depth,
    translations,
    selectedPathProp,
    onSelectPath,
    expandedKeys,
    toggleExpanded,
    onReorderAtPath,
    onRenameAtPath,
    onChangeRequiredAtPath,
    onDeleteAtPath,
    nestedDragRef,
    nestedDrop,
    setNestedDrop,
    itemStyle,
    borderColor,
    bgGroup,
    sidebarSelectedClass,
    indentStep,
    baseMarginLeft,
    editingPath,
    editDraft,
    fillLabelPathKey,
    setEditingPath,
    setEditDraft,
    setOverlay,
    maybeHideOverlay,
    hoverPathRef,
    onParserCreate,
    onParserModify,
    onEngineChipClick,
  } = props;

  /** After Enter/Escape, blur still fires — avoid duplicate rename/delete. */
  const skipLabelBlurCommitRef = React.useRef(false);

  const parentKey = pathKey(siblingParentPath);

  const isRowActive = (path: number[]) =>
    Boolean(selectedPathProp && selectedPathProp.length === path.length && pathsEqual(selectedPathProp, path));

  const marginLeft = baseMarginLeft + Math.max(0, depth - 1) * indentStep;

  return (
    <div style={{ marginLeft, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {nodes.map((node: any, i: number) => {
        const path = [...siblingParentPath, i];
        const pk = pathKey(path);
        const subs = getSubNodes(node);
        const hasSubs = subs.length > 0;
        const expanded = expandedKeys.has(pk);
        const active = isRowActive(path);
        const reqEffective = node?.required !== false;
        const disabledSub = !reqEffective;
        const defaultNodeIcon = hasSubs ? 'Package' : 'FileText';
        const SubIcon = getIconComponent(node?.icon || defaultNodeIcon);

        const showLineBefore =
          nestedDrop &&
          pathKey(nestedDrop.parentPath) === parentKey &&
          nestedDrop.targetIndex === i &&
          nestedDrop.placement === 'before';

        const showLineAfter =
          nestedDrop &&
          pathKey(nestedDrop.parentPath) === parentKey &&
          nestedDrop.targetIndex === i &&
          nestedDrop.placement === 'after';

        return (
          <React.Fragment key={pk}>
            {showLineBefore && (
              <div
                style={{
                  height: 2,
                  marginBottom: -4,
                  marginTop: 0,
                  borderRadius: 1,
                  background: '#3b82f6',
                  boxShadow: '0 0 6px rgba(59,130,246,0.6)',
                }}
              />
            )}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  nestedDragRef.current = { parentKey, fromIdx: i };
                  try {
                    e.dataTransfer?.setData('text/plain', JSON.stringify({ parentKey, from: i }));
                    e.dataTransfer.dropEffect = 'move';
                    e.dataTransfer.effectAllowed = 'move';
                  } catch {
                    /* ignore */
                  }
                }}
                onDragEnter={(e) => {
                  if (nestedDragRef.current.parentKey === parentKey) e.preventDefault();
                }}
                onDragOver={(e) => {
                  if (nestedDragRef.current.parentKey !== parentKey) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  const el = e.currentTarget as HTMLElement;
                  const placement = dropPlacementFromEvent(e, el);
                  setNestedDrop({ parentPath: siblingParentPath, targetIndex: i, placement });
                }}
                onDragLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  if (!el.contains(e.relatedTarget as Node)) {
                    setNestedDrop(null);
                  }
                }}
                onDrop={(e) => {
                  const st = nestedDragRef.current;
                  if (st.parentKey === parentKey && st.fromIdx !== null && st.fromIdx !== i) {
                    onReorderAtPath(siblingParentPath, st.fromIdx, i);
                  }
                  nestedDragRef.current = { parentKey: null, fromIdx: null };
                  setNestedDrop(null);
                  try {
                    e.preventDefault();
                  } catch {
                    /* ignore */
                  }
                }}
                onDragEnd={() => {
                  nestedDragRef.current = { parentKey: null, fromIdx: null };
                  setNestedDrop(null);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPath?.(path);
                  (e.currentTarget as HTMLButtonElement).blur();
                }}
                onMouseEnter={(ev) => {
                  hoverPathRef.current = pk;
                  const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                  setOverlay({ type: 'nested', path, left: rect.right + 6, top: rect.top + rect.height / 2 });
                }}
                onMouseLeave={() => {
                  if (hoverPathRef.current === pk) hoverPathRef.current = null;
                  maybeHideOverlay(320);
                }}
                style={{
                  ...itemStyle(active, true, disabledSub),
                  ...(active ? {} : { background: bgGroup }),
                  cursor: 'grab',
                  width: '100%',
                }}
                className={`sb-item ${active ? sidebarSelectedClass : ''}`}
              >
                <span
                  role="checkbox"
                  aria-checked={reqEffective}
                  title={reqEffective ? 'Required' : 'Optional'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeRequiredAtPath(path, !reqEffective);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onChangeRequiredAtPath(path, !reqEffective);
                    }
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', marginRight: 6, cursor: 'pointer' }}
                  tabIndex={0}
                >
                  {reqEffective ? (
                    <Check size={14} color="#e5e7eb" />
                  ) : (
                    <span style={{ width: 14, height: 14, display: 'inline-block', border: '1px solid #9ca3af', borderRadius: 3 }} />
                  )}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>{SubIcon}</span>
                {editingPath && pathsEqual(editingPath, path) ? (
                  <SidebarInlineEditInput
                    active={Boolean(editingPath && pathsEqual(editingPath, path))}
                    widthMode={sidebarLabelWidthMode(fillLabelPathKey, sidebarPathEditKey(path), editDraft)}
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        skipLabelBlurCommitRef.current = true;
                        const t = (editDraft || '').trim();
                        if (!t) {
                          onDeleteAtPath(path);
                        } else {
                          onRenameAtPath(path, t);
                        }
                        setEditingPath(null);
                        setEditDraft('');
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        skipLabelBlurCommitRef.current = true;
                        const t = (editDraft || '').trim();
                        if (!t) {
                          onDeleteAtPath(path);
                        }
                        setEditingPath(null);
                        setEditDraft('');
                      }
                    }}
                    onBlur={() => {
                      if (skipLabelBlurCommitRef.current) {
                        skipLabelBlurCommitRef.current = false;
                        return;
                      }
                      const t = (editDraft || '').trim();
                      if (!t) {
                        onDeleteAtPath(path);
                      } else {
                        onRenameAtPath(path, t);
                      }
                      setEditingPath(null);
                      setEditDraft('');
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={SIDEBAR_ROW_LABEL_INPUT_STYLE}
                  />
                ) : (
                  <span style={{ whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{getNodeLabel(node, translations)}</span>
                )}
                {hasSubs && (
                  <span
                    role="button"
                    tabIndex={0}
                    title={expanded ? 'Collapse' : 'Expand'}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(path);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleExpanded(path);
                      }
                    }}
                    style={{
                      marginLeft: 6,
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      lineHeight: 0,
                      display: 'inline-flex',
                    }}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      style={{ transform: `rotate(${expanded ? 90 : 0}deg)`, transition: 'transform 0.15s' }}
                      aria-hidden
                    >
                      <polyline
                        points="2,1 8,5 2,9"
                        fill="none"
                        stroke={borderColor}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                )}
                <ParserStatusRow
                  node={node}
                  inline={true}
                  onCreateClick={() => {
                    const nodeId = getNodeIdStrict(node);
                    onParserCreate?.(nodeId, node);
                  }}
                  onModifyClick={() => {
                    const nodeId = getNodeIdStrict(node);
                    onParserModify?.(nodeId, node);
                  }}
                  onEngineChipClick={(engineType) => {
                    const nodeId = getNodeIdStrict(node);
                    const editorType = editorTypeMap[engineType] || 'regex';
                    onEngineChipClick?.(nodeId, node, editorType);
                  }}
                />
              </button>
            </div>
            {showLineAfter && (
              <div
                style={{
                  height: 2,
                  marginTop: -4,
                  marginBottom: 0,
                  borderRadius: 1,
                  background: '#3b82f6',
                  boxShadow: '0 0 6px rgba(59,130,246,0.6)',
                }}
              />
            )}
            {expanded && hasSubs && (
              <SidebarNestedList
                nodes={subs}
                siblingParentPath={path}
                depth={depth + 1}
                translations={translations}
                selectedPathProp={selectedPathProp}
                onSelectPath={onSelectPath}
                expandedKeys={expandedKeys}
                toggleExpanded={toggleExpanded}
                onReorderAtPath={onReorderAtPath}
                onRenameAtPath={onRenameAtPath}
                onDeleteAtPath={onDeleteAtPath}
                onChangeRequiredAtPath={onChangeRequiredAtPath}
                nestedDragRef={nestedDragRef}
                nestedDrop={nestedDrop}
                setNestedDrop={setNestedDrop}
                itemStyle={itemStyle}
                borderColor={borderColor}
                bgGroup={bgGroup}
                sidebarSelectedClass={sidebarSelectedClass}
                indentStep={indentStep}
                baseMarginLeft={baseMarginLeft}
                editingPath={editingPath}
                editDraft={editDraft}
                fillLabelPathKey={fillLabelPathKey}
                setEditingPath={setEditingPath}
                setEditDraft={setEditDraft}
                setOverlay={setOverlay}
                maybeHideOverlay={maybeHideOverlay}
                hoverPathRef={hoverPathRef}
                onParserCreate={onParserCreate}
                onParserModify={onParserModify}
                onEngineChipClick={onEngineChipClick}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
