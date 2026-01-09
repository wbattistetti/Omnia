// ❌ RIMOSSO: AgentActType - usa TaskType enum da src/types/taskTypes.ts
// ❌ RIMOSSO: modeToType/typeToMode - usa taskTypeToModeString/modeStringToTaskType da src/types/taskTypes.ts

import { TaskType } from '../types/taskTypes';

/**
 * Normalizes project data - NO backward compatibility, expects taskTemplates and userTasks
 * Ensures type consistency using TaskType enum.
 */
export function normalizeProjectData(pd: any) {
  const out = typeof structuredClone === 'function' ? structuredClone(pd) : JSON.parse(JSON.stringify(pd || {}));

  // ✅ Normalize taskTemplates - type must be TaskType enum
  (out.taskTemplates || []).forEach((cat: any) => {
    (cat.items || []).forEach((item: any) => {
      // Ensure type is TaskType enum (required)
      if (item?.type === undefined || item?.type === null) {
        item.type = TaskType.UNDEFINED;
      }
      // Remove mode if present (not needed, use type only)
      if (item?.mode !== undefined) {
        delete item.mode;
      }
    });
  });

  return out;
}


