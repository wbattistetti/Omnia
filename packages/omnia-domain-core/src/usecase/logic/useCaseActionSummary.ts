/**
 * Etichetta leggibile per righe azione use case (review UI, senza ResponseEditor).
 */

export type UseCaseActionTaskSummaryInput = {
  id: string;
  label?: string;
  templateId?: string;
  type?: string | number;
};

export function summarizeUseCaseActionLabel(task: UseCaseActionTaskSummaryInput): string {
  const label = typeof task.label === 'string' ? task.label.trim() : '';
  if (label) return label;
  const tid = typeof task.templateId === 'string' ? task.templateId.trim() : '';
  if (tid) return tid;
  return String(task.type ?? 'Azione');
}
