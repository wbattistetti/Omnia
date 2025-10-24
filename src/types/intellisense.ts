export type IntellisenseItem = {
    id: string;
    label: string;
    name?: string;
    value: string;
    description?: string;
    category: string;
    categoryType: "conditions" | "intents";
    kind: "condition" | "intent";
};

export type IntellisenseTarget = {
    nodeId?: string;
    edgeId?: string;
    mouseX?: number;
    mouseY?: number;
} | null;

export type IntellisenseState = {
    isOpen: boolean;
    target: IntellisenseTarget;
    query: string;
    catalog: IntellisenseItem[];   // lista completa (conditions + intents)
    highlighted: number;
    debug: boolean;
};

export type IntellisenseAction =
    | { type: "OPEN_WITH_ITEMS"; target: IntellisenseTarget; items: IntellisenseItem[] }
    | { type: "CLOSE" }
    | { type: "SET_QUERY"; query: string }
    | { type: "MOVE_HIGHLIGHT"; delta: number }
    | { type: "SET_DEBUG"; debug: boolean };

