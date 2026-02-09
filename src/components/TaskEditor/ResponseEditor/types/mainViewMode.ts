/**
 * Enum che definisce le viste centrali disponibili nel MainContentArea.
 * Mutualmente esclusivo: solo una vista alla volta.
 */
export enum MainViewMode {
  /** Vista default: StepsStrip + StepEditor (Behaviour tab) */
  BEHAVIOUR = 'behaviour',

  /** Vista Personality: MessageReviewView */
  MESSAGE_REVIEW = 'messageReview',

  /** Vista Recognition: DataExtractionEditor */
  DATA_CONTRACTS = 'dataContracts',

  /** Vista Wizard: CenterPanel con PhaseCard */
  WIZARD = 'wizard',
}

export type MainViewModeType = MainViewMode | `${MainViewMode}`;
