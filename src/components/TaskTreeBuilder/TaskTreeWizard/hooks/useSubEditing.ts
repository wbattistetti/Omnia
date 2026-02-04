import { useState } from 'react';
import type { SchemaNode } from '../dataCollection';

interface UseSubEditingProps {
  node: SchemaNode;
  pathPrefix?: string;
  onChange: (node: SchemaNode) => void;
  onChangeEvent?: (e: { type: string; path: string; payload?: any }) => void;
}

export function useSubEditing({ node, pathPrefix = '', onChange, onChangeEvent }: UseSubEditingProps) {
  const [editingSubIdx, setEditingSubIdx] = useState<number | null>(null);
  const [subDraft, setSubDraft] = useState<string>('');

  const startEditSub = (idx: number, current: string) => {
    setEditingSubIdx(idx);
    setSubDraft(current || '');
  };

  const commitSub = (idx: number) => {
    // ✅ Support both subTasks (from buildDataTree) and subData (legacy)
    const subTasks = (node as any).subTasks || node.subData || [];
    const next = { ...node, subTasks: Array.isArray(subTasks) ? subTasks.slice() : [], subData: undefined } as SchemaNode;
    const old = String((next.subTasks![idx] as any)?.label || '');
    next.subTasks![idx] = { ...(next.subTasks![idx] || { label: '' }), label: subDraft } as SchemaNode;
    onChange(next);
    setEditingSubIdx(null);
    setSubDraft('');
    if (old !== subDraft) {
      onChangeEvent?.({ type: 'sub.renamed', path: `${pathPrefix}/${subDraft}`, payload: { oldPath: `${pathPrefix}/${old}` } });
    }
  };

  const cancelSub = () => {
    setEditingSubIdx(null);
    setSubDraft('');
  };

  const handleQuickAddSub = () => {
    // ✅ Support both subTasks (from buildDataTree) and subData (legacy)
    const subTasks = (node as any).subTasks || node.subData || [];
    const next = { ...node, subTasks: Array.isArray(subTasks) ? subTasks.slice() : [], subData: undefined } as SchemaNode;
    next.subTasks!.push({ label: '', type: 'text', icon: 'FileText' } as any);
    onChange(next);
    setEditingSubIdx((next.subTasks!.length - 1));
    setSubDraft('');
    onChangeEvent?.({ type: 'sub.added', path: `${pathPrefix}/${(next.subTasks![next.subTasks!.length - 1] as any)?.label || 'sub'}` });
  };

  return {
    editingSubIdx,
    subDraft,
    setSubDraft,
    startEditSub,
    commitSub,
    cancelSub,
    handleQuickAddSub
  };
}


