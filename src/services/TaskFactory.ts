import { EntityCreationService } from './EntityCreationService';
import { TaskType } from '../types/taskTypes';
import { taskRepository } from './TaskRepository';

type CreateAndAttachTaskOpts = {
  name: string;
  type: TaskType; // ✅ TaskType enum invece di string
  scope?: 'global' | 'industry';
  projectData: any;
  onImmediateRowUpdate: (patch: Record<string, any>) => void; // taskId/type/mode/... patch for row
  onInstanceCreated?: (instanceId: string) => void;
  getProjectId?: () => string | undefined;
};

export async function createAndAttachTask(opts: CreateAndAttachTaskOpts) {
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

  // 3) ✅ REMOVED: createInstance (legacy act_instances) - replaced with taskRepository.createTask
  // ✅ Note: Task creation is now handled by createRowWithTask() in NodeRow.tsx
  // ✅ This function is kept for backward compatibility but task creation happens elsewhere
}


