import React from 'react';
import { taskRepository } from '../../../services/TaskRepository';

export interface NonInteractiveResponse {
  template: string;
  vars?: string[];
  samples?: Record<string, string>;
}

export interface NonInteractiveResponseEditorProps {
  nodeId?: string | number;
  value: NonInteractiveResponse;
  onChange: (next: NonInteractiveResponse) => void;
  onClose?: () => void;
  instanceId?: string; // ID dell'istanza per aggiornare instanceRepository
}

function extractTemplateVars(template: string): string[] {
  const set = new Set<string>();
  const re = /\{([a-zA-Z0-9_.]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    const v = (m[1] || '').trim();
    if (v) set.add(v);
  }
  return Array.from(set);
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '2px 8px',
  borderRadius: 999,
  background: 'rgba(59,130,246,0.12)',
  border: '1px solid rgba(59,130,246,0.45)',
  color: '#93c5fd',
  fontSize: 12,
};

export default function NonInteractiveResponseEditor({ value, onChange, onClose, instanceId }: NonInteractiveResponseEditorProps) {
  const [template, setTemplate] = React.useState<string>(value?.template || '');
  const vars = React.useMemo(() => extractTemplateVars(template), [template]);
  const [samples, setSamples] = React.useState<Record<string, string>>(() => ({ ...(value?.samples || {}) }));

  // FASE 3: Update Task when template changes (TaskRepository syncs with InstanceRepository automatically)
  React.useEffect(() => {
    if (instanceId && template !== undefined) {
      taskRepository.updateTaskValue(instanceId, { text: template });
    }
  }, [template, instanceId]);

  // propagate upwards (debounced light)
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      onChange({ template, vars, samples });
    }, 200);
    return () => window.clearTimeout(id);
  }, [template, JSON.stringify(samples)]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ height: '100%' }}>
      <textarea
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        placeholder="Scrivi il messaggio... Usa {nomeVariabile} per i segnaposto"
        style={{ width: '100%', height: '100%', resize: 'none', border: '1px solid #ddd', borderRadius: 8, padding: 12, fontSize: 15, lineHeight: 1.45 }}
      />
    </div>
  );
}

export { extractTemplateVars };


