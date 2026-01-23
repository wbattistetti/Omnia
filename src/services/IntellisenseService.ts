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

    /**
     * ✅ NUOVO: Cerca valori predefiniti (values[]) invece di intents
     * Cerca in tutti i task DataRequest del nodo sorgente
     */
    private buildValuesItemsFromSourceNode(sourceNode: any): IntellisenseItem[] {
        // Cerca direttamente nelle righe del nodo
        const rows = [
            ...(sourceNode?.data?.rows || []),
            ...(sourceNode?.data?.tableRows || []),
            ...(sourceNode?.rows || []),
        ];

        const items: IntellisenseItem[] = [];

        // ✅ Cerca in tutte le rows (non solo ProblemClassification)
        for (const row of rows) {
            const taskId = row?.id;
            if (!taskId) continue;

            const task = taskRepository.getTask(taskId);
            if (!task) continue;

            // ✅ Cerca values[] in data (non più task.intents)
            const values = this.getValuesFromTask(task);
            if (values.length === 0) continue;

            // ✅ Costruisci items per ogni valore
            const dataLabel = task.label || 'dato';
            const varName = dataLabel.replace(/\s+/g, '_').toLowerCase();

            for (const value of values) {
                const valueLabel = value.label || value.value || value.id;
                const conditionName = `${varName} === '${valueLabel}'`; // ✅ Condizione completa

                items.push({
                    id: `value-${taskId}-${valueLabel}`,
                    label: valueLabel,
                    name: conditionName, // ✅ Nome completo della condizione
                    value: valueLabel,
                    category: `Valori: ${dataLabel}`,
                    categoryType: 'values' as const,
                    kind: 'value' as const, // ✅ Non più 'intent'
                    payload: {
                        taskId,
                        dataLabel,
                        varName,
                        valueLabel,
                        conditionName
                    }
                });
            }
        }

        return items;
    }

    /**
     * ✅ NUOVO: Estrae values[] da un task
     * Cerca nel primo data con values[] definiti
     */
    private getValuesFromTask(task: any): any[] {
        if (!task?.data || !Array.isArray(task.data)) return [];

        // Cerca il primo data con values[]
        for (const main of task.data) {
            if (main.values && Array.isArray(main.values) && main.values.length > 0) {
                return main.values;
            }
        }

        return [];
    }

    /**
     * @deprecated Usa buildValuesItemsFromSourceNode invece
     * Mantenuto per backward compatibility temporanea
     */
    private buildIntentItemsFromSourceNode(sourceNode: any): IntellisenseItem[] {
        // ✅ Legacy: mantiene compatibilità con vecchio sistema
        return this.buildValuesItemsFromSourceNode(sourceNode);
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

        let values: IntellisenseItem[] = [...TEST_INTENTS]; // Start with test intents (mantenuti per compatibilità)

        // ✅ NUOVO: Cerca values da sourceNode (non più solo ProblemClassification)
        if (sourceNode) {
            const realValues = this.buildValuesItemsFromSourceNode(sourceNode);
            // Aggiungi valori reali oltre a quelli di test
            values = [...values, ...realValues];
        }

        const merged = dedupeByKey([...conditions, ...values]);
        const result = sortItems(merged);

        return result;
    }
}

