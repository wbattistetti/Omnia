export type ReviewItem = {
    id: string;
    stepKey: string;
    escIndex: number | null;
    actionIndex: number | null;
    textKey?: string;
    text: string;
    pathLabel: string;
};

export type StepGroup = {
    stepKey: string;
    items: ReviewItem[];
};

export type AccordionState = Record<string, boolean>;

