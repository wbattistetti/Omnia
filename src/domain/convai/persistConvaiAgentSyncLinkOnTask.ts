/**

 * Persiste collegamento task ↔ agente ElevenLabs dopo sync ConvAI riuscita.

 */



import type { ConvaiAgentSyncResult } from './convaiAgentSyncTypes';

import { serializeAgentElevenLabsConvaiLink } from './agentElevenLabsConvaiLink';

import { saveAgentElevenLabsConvaiLinkToDb } from './saveAgentElevenLabsConvaiLinkToDb';

import { taskRepository } from '@services/TaskRepository';

import { setConvaiSessionBinding } from '@utils/iaAgentRuntime/convaiSessionAgentStore';

import type { Task } from '@types/taskTypes';



export type PersistConvaiAgentSyncLinkResult = {

  memoryOk: true;

  dbOk: boolean;

  dbError?: string;

};



/** Scrive link su TaskRepository, session binding e Mongo (se projectId presente). */

export async function persistConvaiAgentSyncLinkOnTask(

  agentTaskId: string,

  result: ConvaiAgentSyncResult,

  projectId?: string

): Promise<PersistConvaiAgentSyncLinkResult> {

  const tid = String(agentTaskId ?? '').trim();

  if (!tid || !result.link) {

    return { memoryOk: true, dbOk: false, dbError: 'taskId o link mancanti' };

  }

  const linkJson = serializeAgentElevenLabsConvaiLink(result.link);

  taskRepository.updateTask(

    tid,

    { agentElevenLabsConvaiLinkJson: linkJson } as Partial<Task>,

    projectId || undefined

  );

  setConvaiSessionBinding(tid, result.agentId, 'omnia-sync');



  const pid = String(projectId ?? '').trim();

  if (!pid) {

    return { memoryOk: true, dbOk: false, dbError: 'projectId mancante' };

  }

  const saved = await saveAgentElevenLabsConvaiLinkToDb(pid, tid, result.link);

  return saved.ok

    ? { memoryOk: true, dbOk: true }

    : { memoryOk: true, dbOk: false, dbError: saved.error };

}

