import React from 'react';
import EscalationEditor from './EscalationEditor';

type Props = {
  escalations: any[]; // ✅ Lista delle escalations (fonte di verità)
  translations: Record<string, string>;
  color?: string;
  allowedActions?: string[];
  onEscalationsChange: (newEscalations: any[]) => void; // ✅ Passa l'array completo aggiornato
};

export default function StepEditor({
  escalations,
  translations,
  color = '#fb923c',
  allowedActions,
  onEscalationsChange
}: Props) {
  // ✅ Stato per gestire quale task editare automaticamente (condiviso tra escalations)
  const [autoEditTarget, setAutoEditTarget] = React.useState<{ escIdx: number; actIdx: number } | null>(null);

  // ✅ Callback per aggiornare una singola escalation
  const handleEscalationChange = React.useCallback((escalationIdx: number, newEscalation: any) => {
    const updated = escalations.map((esc: any, i: number) =>
      i === escalationIdx ? newEscalation : esc
    );
    onEscalationsChange(updated);
  }, [escalations, onEscalationsChange]);

  // ✅ Gestisce spostamenti di task tra escalations diverse
  const handleMoveTask = React.useCallback((
    fromEscIdx: number,
    fromTaskIdx: number,
    toEscIdx: number,
    toTaskIdx: number,
    position: 'before' | 'after'
  ) => {
    const next = [...escalations];
    const fromEsc = next[fromEscIdx];
    if (!fromEsc) return;

    const tasks = [...(fromEsc.tasks || [])];
    const task = tasks[fromTaskIdx];
    if (!task) return;

    // Rimuovi dalla posizione originale
    tasks.splice(fromTaskIdx, 1);
    next[fromEscIdx] = { ...fromEsc, tasks };

    // Aggiungi alla nuova posizione
    if (!next[toEscIdx]) {
      next[toEscIdx] = { tasks: [] };
    }
    const toTasks = [...(next[toEscIdx].tasks || [])];
    const insertIdx = position === 'after' ? toTaskIdx + 1 : toTaskIdx;
    toTasks.splice(insertIdx, 0, task);
    next[toEscIdx] = { ...next[toEscIdx], tasks: toTasks };

    onEscalationsChange(next);
  }, [escalations, onEscalationsChange]);

  return (
    <div className="step-editor" style={{ padding: '1rem' }}>
      {escalations.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          No escalations
        </div>
      ) : (
        escalations.map((esc, idx) => (
          <EscalationEditor
            key={idx}
            escalation={esc}
            escalationIdx={idx}
            translations={translations}
            color={color}
            allowedActions={allowedActions}
            onEscalationChange={(newEscalation) => handleEscalationChange(idx, newEscalation)}
            onMoveTask={handleMoveTask}
            autoEditTarget={autoEditTarget}
            onAutoEditTargetChange={setAutoEditTarget}
          />
        ))
      )}
    </div>
  );
}
