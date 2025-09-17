import React from 'react';
import CodeEditor from '../components/CodeEditor/CodeEditor';
import { EditToPatchReq, UnifiedDiff, RunTestsReq, RunTestsResp } from '../components/CodeEditor/models/types';
import { runInWorker } from '../components/CodeEditor/services/tests';

const initialCode = `export function main(ctx){ const age=Number(ctx.age||0); const vip=!!ctx.vip; return vip || age>=18; }`;

export default function Demo() {
  return (
    <div className="w-full h-screen p-4 bg-slate-900 text-slate-100">
      <h1 className="text-xl font-bold mb-2">CodeEditor demo</h1>
      <div className="h-[80vh]">
        <CodeEditor
          initialCode={initialCode}
          initialMode="predicate"
          ai={{
            async codeEditToPatch(req: EditToPatchReq): Promise<UnifiedDiff> {
              // naive diff: replace ">=18" with ">=21" to simulate patch with 3 hunks
              const patched = req.execution.code.replace('>=18', '>=18/*patched*/');
              return `--- a/code\n+++ b/code\n@@ -1,1 +1,1 @@\n-${req.execution.code}\n+${patched}`;
            },
          }}
          tests={{
            run: async (r: RunTestsReq): Promise<RunTestsResp> => runInWorker(r),
          }}
        />
      </div>
    </div>
  );
}




