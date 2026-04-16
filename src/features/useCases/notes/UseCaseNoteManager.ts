import type { UseCase } from '../model';

/**
 * Stateless note manager for use-case notes.
 */
export const UseCaseNoteManager = {
  /**
   * Returns the persisted note for a specific use case.
   */
  getNote(useCases: readonly UseCase[], useCaseId: string): string | undefined {
    const id = String(useCaseId || '').trim();
    if (!id) {
      throw new Error('UseCaseNoteManager.getNote: useCaseId is required.');
    }
    const target = useCases.find((x) => x.id === id);
    if (!target) {
      throw new Error(`UseCaseNoteManager.getNote: use case "${id}" not found.`);
    }
    return target.note;
  },

  /**
   * Saves or removes the note for one use case and returns a new list.
   */
  setNote(useCases: readonly UseCase[], useCaseId: string, nextNote: string): UseCase[] {
    const id = String(useCaseId || '').trim();
    if (!id) {
      throw new Error('UseCaseNoteManager.setNote: useCaseId is required.');
    }
    const normalized = String(nextNote ?? '');
    let touched = false;
    const next = useCases.map((uc) => {
      if (uc.id !== id) return uc;
      touched = true;
      const trimmed = normalized.trim();
      if (!trimmed) {
        const { note: _note, ...rest } = uc;
        return rest;
      }
      return { ...uc, note: normalized };
    });
    if (!touched) {
      throw new Error(`UseCaseNoteManager.setNote: use case "${id}" not found.`);
    }
    return next;
  },
};

