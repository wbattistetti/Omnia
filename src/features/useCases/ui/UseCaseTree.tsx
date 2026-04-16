import React from 'react';
import { Plus, Trash2, Play, Pencil, MessageCircle } from 'lucide-react';
import type { LabelWithPencilEditHandle } from '@components/FlowMappingPanel/LabelWithPencilEdit';
import { buildUseCaseTree, type UseCaseTreeNode } from '../tree/useCaseTreeModel';
import { UseCaseTreeContextMenu } from '../tree/UseCaseTreeContextMenu';
import { UseCaseTreeLabelEditor } from '../tree/UseCaseTreeLabelEditor';
import { UseCaseNoteEditor } from '../notes/UseCaseNoteEditor';

/**
 * Tree view for dot-name use cases: full toolbar on every row (play only when a use case exists at that path).
 */
export function UseCaseTree(props: {
  useCases: UseCase[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRenameUseCase: (id: string, nextKey: string) => void;
  onRenameFolder: (folderPath: string, nextSegment: string) => void;
  onDeleteNode: (fullPath: string, useCaseId?: string) => void;
  onMoveToFolder: (id: string, folderPath: string) => void;
  onCreateRelativeUseCase: (targetPath: string, mode: 'before' | 'after' | 'child') => void;
  onRun: (id: string) => void;
  onSaveNote: (id: string, note: string) => void;
  editIntentUseCaseId?: string | null;
  onConsumeEditIntentUseCaseId?: () => void;
}) {
  const { useCases, selectedId } = props;
  const tree = React.useMemo(() => buildUseCaseTree(useCases), [useCases]);
  const [openPlusMenuNodeId, setOpenPlusMenuNodeId] = React.useState<string | null>(null);
  const [draggingUseCaseId, setDraggingUseCaseId] = React.useState<string | null>(null);
  const [openNoteUseCaseId, setOpenNoteUseCaseId] = React.useState<string | null>(null);
  const [noteDraftByUseCaseId, setNoteDraftByUseCaseId] = React.useState<Record<string, string>>({});
  /** Tree node id whose label row is in inline rename — hide row toolbar (✓/✗ stay on the label). */
  const [labelEditingNodeId, setLabelEditingNodeId] = React.useState<string | null>(null);
  const closeMenuTimerRef = React.useRef<number | null>(null);
  const labelEditRefs = React.useRef<Map<string, LabelWithPencilEditHandle>>(new Map());

  const useCaseById = React.useMemo(() => new Map(useCases.map((uc) => [uc.id, uc])), [useCases]);

  const clearCloseMenuTimer = React.useCallback(() => {
    if (closeMenuTimerRef.current !== null) {
      window.clearTimeout(closeMenuTimerRef.current);
      closeMenuTimerRef.current = null;
    }
  }, []);

  const openPlusMenu = React.useCallback(
    (nodeId: string) => {
      clearCloseMenuTimer();
      setOpenPlusMenuNodeId(nodeId);
    },
    [clearCloseMenuTimer]
  );

  const schedulePlusMenuClose = React.useCallback(() => {
    clearCloseMenuTimer();
    closeMenuTimerRef.current = window.setTimeout(() => {
      setOpenPlusMenuNodeId(null);
      closeMenuTimerRef.current = null;
    }, 160);
  }, [clearCloseMenuTimer]);

  React.useEffect(() => {
    return () => {
      clearCloseMenuTimer();
    };
  }, [clearCloseMenuTimer]);

  const handleToggleNote = React.useCallback(
    (useCaseId: string) => {
      setOpenNoteUseCaseId((prev) => {
        if (prev === useCaseId) return null;
        const saved = useCaseById.get(useCaseId)?.note ?? '';
        setNoteDraftByUseCaseId((d) => ({ ...d, [useCaseId]: d[useCaseId] ?? saved }));
        return useCaseId;
      });
    },
    [useCaseById]
  );

  const setLabelRef = React.useCallback((nodeId: string, el: LabelWithPencilEditHandle | null) => {
    const m = labelEditRefs.current;
    if (el) m.set(nodeId, el);
    else m.delete(nodeId);
  }, []);

  const renderNode = (node: UseCaseTreeNode, depth: number): React.ReactNode => {
    const nodeHasUseCase = !!node.useCaseId;
    const toneClass = nodeHasUseCase ? 'text-slate-100' : 'text-slate-500';
    const showToolbar = openPlusMenuNodeId === node.id || !!draggingUseCaseId;
    const labelEditingHere = labelEditingNodeId === node.id;

    return (
      <React.Fragment key={node.id}>
        <div
          className={`group relative flex items-center gap-1 px-1 py-0.5 text-xs rounded ${
            node.useCaseId && !labelEditingHere ? 'cursor-grab active:cursor-grabbing' : ''
          } ${node.useCaseId === selectedId ? 'bg-slate-700' : ''}`}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          title={
            node.useCaseId
              ? labelEditingHere
                ? undefined
                : 'Trascina per spostare nella cartella di destinazione'
              : undefined
          }
          onClick={() => {
            if (node.useCaseId) props.onSelect(node.useCaseId);
          }}
          draggable={!!node.useCaseId && !labelEditingHere}
          onDragStart={(e) => {
            setDraggingUseCaseId(node.useCaseId || null);
            try {
              e.dataTransfer.setData('text/plain', node.useCaseId ?? '');
              e.dataTransfer.effectAllowed = 'move';
            } catch {
              /* ignore */
            }
          }}
          onDragEnd={() => setDraggingUseCaseId(null)}
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (draggingUseCaseId) {
              props.onMoveToFolder(draggingUseCaseId, node.fullPath);
            }
            setDraggingUseCaseId(null);
          }}
        >
          {nodeHasUseCase ? (
            <MessageCircle size={12} className="text-slate-100 shrink-0" aria-hidden />
          ) : (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" aria-hidden />
          )}
          <div className="flex min-w-0 flex-1 items-center overflow-visible">
            <div className={`inline-flex min-w-0 max-w-[calc(100%-9rem)] ${toneClass}`}>
              <UseCaseTreeLabelEditor
                ref={(el) => setLabelRef(node.id, el)}
                value={node.name}
                editable
                editIntent={Boolean(props.editIntentUseCaseId && node.useCaseId === props.editIntentUseCaseId)}
                onConsumeEditIntent={props.onConsumeEditIntentUseCaseId}
                onEditingChange={(editing) => {
                  setLabelEditingNodeId((prev) => {
                    if (editing) return node.id;
                    if (prev === node.id) return null;
                    return prev;
                  });
                }}
                onCommit={(nextValue) => {
                  if (node.useCaseId) {
                    const parts = node.fullPath.split('.');
                    parts[parts.length - 1] = nextValue;
                    props.onRenameUseCase(node.useCaseId, parts.join('.'));
                  } else {
                    props.onRenameFolder(node.fullPath, nextValue);
                  }
                }}
              />
            </div>
            <div
              className={`ml-[5px] shrink-0 flex items-center gap-0.5 ${
                labelEditingHere
                  ? 'hidden'
                  : showToolbar
                    ? 'flex'
                    : 'hidden group-hover:flex'
              }`}
            >
            {node.useCaseId ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onRun(node.useCaseId!);
                }}
                title="Run use case"
                className="p-0.5 rounded hover:bg-slate-600/80"
              >
                <Play size={12} className="text-emerald-300" />
              </button>
            ) : (
              <span className="inline-block w-[18px] h-[18px] shrink-0" aria-hidden />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                labelEditRefs.current.get(node.id)?.startEditing();
              }}
              title="Rename"
              className="p-0.5 rounded hover:bg-slate-600/80"
            >
              <Pencil size={12} className="text-slate-200" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onDeleteNode(node.fullPath, node.useCaseId);
              }}
              title={node.useCaseId ? 'Delete use case' : 'Delete branch (all use cases under this path)'}
              className="p-0.5 rounded hover:bg-slate-600/80"
            >
              <Trash2 size={12} className="text-rose-300" />
            </button>
            <button
              type="button"
              disabled={!node.useCaseId}
              onClick={(e) => {
                e.stopPropagation();
                if (node.useCaseId) handleToggleNote(node.useCaseId);
              }}
              title={node.useCaseId ? 'Note' : 'No use case at this node'}
              className="p-0.5 rounded hover:bg-slate-600/80 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <span
                className={`text-[12px] leading-none ${
                  node.useCaseId && (useCaseById.get(node.useCaseId)?.note || '').trim()
                    ? 'text-yellow-300'
                    : 'text-slate-500'
                }`}
                aria-hidden
              >
                📝
              </span>
            </button>
            <span className="relative inline-flex shrink-0">
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => openPlusMenu(node.id)}
                onMouseLeave={schedulePlusMenuClose}
                title="Insert relative"
                className="p-0.5 rounded hover:bg-slate-600/80"
              >
                <Plus size={12} className="text-slate-200" />
              </button>
              {openPlusMenuNodeId === node.id ? (
                <UseCaseTreeContextMenu
                  onMouseEnter={() => openPlusMenu(node.id)}
                  onMouseLeave={schedulePlusMenuClose}
                  onBefore={() => {
                    props.onCreateRelativeUseCase(node.fullPath, 'before');
                    setOpenPlusMenuNodeId(null);
                  }}
                  onAfter={() => {
                    props.onCreateRelativeUseCase(node.fullPath, 'after');
                    setOpenPlusMenuNodeId(null);
                  }}
                  onChild={() => {
                    props.onCreateRelativeUseCase(node.fullPath, 'child');
                    setOpenPlusMenuNodeId(null);
                  }}
                />
              ) : null}
            </span>
          </div>
          </div>
        </div>
        {node.useCaseId && openNoteUseCaseId === node.useCaseId ? (
          <div style={{ paddingLeft: `${depth * 12 + 4}px` }} className="pr-1">
            <UseCaseNoteEditor
              key={node.useCaseId}
              value={noteDraftByUseCaseId[node.useCaseId] ?? useCaseById.get(node.useCaseId)?.note ?? ''}
              persistedNote={useCaseById.get(node.useCaseId)?.note ?? ''}
              onChange={(next) => {
                setNoteDraftByUseCaseId((prev) => ({ ...prev, [node.useCaseId!]: next }));
              }}
              hasSavedNote={((useCaseById.get(node.useCaseId)?.note ?? '').trim().length > 0)}
              onDeleteNote={() => {
                props.onSaveNote(node.useCaseId!, '');
                setNoteDraftByUseCaseId((prev) => ({ ...prev, [node.useCaseId!]: '' }));
              }}
              onConfirm={() => {
                props.onSaveNote(node.useCaseId!, noteDraftByUseCaseId[node.useCaseId] ?? '');
                setOpenNoteUseCaseId(null);
              }}
              onCancelNew={() => {
                const saved = useCaseById.get(node.useCaseId!)?.note ?? '';
                setNoteDraftByUseCaseId((prev) => ({ ...prev, [node.useCaseId!]: saved }));
                setOpenNoteUseCaseId(null);
              }}
            />
          </div>
        ) : null}
        {node.children.map((c) => renderNode(c, depth + 1))}
      </React.Fragment>
    );
  };

  return <div className="space-y-0.5">{tree.map((node) => renderNode(node, 0))}</div>;
}
