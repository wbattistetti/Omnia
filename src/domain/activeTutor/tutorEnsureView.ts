/**

 * Active Tutor — evento per aprire viste wizard (KB, Interface, backend main) prima dell'attenzione.

 */



export const TUTOR_ENSURE_VIEW_EVENT = 'omnia-tutor-ensure-view';



export type TutorEnsureViewId = 'knowledgeBase' | 'interface' | 'backendMain' | 'errorHandling';



export interface TutorEnsureViewDetail {

  readonly view: TutorEnsureViewId;

}



/** Apre la vista richiesta nel Construction Wizard (handler in AIAgentEditor). */

export function dispatchTutorEnsureView(view: TutorEnsureViewId): void {

  window.dispatchEvent(

    new CustomEvent<TutorEnsureViewDetail>(TUTOR_ENSURE_VIEW_EVENT, { detail: { view } })

  );

}


