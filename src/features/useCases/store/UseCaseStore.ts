import type { UseCase } from '../model';

/**
 * Minimal persistence store for use cases (localStorage-backed).
 */
export class UseCaseStore {
  private readonly storageKey: string;

  constructor(projectId: string) {
    const pid = String(projectId || '').trim();
    if (!pid) {
      throw new Error('UseCaseStore: projectId is required.');
    }
    this.storageKey = `omnia.useCases.${pid}`;
  }

  /**
   * Reads all persisted use cases.
   */
  list(): UseCase[] {
    const raw = this.readRaw();
    return raw
      .filter((x): x is UseCase => !!x && typeof x === 'object')
      .map((x) => ({
        id: String(x.id || '').trim(),
        key: String(x.key || '').trim(),
        label: String(x.label || '').trim(),
        note: typeof x.note === 'string' && x.note.trim().length > 0 ? x.note : undefined,
        steps: Array.isArray(x.steps) ? x.steps : [],
      }))
      .filter((x) => x.id && x.key && x.label);
  }

  /**
   * Inserts or updates one use case.
   */
  upsert(useCase: UseCase): UseCase[] {
    if (!useCase?.id || !useCase?.key || !useCase?.label) {
      throw new Error('UseCaseStore.upsert: id, key and label are required.');
    }
    const all = this.list();
    const idx = all.findIndex((x) => x.id === useCase.id);
    if (idx >= 0) {
      all[idx] = useCase;
    } else {
      all.push(useCase);
    }
    this.writeRaw(all);
    return all;
  }

  /**
   * Deletes one use case by id.
   */
  remove(id: string): UseCase[] {
    const rid = String(id || '').trim();
    if (!rid) {
      throw new Error('UseCaseStore.remove: id is required.');
    }
    const next = this.list().filter((x) => x.id !== rid);
    this.writeRaw(next);
    return next;
  }

  /**
   * Replaces all persisted use cases.
   */
  replaceAll(useCases: UseCase[]): UseCase[] {
    if (!Array.isArray(useCases)) {
      throw new Error('UseCaseStore.replaceAll: useCases must be an array.');
    }
    this.writeRaw(useCases);
    return this.list();
  }

  private readRaw(): any[] {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error('UseCaseStore: persisted payload is not an array.');
      }
      return parsed;
    } catch (error) {
      throw new Error(
        `UseCaseStore: invalid persisted payload (${error instanceof Error ? error.message : String(error)}).`
      );
    }
  }

  private writeRaw(useCases: UseCase[]): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(this.storageKey, JSON.stringify(useCases));
  }
}

