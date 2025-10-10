import React, { useLayoutEffect } from 'react';
import type { NodeProps } from 'reactflow';
import { NodeHandles } from './NodeHandles';
import { NodeHeader } from './NodeHeader';
import { CheckSquare } from 'lucide-react';

export interface TaskNodeData {
	title: string;
	onUpdate?: (updates: any) => void;
	editOnMount?: boolean;
	onCommitTitle?: (title: string) => void;
	onCancelTitle?: () => void;
}

export const TaskNode: React.FC<NodeProps<TaskNodeData>> = ({ data, selected, isConnectable }) => {
	const [title, setTitle] = React.useState<string>(data?.title ?? '');
	const inputRef = React.useRef<HTMLInputElement>(null);
  const DEBUG_FOCUS = (() => { try { return localStorage.getItem('debug.focus') === '1'; } catch { return false; } })();
  const log = (...args: any[]) => { if (DEBUG_FOCUS) { try { console.log('[Focus][TaskNode]', ...args); } catch {} } };

  useLayoutEffect(() => {
    if (!(data?.editOnMount || (data as any)?.editSignal)) return;
    const el = inputRef.current;
    if (el) {
      try { el.focus({ preventScroll: true } as any); el.select(); log('focused on mount'); } catch { log('focus error'); }
    }
  }, [data?.editOnMount, (data as any)?.editSignal]);

	const commit = (v: string) => {
		const next = (v || '').trim() || 'Task';
		if (typeof data?.onUpdate === 'function') {
			data.onUpdate({ data: { ...(data as any), title: next, editOnMount: false, showGuide: false } });
		}
		try { (data as any)?.onCommitTitle?.(next); } catch {}
	};

	return (
		<div
			className={`bg-orange-500 text-white border-black rounded-lg shadow-xl min-h-[40px] relative ${selected ? 'border-2' : 'border'}`}
			style={{ minWidth: 140, width: 'fit-content' }}
			tabIndex={-1}
		>
			<div className="relative" style={{ marginBottom: 0, paddingBottom: 0 }}>
				{data?.editOnMount ? (
                    <div className="flex items-center gap-2 px-2 py-1">
						<CheckSquare className="w-3.5 h-3.5" />
						<input
							ref={inputRef}
                            autoFocus
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									commit(title);
								} else if (e.key === 'Escape') {
									try { (data as any)?.onCancelTitle?.(); } catch {}
								}
							}}
                            onBlur={() => commit(title)}
                            placeholder="Scrivi il nome del task"
                            className="bg-white text-black text-xs rounded px-2 py-1 outline-none border border-slate-300 focus:border-slate-500"
							style={{ minWidth: 120 }}
						/>
					</div>
				) : (
					<NodeHeader
						title={title}
						onDelete={() => { if (typeof (data as any)?.onDelete === 'function') (data as any).onDelete(); }}
						onToggleEdit={() => {/* no-op */}}
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


