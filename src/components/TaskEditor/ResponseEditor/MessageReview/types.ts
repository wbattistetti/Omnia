export type ReviewItem = {
    id: string;
    stepKey: string;
    escIndex: number | null;
    taskIndex: number | null;
    textKey?: string;
    text: string;
    pathLabel: string;
    taskId?: string; // For centralized icon/label system
    color?: string; // Task color (not step color)
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

