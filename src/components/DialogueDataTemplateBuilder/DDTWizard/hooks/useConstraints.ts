import { useState, useRef } from 'react';
import type { SchemaNode } from '../dataCollection';

interface UseConstraintsProps {
  node: SchemaNode;
  pathPrefix?: string;
  onChange: (node: SchemaNode) => void;
  onChangeEvent?: (e: { type: string; path: string; payload?: any }) => void;
}

export function useConstraints({ node, pathPrefix = '', onChange, onChangeEvent }: UseConstraintsProps) {
  const [hoverMainConstraints, setHoverMainConstraints] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState<
    | { scope: 'main'; idx: number }
    | { scope: 'sub'; subIdx: number; idx: number }
    | null
  >(null);
  const lastAddedConstraintRef = useRef<null | { scope: 'main' | 'sub'; idx: number; subIdx?: number }>(null);
  const [, setConstraintTitleDraft] = useState<string>('');
  const [constraintPayoffDraft, setConstraintPayoffDraft] = useState('');

  const ensureMainConstraints = () => Array.isArray(node.constraints) ? node.constraints.slice() : [];

  const ensureSubConstraints = (subIdx: number) => {
    // ✅ Support both subTasks (from buildDataTree) and subData (legacy)
    const subTasks = (node as any).subTasks || node.subData || [];
    const sub = subTasks[subIdx];
    const arr = sub && Array.isArray(sub.constraints) ? sub.constraints.slice() : [];
    return arr;
  };

  const addMainConstraint = () => {
    const next = { ...node } as SchemaNode;
    const list = ensureMainConstraints();
    const newIdx = list.length;
    list.push({ kind: 'length', title: '', payoff: '' } as any);
    next.constraints = list;
    onChange(next);
    setEditingConstraint({ scope: 'main', idx: newIdx });
    setConstraintTitleDraft('');
    setConstraintPayoffDraft('');
    lastAddedConstraintRef.current = { scope: 'main', idx: newIdx };
    onChangeEvent?.({ type: 'constraint.added', path: `${pathPrefix}::constraint#${newIdx}` });
  };

  const addSubConstraint = (subIdx: number) => {
    // ✅ Support both subTasks (from buildDataTree) and subData (legacy)
    const subTasks = (node as any).subTasks || node.subData || [];
    const next = { ...node, subTasks: Array.isArray(subTasks) ? subTasks.slice() : [], subData: undefined } as SchemaNode;
    const sub = { ...(next.subTasks?.[subIdx] || {}) } as any;
    const list = Array.isArray(sub.constraints) ? sub.constraints.slice() : [];
    const newIdx = list.length;
    list.push({ kind: 'length', title: '', payoff: '' } as any);
    sub.constraints = list;
    (next.subTasks as any)[subIdx] = sub;
    onChange(next);
    setEditingConstraint({ scope: 'sub', subIdx, idx: newIdx });
    setConstraintTitleDraft('');
    setConstraintPayoffDraft('');
    lastAddedConstraintRef.current = { scope: 'sub', subIdx, idx: newIdx };
    onChangeEvent?.({ type: 'constraint.added', path: `${pathPrefix}/${(next.subTasks?.[subIdx] as any)?.label || 'sub'}::constraint#${newIdx}` });
  };

  const startEditConstraint = (scope: 'main' | 'sub', idx: number, subIdx?: number) => {
    if (scope === 'main') {
      const c = ensureMainConstraints()[idx];
      setConstraintTitleDraft(c?.title || '');
      setConstraintPayoffDraft(c?.payoff || '');
      setEditingConstraint({ scope: 'main', idx });
    } else if (typeof subIdx === 'number') {
      const c = ensureSubConstraints(subIdx)[idx];
      setConstraintTitleDraft(c?.title || '');
      setConstraintPayoffDraft(c?.payoff || '');
      setEditingConstraint({ scope: 'sub', subIdx, idx });
    }
  };

  const commitConstraint = () => {
    if (!editingConstraint) return;
    if (editingConstraint.scope === 'main') {
      const list = ensureMainConstraints();
      if (list[editingConstraint.idx]) {
        list[editingConstraint.idx] = { ...list[editingConstraint.idx], title: (list[editingConstraint.idx] as any)?.title || '', payoff: constraintPayoffDraft } as any;
        onChange({ ...node, constraints: list });
      }
    } else {
      const { subIdx, idx } = editingConstraint as any;
      // ✅ Support both subTasks (from buildDataTree) and subData (legacy)
      const subTasks = (node as any).subTasks || node.subData || [];
      const next = { ...node, subTasks: Array.isArray(subTasks) ? subTasks.slice() : [], subData: undefined } as SchemaNode;
      const sub = { ...(next.subTasks?.[subIdx] || {}) } as any;
      const list = Array.isArray(sub.constraints) ? sub.constraints.slice() : [];
      if (list[idx]) list[idx] = { ...list[idx], title: (list[idx] as any)?.title || '', payoff: constraintPayoffDraft } as any;
      sub.constraints = list;
      (next.subTasks as any)[subIdx] = sub;
      onChange(next);
    }
    setEditingConstraint(null);
    setConstraintTitleDraft('');
    setConstraintPayoffDraft('');
    lastAddedConstraintRef.current = null;
    onChangeEvent?.({ type: 'constraint.updated', path: `${pathPrefix}` });
  };

  const cancelConstraint = () => {
    // If the currently edited constraint was just created, remove it
    if (editingConstraint && lastAddedConstraintRef.current) {
      const a = lastAddedConstraintRef.current;
      if (a.scope === 'main' && editingConstraint.scope === 'main' && a.idx === editingConstraint.idx) {
        const list = ensureMainConstraints();
        const nextList = list.filter((_, i) => i !== a.idx);
        onChange({ ...node, constraints: nextList } as any);
        lastAddedConstraintRef.current = null;
        onChangeEvent?.({ type: 'constraint.removed', path: `${pathPrefix}::constraint#${a.idx}` });
      } else if (a.scope === 'sub' && editingConstraint.scope === 'sub' && a.idx === editingConstraint.idx && a.subIdx === editingConstraint.subIdx) {
        // ✅ Support both subTasks (from buildDataTree) and subData (legacy)
        const subTasks = (node as any).subTasks || node.subData || [];
        const next = { ...node, subTasks: Array.isArray(subTasks) ? subTasks.slice() : [], subData: undefined } as any;
        const sub = { ...(next.subTasks?.[a.subIdx!] || {}) };
        const list = Array.isArray(sub.constraints) ? sub.constraints.slice() : [];
        sub.constraints = list.filter((_: any, i: number) => i !== a.idx);
        next.subTasks[a.subIdx!] = sub;
        onChange(next);
        lastAddedConstraintRef.current = null;
        onChangeEvent?.({ type: 'constraint.removed', path: `${pathPrefix}/${(sub as any)?.label || 'sub'}::constraint#${a.idx}` });
      }
    }
    setEditingConstraint(null);
    setConstraintTitleDraft('');
    setConstraintPayoffDraft('');
  };

  const deleteConstraint = (scope: 'main' | 'sub', idx: number, subIdx?: number) => {
    if (scope === 'main') {
      const list = ensureMainConstraints();
      const nextList = list.filter((_, i) => i !== idx);
      onChange({ ...node, constraints: nextList });
    } else if (typeof subIdx === 'number') {
      // ✅ Support both subTasks (from buildDataTree) and subData (legacy)
      const subTasks = (node as any).subTasks || node.subData || [];
      const next = { ...node, subTasks: Array.isArray(subTasks) ? subTasks.slice() : [], subData: undefined } as SchemaNode;
      const sub = { ...(next.subTasks?.[subIdx] || {}) } as any;
      const list = Array.isArray(sub.constraints) ? sub.constraints.slice() : [];
      sub.constraints = list.filter((_: any, i: number) => i !== idx);
      (next.subTasks as any)[subIdx] = sub;
      onChange(next);
    }
  };

  return {
    hoverMainConstraints,
    setHoverMainConstraints,
    editingConstraint,
    constraintPayoffDraft,
    setConstraintPayoffDraft,
    addMainConstraint,
    addSubConstraint,
    startEditConstraint,
    commitConstraint,
    cancelConstraint,
    deleteConstraint,
  };
}

