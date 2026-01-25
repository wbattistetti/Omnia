/**
 * Contract Loader
 * Carica dataContract dal template/nodo e fornisce accesso strutturato
 */

import type { DDTNode } from '../model/ddt.v2.types';

// Base contract types
export type ContractType = 'regex' | 'rules' | 'ner' | 'llm' | 'embeddings';

export interface RegexContract {
    type: 'regex';
    enabled: boolean;
    patterns: string[];
    patternModes?: string[];
    ambiguityPattern?: string;
    ambiguity?: {
        ambiguousValues: {
            pattern: string;
            description: string;
        };
        ambiguousCanonicalKeys: string[];
    };
    examples: string[];
    testCases: string[];
}

export interface RulesContract {
    type: 'rules';
    enabled: boolean;
    extractorCode: string;
    validators: any[];
    testCases: string[];
}

export interface NERContract {
    type: 'ner';
    enabled: boolean;
    entityTypes: string[];
    confidence: number;
}

export interface LLMContract {
    type: 'llm';
    enabled: boolean;
    systemPrompt: string;
    userPromptTemplate: string;
    responseSchema: object;
}

export interface EmbeddingsContract {
    type: 'embeddings';
    enabled: boolean;
    intents?: Array<{
        id: string;
        name: string;
        variants: {
            curated: Array<{id: string; text: string; lang: string}>;
            hardNeg: Array<{id: string; text: string; lang: string}>;
            test?: Array<{id: string; text: string; lang: string}>;
        };
        threshold?: number;
    }>;
    modelReady?: boolean;
    threshold?: number;
}

export type DataContractItem = RegexContract | RulesContract | NERContract | LLMContract | EmbeddingsContract;

export interface DataContract {
    templateName: string;
    templateId: string;
    sourceTemplateId?: string;  // GUID of the original template (for instances)
    subDataMapping: {
        [subId: string]: {
            canonicalKey: string;
            label: string;
            type: string;
            patternIndex?: number;  // Context-aware: quale pattern usare per questo sub
        };
    };
    // Array di contract - ordine implicito (ordine array = ordine escalation)
    contracts: DataContractItem[];
}

// Alias per retrocompatibilità durante la migrazione
export type NLPContract = DataContract;

/**
 * Carica dataContract da un nodo
 * Il contract può essere:
 * 1. Direttamente sul nodo: node.dataContract (override dell'istanza)
 * 2. Nel template originale (se il nodo ha templateId e non c'è override)
 */
export function loadContract(node: DDTNode): DataContract | null {
    // ✅ PRIORITY 1: Controlla override dell'istanza
    const nodeContract = (node as any).dataContract;
    if (nodeContract) {
        return nodeContract as DataContract;
    }

    // ✅ PRIORITY 2: Carica dal template usando templateId
    const templateId = (node as any).templateId;
    if (templateId) {
        try {
            // Dynamic import per evitare circular dependency
            const DialogueTaskService = require('../../services/DialogueTaskService').default;
            const template = DialogueTaskService.getTemplate(templateId);

            if (template && template.dataContract) {
                return template.dataContract as DataContract;
            }

            // ✅ Dopo migrazione, tutti i template hanno dataContract
            // Se non c'è, significa che il template non ha contratti
        } catch (error) {
            console.warn('[Contract] Error loading from template:', error);
        }
    }

    return null;
}


/**
 * Ottiene il mapping canonicalKey → subId per un contract
 */
export function getCanonicalKeyToSubId(contract: DataContract): Record<string, string> {
    const mapping: Record<string, string> = {};

    Object.entries(contract.subDataMapping).forEach(([subId, data]) => {
        mapping[data.canonicalKey] = subId;
    });

    return mapping;
}

/**
 * Ottiene il subId per un canonicalKey
 */
export function getSubIdForCanonicalKey(contract: DataContract, canonicalKey: string): string | undefined {
    const entry = Object.entries(contract.subDataMapping).find(
        ([_, data]) => data.canonicalKey === canonicalKey
    );
    return entry ? entry[0] : undefined;
}

