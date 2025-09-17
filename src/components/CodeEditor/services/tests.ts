import { RunTestsReq, RunTestsResp } from '../models/types';

export function runInWorker(req: RunTestsReq): Promise<RunTestsResp> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL('../../../workers/testRunner.worker.ts', import.meta.url), { type: 'module' } as any);
      worker.onmessage = (e: MessageEvent<RunTestsResp>) => { resolve(e.data); worker.terminate(); };
      worker.onerror = (err) => { reject(err); worker.terminate(); };
      worker.postMessage(req);
    } catch (e) { reject(e); }
  });
}




