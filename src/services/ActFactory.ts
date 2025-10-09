import { ProjectDataService } from './ProjectDataService';
import { EntityCreationService } from './EntityCreationService';
import { typeToMode } from '../utils/normalizers';

type CreateAndAttachOpts = {
  name: string;
  type: string; // ActType
  scope?: 'global' | 'industry';
  projectData: any;
  onImmediateRowUpdate: (patch: Record<string, any>) => void; // actId/type/mode/... patch for row
  onInstanceCreated?: (instanceId: string) => void;
  getProjectId?: () => string | undefined;
};

export async function createAndAttachAct(opts: CreateAndAttachOpts) {
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
  const mode = typeToMode(type as any);

  // 1) Create act in-memory synchronously with explicit type/mode, suppress UI editors
  const created = EntityCreationService.createAgentAct({
    name,
    projectData,
    projectIndustry,
    scope,
    type: type as any,
    mode: mode as any,
    suppressUI: true,
  } as any);

  const actId = (created as any)?.actId || (created as any)?.id;
  const factoryId = (created as any)?.factoryId ?? null;

  // 2) Immediate row patch
  onImmediateRowUpdate({
    actId,
    baseActId: actId,
    factoryId,
    type,
    mode,
  });

  // 3) Async instance creation and patch instanceId
  try {
    const pid = getProjectId?.() ||
      (typeof window !== 'undefined' && ((window as any).__currentProjectId || (window as any).__projectId));
    if (!pid || !actId) return;
    const inst = await ProjectDataService.createInstance(pid, { baseActId: actId, mode });
    if ((inst as any)?._id) {
      // Re-assert type/mode on async patch to avoid accidental resets from other updates
      onImmediateRowUpdate({ instanceId: (inst as any)._id, type, mode });
      onInstanceCreated?.((inst as any)._id);
    }
  } catch (err) {
    try { console.warn('[ActFactory] instance create failed', err); } catch {}
  }
}


