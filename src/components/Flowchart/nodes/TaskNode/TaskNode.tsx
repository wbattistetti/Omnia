import React, { useLayoutEffect } from 'react';
import type { NodeProps } from 'reactflow';
import { NodeHandles } from '../../NodeHandles';
import { NodeHeader } from '../CustomNode/NodeHeader';
import { CheckSquare } from 'lucide-react';
import { dlog } from '../../../../utils/debug';

// Debug gate for TaskNode focus/keys
const taskDbg = () => {
  try { return localStorage.getItem('debug.task') === '1'; } catch { return false; }
};
const tlog = (...args: any[]) => { if (taskDbg()) { try { console.log('[TaskDbg]', ...args); } catch { } } };

export interface TaskNodeData {
  title: string;
  onUpdate?: (updates: any) => void;
  editingToken?: string;
  onCommitTitle?: (title: string) => void;
  onCancelTitle?: () => void;
}

export const TaskNode: React.FC<NodeProps<TaskNodeData>> = ({ id, data, selected, isConnectable }) => {
  const [title, setTitle] = React.useState<string>(data?.title ?? '');
  const [editing, setEditing] = React.useState<boolean>(Boolean(data?.editOnMount));
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Entra in editing quando cambia il token immutabile
  React.useEffect(() => {
    // Solo alla creazione: serve token e titolo ancora vuoto
    if (!data?.editingToken || (title || '').trim().length > 0) return;
    setEditing(true);
    const idAnim = requestAnimationFrame(() => {
      const el = inputRef.current as HTMLInputElement | null;
      tlog('focus.attempt', { id, token: data.editingToken, hasRef: Boolean(el) });
      try { if (el) { el.focus(); el.select(); tlog('focus.ok', { id }); } } catch { }
    });
    return () => cancelAnimationFrame(idAnim);
  }, [data?.editingToken, title]);

  React.useEffect(() => { tlog('editing->', editing, { id, editOnMount: data?.editOnMount }); }, [editing, data?.editOnMount, id]);

  const commit = (v: string) => {
    const next = (v || '').trim() || 'Task';
    tlog('commit()', { id, next });
    setEditing(false);
    if (typeof data?.onUpdate === 'function') {
      // rimuovi editingToken così non va più in edit al reload
      data.onUpdate({ title: next, editOnMount: false, editingToken: undefined, showGuide: false });
    }
    try { (data as any)?.onCommitTitle?.(next); } catch { }
  };

  const cancel = () => {
    tlog('cancel()', { id });
    setEditing(false);
    // pulisci anche in cancel (es. ESC)
    if (typeof data?.onUpdate === 'function') data.onUpdate({ editOnMount: false, editingToken: undefined });
    try { (data as any)?.onCancelTitle?.(); } catch { }
  };

  return (
    <div
      className={`bg-orange-500 text-white border-black rounded-lg shadow-xl min-h-[40px] relative ${selected ? 'border-2' : 'border'}`}
      style={{ minWidth: 140, width: 'fit-content' }}
      tabIndex={-1}
    >
      <div className="relative" style={{ marginBottom: 0, paddingBottom: 0 }}>
        {editing ? (
          <div className="flex items-center gap-2 px-2 py-1">
            <CheckSquare className="w-3.5 h-3.5" />
            <input
              ref={inputRef}
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (taskDbg()) tlog('keydown', { key: e.key, id, defaultPrevented: e.defaultPrevented });
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit(title);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancel();
                }
              }}
              onKeyUp={(e) => {
                if (taskDbg()) tlog('keyup', { key: e.key, id });
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  e.preventDefault();
                  commit(title);
                } else if (e.key === 'Escape') {
                  e.stopPropagation();
                  e.preventDefault();
                  cancel();
                }
              }}
              onKeyDownCapture={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onFocus={() => { tlog('focus', { id, value: title }); }}
              onBlur={() => { tlog('blur.commit', { id, value: title }); commit(title); }}
              placeholder="Scrivi il nome del task"
              className="bg-white text-black text-xs rounded px-2 py-1 outline-none border border-slate-300 focus:border-slate-500"
              style={{ minWidth: 120 }}
              data-testid="task-title-input"
            />
          </div>
        ) : (
          <NodeHeader
            title={title}
            onDelete={() => { if (typeof (data as any)?.onDelete === 'function') (data as any).onDelete(); }}
            onToggleEdit={() => {/* no-op */ }}
            onTitleUpdate={(t) => { setTitle(t); commit(t); }}
            isEditing={false}
            startEditingTitle={false}
            leftIcon={<CheckSquare className="w-3.5 h-3.5" />}
            bgClass="bg-transparent text-white"
            borderBottom={false}
          />
        )}
      </div>
      {/* Nessun body per Task; il contenitore arancione riempie tutto */}
      <NodeHandles isConnectable={!!isConnectable} />
    </div>
  );
};

export default TaskNode;


