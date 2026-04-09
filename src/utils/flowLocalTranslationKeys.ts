/**
 * Keys for strings stored only in FlowDocument.meta.translations (not the global translations table).
 */

import { FlowWorkspaceSnapshot } from '../flows/FlowWorkspaceSnapshot';

/** All labelKey entries from every open flow slice's meta.translations. */
export function collectFlowLocalTranslationKeysFromWorkspace(): Set<string> {
  const keys = new Set<string>();
  for (const fid of FlowWorkspaceSnapshot.getAllFlowIds()) {
    const flow = FlowWorkspaceSnapshot.getFlowById(fid);
    const tr = flow?.meta?.translations;
    if (!tr || typeof tr !== 'object') continue;
    for (const k of Object.keys(tr)) {
      if (k) keys.add(k);
    }
  }
  return keys;
}
