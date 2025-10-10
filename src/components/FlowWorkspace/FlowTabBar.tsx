import React from 'react';
import { useFlowWorkspace, useFlowActions } from '../../flows/FlowStore.tsx';
import { GitBranch } from 'lucide-react';

export const FlowTabBar: React.FC = () => {
  const { openFlows, activeFlowId, flows } = useFlowWorkspace();
  const { setActiveFlow, closeFlow } = useFlowActions();

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-300 bg-white sticky top-0 z-10" style={{ minHeight: 30 }}>
      {openFlows.map((fid) => (
        <div key={fid}
          className={`flex items-center gap-2 px-2 py-0.5 rounded ${activeFlowId===fid? 'bg-slate-200' : 'bg-white'} border border-slate-300 text-[11px] cursor-pointer`}
          onClick={() => setActiveFlow(fid)}
          title={fid}
        >
          <GitBranch className="w-3.5 h-3.5 text-slate-600" />
          <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{flows[fid]?.title || fid}</span>
          {fid !== 'main' && (
            <button
              onClick={(e) => { e.stopPropagation(); closeFlow(fid); }}
              className="text-slate-500 hover:text-slate-800"
              title="Close"
              style={{ fontSize: 12 }}
            >×</button>
          )}
        </div>
      ))}
    </div>
  );
};


