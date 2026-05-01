/**
 * Entry-point unico: Task[] + manuali → righe catalogo (refresh vista, senza rete).
 */

import type { Task } from '../../types/taskTypes';
import type { ManualCatalogEntry } from './catalogTypes';
import { deriveBackendRefsFromTasks } from './deriveFromTasks';
import { rebuildCatalog } from './rebuildCatalog';

export function buildProjectBackendCatalogView(tasks: Task[], manualEntries: ManualCatalogEntry[]) {
  const derived = deriveBackendRefsFromTasks(tasks);
  return rebuildCatalog({ derived, manualEntries });
}
