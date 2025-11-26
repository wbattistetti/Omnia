import { IntellisenseItem } from "../types/intellisense";
import { asArray, collectProblemRows, dedupeByKey, extractIntentsFromProblemRow, sortItems } from "../utils/intellisenseUtils";
import { taskRepository } from './TaskRepository';

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
        // Cerca direttamente nelle righe del nodo senza dipendere da utils complesse
        const rows = [
            ...(sourceNode?.data?.rows || []),
            ...(sourceNode?.data?.tableRows || []),
            ...(sourceNode?.rows || []),
        ];

        const isProblem = (r: any) => {
            const t = String(r?.type || r?.kind || "").toLowerCase();
            return t === "problemclassification" || t === "problem-classification";
        };

        const problemRow = rows.find(isProblem);
        if (!problemRow) {
            return [];
        }

        // FASE 7A: L'ID della row è il taskId
        const taskId = problemRow?.id;

        // FASE 7A: Cerca il Task nel TaskRepository
        const task = taskRepository.getTask(taskId);

        if (!task) {
            // Il Task non esiste ancora - restituiamo array vuoto
            return [];
        }

        // FASE 7A: Prendi gli intent dal Task
        const intents = task.value?.intents || [];

        // Converti gli intent in IntellisenseItem
        return intents.map((intent: any) => ({
            id: intent.id || intent.name,
            label: intent.name || intent.label,
            name: intent.name || intent.label,
            value: intent.id || intent.name,
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

        // ✅ INTENT FISSI DI TEST - SEMPRE presenti per isolare il problema
        const TEST_INTENTS: IntellisenseItem[] = [
            {
                id: 'test-confirm-intent',
                label: 'Conferma',
                name: 'Conferma',
                value: 'test-confirm-intent',
                category: 'Test Intents',
                categoryType: 'intents' as const,
                kind: 'intent' as const
            },
            {
                id: 'test-reject-intent',
                label: 'Rifiuta',
                name: 'Rifiuta',
                value: 'test-reject-intent',
                category: 'Test Intents',
                categoryType: 'intents' as const,
                kind: 'intent' as const
            },
            {
                id: 'test-milano',
                label: 'Milano',
                name: 'Milano',
                value: 'test-milano',
                category: 'Città Italiane',
                categoryType: 'intents' as const,
                kind: 'intent' as const
            },
            {
                id: 'test-misano',
                label: 'Misano',
                name: 'Misano',
                value: 'test-misano',
                category: 'Città Italiane',
                categoryType: 'intents' as const,
                kind: 'intent' as const
            },
            {
                id: 'test-roma',
                label: 'Roma',
                name: 'Roma',
                value: 'test-roma',
                category: 'Città Italiane',
                categoryType: 'intents' as const,
                kind: 'intent' as const
            },
            {
                id: 'test-rovigo',
                label: 'Rovigo',
                name: 'Rovigo',
                value: 'test-rovigo',
                category: 'Città Italiane',
                categoryType: 'intents' as const,
                kind: 'intent' as const
            },
            {
                id: 'test-torino',
                label: 'Torino',
                name: 'Torino',
                value: 'test-torino',
                category: 'Città Italiane',
                categoryType: 'intents' as const,
                kind: 'intent' as const
            }
        ];

        let intents: IntellisenseItem[] = [...TEST_INTENTS]; // Start with test intents

        if (sourceNode) {
            const problemRows = collectProblemRows(sourceNode);

            if (problemRows.length > 0) {
                const realIntents = this.buildIntentItemsFromSourceNode(sourceNode);
                // Aggiungi intent reali oltre a quelli di test
                intents = [...intents, ...realIntents];
            }
        }

        const merged = dedupeByKey([...conditions, ...intents]);
        const result = sortItems(merged);

        return result;
    }
}

