/**
 * VB.NET Adapter: Converts between TypeScript TaskInstance and VB.NET Task
 *
 * TypeScript uses templateId (string), VB.NET uses Action (integer enum)
 * This adapter provides bidirectional conversion during migration.
 */

/**
 * ✅ ADAPTER VB.NET: Converte templateId (string) → Action (integer)
 * Usato quando si invia TaskInstance a VB.NET compiler
 *
 * Mapping:
 * - SayMessage → 1 (TaskTypes.SayMessage)
 * - CloseSession → 2 (TaskTypes.CloseSession)
 * - Transfer → 3 (TaskTypes.Transfer)
 * - GetData → 4 (TaskTypes.GetData)
 * - callBackend/BackendCall → 5 (TaskTypes.BackendCall)
 * - ClassifyProblem → 6 (TaskTypes.ClassifyProblem)
 *
 * @param templateId - Template ID (string)
 * @returns Action enum value (integer)
 */
export function templateIdToVBAction(templateId: string): number {
  if (!templateId || templateId.trim() === '') {
    console.warn('[VB.NET Adapter] Empty templateId, defaulting to SayMessage (1)');
    return 1; // Default: SayMessage
  }

  const mapping: Record<string, number> = {
    'SayMessage': 1,        // TaskTypes.SayMessage
    'CloseSession': 2,      // TaskTypes.CloseSession
    'Transfer': 3,          // TaskTypes.Transfer
    'GetData': 4,           // TaskTypes.GetData
    'callBackend': 5,       // TaskTypes.BackendCall
    'BackendCall': 5,       // Alias
    'ClassifyProblem': 6,    // TaskTypes.ClassifyProblem
  };

  const normalized = templateId.trim();
  const action = mapping[normalized];

  if (action === undefined) {
    console.warn(`[VB.NET Adapter] Unknown templateId: "${templateId}", defaulting to SayMessage (1)`);
    return 1; // Default: SayMessage
  }

  return action;
}

/**
 * ✅ ADAPTER VB.NET: Converte Action (integer) → templateId (string)
 * Usato quando si riceve TaskInstance da VB.NET compiler
 *
 * @param action - Action enum value (integer)
 * @returns Template ID (string)
 */
export function vbActionToTemplateId(action: number): string {
  const mapping: Record<number, string> = {
    1: 'SayMessage',
    2: 'CloseSession',
    3: 'Transfer',
    4: 'GetData',
    5: 'callBackend',
    6: 'ClassifyProblem',
  };

  const templateId = mapping[action];
  if (!templateId) {
    console.warn(`[VB.NET Adapter] Unknown action: ${action}, defaulting to SayMessage`);
    return 'SayMessage';
  }

  return templateId;
}

/**
 * ✅ PREPARA TaskInstance per VB.NET: Aggiunge action (integer) per compatibilità
 *
 * VB.NET si aspetta un campo "action" (integer), quindi aggiungiamo questo campo
 * mantenendo templateId per il frontend.
 *
 * @param task - TaskInstance
 * @returns Task with both templateId (string) and action (integer)
 */
export function prepareTaskForVBNet(task: { id: string; templateId: string; value?: Record<string, any> }): {
  id: string;
  templateId: string;
  action: number;  // ✅ Aggiunto per VB.NET
  value?: Record<string, any>;
} {
  const templateId = task.templateId;
  return {
    id: task.id,
    templateId,
    action: templateIdToVBAction(templateId),  // ✅ Aggiunge action per VB.NET
    value: task.value
  };
}

