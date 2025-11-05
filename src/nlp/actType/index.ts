export * from './types';
export { getRuleSet, initializeRegistry } from './registry';
export { classify as inferActType } from './classify';

import { HeuristicType, InternalType } from './types';

export function heuristicToInternal(t: HeuristicType): InternalType {
  switch (t) {
    case 'MESSAGE': return 'Message';
    case 'REQUEST_DATA': return 'DataRequest';
    case 'PROBLEM_SPEC': return 'ProblemClassification';
    case 'SUMMARY': return 'Summarizer';
    case 'BACKEND_CALL': return 'BackendCall';
    case 'NEGOTIATION': return 'Negotiation';
  }
}


