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
    const next = { ...node, subData: Array.isArray(node.subData) ? node.subData.slice() : [] } as SchemaNode;
    const old = String((next.subData![idx] as any)?.label || '');
    next.subData![idx] = { ...(next.subData![idx] || { label: '' }), label: subDraft } as SchemaNode;
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
    const next = { ...node, subData: Array.isArray(node.subData) ? node.subData.slice() : [] } as SchemaNode;
    next.subData!.push({ label: '', type: 'text', icon: 'FileText' } as any);
    onChange(next);
    setEditingSubIdx((next.subData!.length - 1));
    setSubDraft('');
    onChangeEvent?.({ type: 'sub.added', path: `${pathPrefix}/${(next.subData![next.subData!.length - 1] as any)?.label || 'sub'}` });
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


