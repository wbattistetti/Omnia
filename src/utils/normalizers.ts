export type AgentActType =
  | 'Message'
  | 'DataRequest'
  | 'Confirmation'
  | 'ProblemClassification'
  | 'Summarizer'
  | 'BackendCall';

export const modeToType = (mode?: string): AgentActType => {
  switch (mode) {
    case 'DataRequest': return 'DataRequest';
    case 'DataConfirmation': return 'Confirmation';
    case 'ProblemClassification': return 'ProblemClassification';
    case 'Summarizer': return 'Summarizer';
    case 'BackendCall': return 'BackendCall';
    default: return 'Message';
  }
};

export const typeToMode = (type?: AgentActType): string => {
  switch (type) {
    case 'DataRequest': return 'DataRequest';
    case 'Confirmation': return 'DataConfirmation';
    case 'ProblemClassification': return 'ProblemClassification';
    case 'Summarizer': return 'Summarizer';
    case 'BackendCall': return 'BackendCall';
    default: return 'Message';
  }
};

export function normalizeProjectData(pd: any) {
  const out = typeof structuredClone === 'function' ? structuredClone(pd) : JSON.parse(JSON.stringify(pd || {}));
  (out.agentActs || []).forEach((cat: any) => {
    (cat.items || []).forEach((item: any) => {
      if (!item?.type && item?.mode) item.type = modeToType(item.mode);
      if (!item?.mode && item?.type) item.mode = typeToMode(item.type);
      if (!item?.type && !item?.mode) {
        item.mode = 'Message';
        item.type = 'Message';
      }
    });
  });
  return out;
}


