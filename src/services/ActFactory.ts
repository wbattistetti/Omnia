import { ProjectDataService } from './ProjectDataService';
import { EntityCreationService } from './EntityCreationService';
import { TaskType } from '../types/taskTypes';

type CreateAndAttachTaskOpts = {
  name: string;
  type: TaskType; // ✅ TaskType enum invece di string
  scope?: 'global' | 'industry';
  projectData: any;
  onImmediateRowUpdate: (patch: Record<string, any>) => void; // taskId/type/mode/... patch for row
  onInstanceCreated?: (instanceId: string) => void;
  getProjectId?: () => string | undefined;
};

export async function createAndAttachTask(opts: CreateAndAttachTaskOpts) { // ✅ RINOMINATO: createAndAttachAct → createAndAttachTask
  const {
    name,
    type,
    scope = 'industry',
    projectData,
    onImmediateRowUpdate,
    onInstanceCreated,
    getProjectId,
  } = opts;

  const projectIndustry = (projectData as any)?.industry;

  // 1) Create task in-memory synchronously with explicit type, suppress UI editors
  const created = EntityCreationService.createTaskTemplate({
    name,
    projectData,
    projectIndustry,
    scope,
    type: type, // ✅ TaskType enum (required)
    suppressUI: true,
  } as any);

  const factoryId = (created as any)?.factoryId ?? null;

  // 2) Immediate row patch
  onImmediateRowUpdate({
    factoryId,
    type,
  });

  // 3) Async instance creation and patch instanceId
  try {
    const pid = getProjectId?.();
    if (!pid) return;
    const inst = await ProjectDataService.createInstance(pid, { type });
    if ((inst as any)?._id) {
      // Re-assert type on async patch to avoid accidental resets from other updates
      onImmediateRowUpdate({ instanceId: (inst as any)._id, type });
      onInstanceCreated?.((inst as any)._id);
    }
  } catch (err) {
    try { console.warn('[TaskFactory] instance create failed', err); } catch {}
  }
}


