/**

 * Active Tutor — schema ufficiale messaggi strutturati (script + LLM).

 */



import type { TutorUiId } from './tutorUiIds';
import { tutorStructuredFromScriptMessage, type TutorScriptMessageInput } from './tutorStructuredFromScript';



export type TutorAttentionType = 'glow' | 'blink' | 'pulse';



export type TutorEnsureView =

  | null

  | 'knowledgeBase'

  | 'interface'

  | 'backendMain'

  | 'errorHandling';



export interface TutorStructuredAction {
  readonly icon: string;
  readonly label: string;
  /** navigate = scroll/focus/attenzione su elementId; continue = chiudi prompt continue. */
  readonly kind?: 'navigate' | 'continue' | 'dismiss';
  readonly elementId?: string;
  readonly type?: TutorAttentionType;
}



export interface TutorStructuredUiRef {

  readonly elementId: string;

  readonly label: string;

  readonly type: TutorAttentionType;

}



export interface TutorStructuredMessage {

  readonly title: string;

  readonly body: string;

  readonly actions: readonly TutorStructuredAction[];

  readonly uiRefs: readonly TutorStructuredUiRef[];

  readonly ensureView: TutorEnsureView;

}



export const EMPTY_TUTOR_STRUCTURED_MESSAGE: TutorStructuredMessage = {

  title: '',

  body: '',

  actions: [],

  uiRefs: [],

  ensureView: null,

};



/** Formato legacy script → messaggio strutturato (preferire tutorStructuredFromScriptMessage). */
export function tutorStructuredFromLegacyScript(input: {
  text: string;
  attentionTargetId?: string;
  attentionType?: TutorAttentionType;
  attentionLabel?: string;
  title?: string;
  ensureView?: TutorEnsureView;
  uiActions?: TutorScriptMessageInput['uiActions'];
}): TutorStructuredMessage {
  const msg = tutorStructuredFromScriptMessage(
    {
      text: input.text,
      attentionTargetId: input.attentionTargetId,
      attentionType: input.attentionType,
      uiActions: input.uiActions,
    },
    input.title?.trim() || (input.text.trim().split('\n')[0]?.slice(0, 80) ?? 'Tutor')
  );
  return input.ensureView != null ? { ...msg, ensureView: input.ensureView } : msg;
}



/** Testo piano per ricerca duplicati / fallback. */

export function tutorStructuredPlainText(msg: TutorStructuredMessage): string {

  const parts = [msg.title, msg.body].filter((s) => s.trim().length > 0);

  return parts.join('\n\n');

}



const VALID_ATTENTION: ReadonlySet<string> = new Set(['glow', 'blink', 'pulse']);

const VALID_ENSURE: ReadonlySet<string> = new Set([

  'knowledgeBase',

  'interface',

  'backendMain',

  'errorHandling',

]);



/** Valida e normalizza risposta LLM; ritorna null se invalida o fuori manuale. */

export function parseTutorStructuredResponse(

  raw: unknown,

  allowedUiIds: ReadonlySet<string>

): TutorStructuredMessage | null {

  if (!raw || typeof raw !== 'object') return null;

  const o = raw as Record<string, unknown>;

  const title = typeof o.title === 'string' ? o.title.trim() : '';

  const body = typeof o.body === 'string' ? o.body.trim() : '';

  if (!title && !body) return null;



  const actions: TutorStructuredAction[] = [];

  if (Array.isArray(o.actions)) {

    for (const item of o.actions) {

      if (!item || typeof item !== 'object') continue;

      const a = item as Record<string, unknown>;

      const icon = typeof a.icon === 'string' ? a.icon.trim() : '';
      const label = typeof a.label === 'string' ? a.label.trim() : '';
      const kindRaw = typeof a.kind === 'string' ? a.kind : undefined;
      const kind =
        kindRaw === 'continue' || kindRaw === 'dismiss' || kindRaw === 'navigate'
          ? kindRaw
          : undefined;
      const elementId = typeof a.elementId === 'string' ? a.elementId.trim() : undefined;
      const typeRaw = typeof a.type === 'string' ? a.type : undefined;
      const type =
        typeRaw && VALID_ATTENTION.has(typeRaw) ? (typeRaw as TutorAttentionType) : undefined;
      if (icon && label) {
        actions.push({ icon, label, kind, elementId, type });
      }

    }

  }



  const uiRefs: TutorStructuredUiRef[] = [];

  if (Array.isArray(o.uiRefs)) {

    for (const item of o.uiRefs) {

      if (!item || typeof item !== 'object') continue;

      const u = item as Record<string, unknown>;

      const elementId = typeof u.elementId === 'string' ? u.elementId.trim() : '';

      const label = typeof u.label === 'string' ? u.label.trim() : elementId;

      const typeRaw = typeof u.type === 'string' ? u.type : 'glow';

      const type = VALID_ATTENTION.has(typeRaw) ? (typeRaw as TutorAttentionType) : 'glow';

      if (elementId && allowedUiIds.has(elementId)) {

        uiRefs.push({ elementId, label, type });

      }

    }

  }



  let ensureView: TutorEnsureView = null;

  if (o.ensureView === null || o.ensureView === undefined) {

    ensureView = null;

  } else if (typeof o.ensureView === 'string' && VALID_ENSURE.has(o.ensureView)) {

    ensureView = o.ensureView as Exclude<TutorEnsureView, null>;

  }



  return { title: title || 'Tutor', body, actions, uiRefs, ensureView };

}



/** Whitelist UI_IDS per validazione risposte. */

export function tutorUiIdWhitelist(ids: Record<string, TutorUiId>): ReadonlySet<string> {

  return new Set(Object.values(ids));

}


