import { IntellisenseItem } from "../types/intellisense";
import { asArray, collectProblemRows, dedupeByKey, extractIntentsFromProblemRow, sortItems } from "../utils/intellisenseUtils";
import { instanceRepository } from './InstanceRepository';

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
        console.log('🔥🔥🔥 [IntellisenseService] buildIntentItemsFromSourceNode called:', sourceNode?.id);

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
            console.log('[IntellisenseService] No problem row found in source node');
            return [];
        }

        // L'ID della row È l'instanceId
        const instanceId = problemRow?.id;

        // Cerca l'istanza nel InstanceRepository
        const instance = instanceRepository.getInstance(instanceId);

        if (!instance) {
            // L'istanza non esiste ancora - restituiamo i test intents per far aprire l'Intellisense
            return [
                {
                    id: 'test-confirm-intent',
                    label: 'Test Confirm',
                    name: 'Test Confirm',
                    value: 'test-confirm-intent',
                    category: "Test Intents",
                    categoryType: "intents" as const,
                    kind: "intent" as const,
                },
                {
                    id: 'test-reject-intent',
                    label: 'Test Reject',
                    name: 'Test Reject',
                    value: 'test-reject-intent',
                    category: "Test Intents",
                    categoryType: "intents" as const,
                    kind: "intent" as const,
                }
            ];
        }

        // Prendi gli intent dall'istanza
        const intents = instance.problemIntents || [];

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
        console.log("🔥 [IntellisenseService] getEdgeItems called for edgeId:", edgeId);

        const projectData = this.providers.getProjectData();
        const conditions = this.buildConditionItems(projectData);
        const sourceNode = this.getSourceNodeByEdgeId(edgeId);

        console.log("🔥 [IntellisenseService] Source node found:", {
            sourceNodeId: sourceNode?.id,
            hasSourceNode: !!sourceNode
        });

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

            console.log("🔥 [IntellisenseService] Problem rows found:", {
                problemRowsCount: problemRows.length,
                problemRows: problemRows.map(r => ({ id: r.id, type: r.type }))
            });

            if (problemRows.length > 0) {
                const realIntents = this.buildIntentItemsFromSourceNode(sourceNode);
                console.log("🔥 [IntellisenseService] Real intents from source node:", {
                    realIntentsCount: realIntents.length,
                    realIntents: realIntents.map(i => ({ id: i.id, label: i.label }))
                });
                // Aggiungi intent reali oltre a quelli di test
                intents = [...intents, ...realIntents];
            }
        }

        console.log("🔥 [IntellisenseService] Final intents:", {
            totalIntents: intents.length,
            intents: intents.map(i => ({ id: i.id, label: i.label }))
        });

        console.log("🔥 [IntellisenseService] Conditions found:", {
            conditionsCount: conditions.length,
            conditions: conditions.map(c => ({ id: c.id, label: c.label }))
        });

        const merged = dedupeByKey([...conditions, ...intents]);
        const result = sortItems(merged);

        console.log("🔥 [IntellisenseService] Final result:", {
            totalItems: result.length,
            items: result.map(i => ({ id: i.id, label: i.label, kind: i.kind }))
        });

        return result;
    }
}

