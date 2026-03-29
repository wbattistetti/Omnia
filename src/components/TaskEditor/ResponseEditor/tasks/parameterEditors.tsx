/**
 * Registry: parameterId -> editor component. Add new parameters by extending the registry only.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { EditableMessage } from '@responseEditor/tasks/editors/EditableMessage';
import {
  getScalarParameterValue,
  getTranslatedParameterText,
} from '@responseEditor/utils/taskUiText';
import { useBehaviourUi } from '@responseEditor/behaviour/BehaviourUiContext';
import type { BehaviourFocusTarget } from '@responseEditor/behaviour/BehaviourUiContext';

export type ParameterEditorProps = {
  task: unknown;
  param: { parameterId: string; value: unknown };
  translations: Record<string, string>;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onCommit: (value: string) => void;
  onAbort: () => void;
};

function GenericParameterFallback({ param }: Pick<ParameterEditorProps, 'param'>) {
  const v = param.value;
  const s =
    v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return (
    <span style={{ color: '#94a3b8', fontSize: 13 }} title={param.parameterId}>
      <span style={{ color: '#64748b', marginRight: 6 }}>{param.parameterId}:</span>
      {s || '—'}
    </span>
  );
}

function ScalarReadonlyField({ task, param }: Pick<ParameterEditorProps, 'task' | 'param'>) {
  const display = getScalarParameterValue(task, param.parameterId);
  return (
    <span style={{ color: '#e2e8f0', fontSize: 14 }}>
      <span style={{ color: '#64748b', marginRight: 6 }}>{param.parameterId}:</span>
      {display || '—'}
    </span>
  );
}

function TextLikeEditor(props: ParameterEditorProps & { placeholder?: string }) {
  const { task, param, translations, editing, onEditingChange, onCommit, onAbort, placeholder } = props;
  const value = getTranslatedParameterText(task, param.parameterId, translations);
  return (
    <EditableMessage
      value={value}
      editing={editing}
      onEditingChange={onEditingChange}
      onCommit={onCommit}
      onAbort={onAbort}
      placeholder={placeholder}
    />
  );
}

const registry: Record<string, React.FC<ParameterEditorProps>> = {
  text: (p) => <TextLikeEditor {...p} placeholder="Scrivi un testo qui..." />,
  smsText: (p) => <TextLikeEditor {...p} placeholder="Testo SMS..." />,
  phoneNumber: (p) => <ScalarReadonlyField task={p.task} param={p.param} />,
  voice: (p) => <ScalarReadonlyField task={p.task} param={p.param} />,
  language: (p) => <ScalarReadonlyField task={p.task} param={p.param} />,
  audioUrl: (p) => <ScalarReadonlyField task={p.task} param={p.param} />,
  volume: (p) => <ScalarReadonlyField task={p.task} param={p.param} />,
};

export function ParameterEditor(props: ParameterEditorProps) {
  const C = registry[props.param.parameterId] ?? GenericParameterFallback;
  return <C {...props} />;
}

function matchesFocus(
  f: BehaviourFocusTarget | null,
  escalationIdx: number,
  taskIdx: number,
  parameterId: string
): boolean {
  return (
    f != null &&
    f.kind === 'parameter' &&
    f.escalationIdx === escalationIdx &&
    f.taskIdx === taskIdx &&
    f.parameterId === parameterId
  );
}

export type ParameterFieldHostProps = {
  task: unknown;
  param: { parameterId: string; value: unknown };
  translations: Record<string, string>;
  escalationIdx: number;
  taskIdx: number;
  onCommit: (value: string) => void;
  /** Notifies parent when inline editing toggles (row chrome, DnD). */
  onEditingActivity?: (active: boolean) => void;
};

/**
 * Opens editor when BehaviourUi focus matches this field; consumes focus once (no editing dep).
 */
const TRANSLATED_EDITABLE_IDS = new Set(['text', 'smsText']);

function FocusAwareTranslatedField({
  task,
  param,
  translations,
  escalationIdx,
  taskIdx,
  onCommit,
  onEditingActivity,
}: ParameterFieldHostProps) {
  const { focusedParameter, consumeFocusParameter } = useBehaviourUi();
  const [editing, setEditing] = useState(false);

  const setEditingTracked = useCallback(
    (next: boolean) => {
      setEditing(next);
      onEditingActivity?.(next);
    },
    [onEditingActivity]
  );

  useEffect(() => {
    if (!focusedParameter) return;
    if (!matchesFocus(focusedParameter, escalationIdx, taskIdx, param.parameterId)) return;
    setEditing(true);
    onEditingActivity?.(true);
    consumeFocusParameter(focusedParameter);
  }, [focusedParameter, escalationIdx, taskIdx, param.parameterId, consumeFocusParameter, onEditingActivity]);

  return (
    <ParameterEditor
      task={task}
      param={param}
      translations={translations}
      editing={editing}
      onEditingChange={setEditingTracked}
      onCommit={(v) => {
        onCommit(v);
        setEditingTracked(false);
      }}
      onAbort={() => setEditingTracked(false)}
    />
  );
}

export function ParameterFieldHost(props: ParameterFieldHostProps) {
  if (TRANSLATED_EDITABLE_IDS.has(props.param.parameterId)) {
    return <FocusAwareTranslatedField {...props} />;
  }
  return (
    <ParameterEditor
      task={props.task}
      param={props.param}
      translations={props.translations}
      editing={false}
      onEditingChange={() => {}}
      onCommit={() => {}}
      onAbort={() => {}}
    />
  );
}
