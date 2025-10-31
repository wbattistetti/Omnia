export type ReviewItem = {
    id: string;
    stepKey: string;
    escIndex: number | null;
    actionIndex: number | null;
    textKey?: string;
    text: string;
    pathLabel: string;
    actionId?: string; // For centralized icon/label system
    color?: string; // Action color (not step color)
};

export type RecoveryGroup = {
    escIndex: number | null;
    items: ReviewItem[];
};

export type StepGroup = {
    stepKey: string;
    recoveries: RecoveryGroup[];
};

export type AccordionState = Record<string, boolean>;

