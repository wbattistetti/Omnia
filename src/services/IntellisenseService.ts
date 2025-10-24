import { IntellisenseItem } from "../types/intellisense";
import { asArray, collectProblemRows, dedupeByKey, extractIntentsFromProblemRow, sortItems } from "../utils/intellisenseUtils";

// Provider di dati (iniettabili → no window globals)
export type GraphProviders = {
    getProjectData: () => any;      // { conditions: [...] }
    getFlowNodes: () => any[];      // [{ id, data: { rows... } }]
    getFlowEdges: () => any[];      // [{ id, source, target }]
};

export class IntellisenseService {
    constructor(private providers: GraphProviders) { }

    private getSourceNodeByEdgeId(edgeId: string): any | null {
        const edges = this.providers.getFlowEdges() || [];
        const edge = edges.find((e: any) => e?.id === edgeId);
        if (!edge) return null;
        return this.providers.getFlowNodes().find((n: any) => n?.id === edge.source) || null;
    }

    private buildConditionItems(projectData: any): IntellisenseItem[] {
        return asArray(projectData?.conditions).flatMap((category: any) =>
            asArray(category?.items).map((item: any) => ({
                id: String(item?.id ?? item?.code ?? item?.name ?? crypto.randomUUID()),
                label: String(item?.name ?? "Unknown"),
                name: item?.name,
                value: String(item?.id ?? item?.code ?? item?.name ?? ""),
                description: String(item?.description ?? ""),
                category: String(category?.name ?? "Conditions"),
                categoryType: "conditions" as const,
                kind: "condition" as const,
            }))
        );
    }

    private buildIntentItemsFromSourceNode(sourceNode: any): IntellisenseItem[] {
        const problemRows = collectProblemRows(sourceNode);
        if (!problemRows.length) return [];
        const intents = dedupeByKey(
            problemRows.flatMap((row) =>
                extractIntentsFromProblemRow(row).map((i) => ({ ...i, categoryType: "intents" }))
            )
        );
        return intents.map((intent: any) => ({
            id: intent.id,
            label: intent.name,
            name: intent.name,
            value: intent.id,
            category: "Problem Intents",
            categoryType: "intents" as const,
            kind: "intent" as const,
        }));
    }

    /** API principale: items da mostrare quando il target è un EDGE */
    getEdgeItems(edgeId: string): IntellisenseItem[] {
        const projectData = this.providers.getProjectData();
        const conditions = this.buildConditionItems(projectData);

        const sourceNode = this.getSourceNodeByEdgeId(edgeId);
        const intents = sourceNode ? this.buildIntentItemsFromSourceNode(sourceNode) : [];

        const merged = dedupeByKey([...conditions, ...intents]);
        return sortItems(merged);
    }
}

