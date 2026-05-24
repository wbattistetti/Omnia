/**
 * Active Tutor — re-export registry dominio + helper React DOM.
 */

export {
  UI_IDS,
  TUTOR_ID_ATTR,
  tutorDomSelector,
  wizardStepUiId,
  type TutorUiId,
} from '@domain/activeTutor/tutorUiIds';

import { UI_IDS, TUTOR_ID_ATTR, type TutorUiId } from '@domain/activeTutor/tutorUiIds';

export function isRegisteredTutorUiId(id: string): id is TutorUiId {
  return Object.values(UI_IDS).includes(id as TutorUiId);
}

/** Props helper per componenti React. */
export function tutorIdProps(id: TutorUiId): Record<string, string> {
  return { [TUTOR_ID_ATTR]: id };
}
