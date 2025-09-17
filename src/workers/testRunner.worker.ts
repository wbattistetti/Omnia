import { RunTestsReq, RunTestsResp } from '../components/CodeEditor/models/types';
import { evaluateAssertions } from '../components/CodeEditor/utils/assert';

// Simple sandbox using Function inside worker (not main thread)
self.onmessage = async (e: MessageEvent<RunTestsReq>) => {
  const req = e.data;
  const results: RunTestsResp['results'] = [];
  const start = performance.now();
  try {
    // compile user code to function main(ctx)
    const wrapped = `"use strict";${req.code}\nreturn (typeof main==='function')? main : null;`;
    // eslint-disable-next-line no-new-func
    const factory = new Function(wrapped);
    const mainFn = factory();
    if (!mainFn) throw new Error('main(ctx) not found');

    for (const c of req.suite.cases) {
      try {
        const out = await Promise.resolve(mainFn({ ...(req.suite.defaults || {}), ...(c.values || {}) }));
        const check = evaluateAssertions(out, c.assertions || []);
        results.push({ caseId: c.id, ok: check.ok, error: check.error, output: out });
      } catch (err: any) {
        results.push({ caseId: c.id, ok: false, error: err?.message || String(err) });
      }
    }
  } catch (err: any) {
    // mark all as failed
    for (const c of req.suite.cases) results.push({ caseId: c.id, ok: false, error: err?.message || String(err) });
  }
  const ms = Math.round(performance.now() - start);
  const pass = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok && !r.error?.includes('blocked')).length;
  const blocked = 0;
  const resp: RunTestsResp = { pass, fail, blocked, ms, results };
  (self as any).postMessage(resp);
};




