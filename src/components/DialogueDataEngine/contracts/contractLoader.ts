/**
 * Contract Loader
 * Carica nlpContract dal template/nodo e fornisce accesso strutturato
 */

import type { DDTNode } from '../model/ddt.v2.types';

export interface NLPContract {
    templateName: string;
    templateId: string;
    sourceTemplateId?: string;  // ✅ GUID of the original template (for instances)
    subDataMapping: {
        [subId: string]: {
            canonicalKey: string;
            label: string;
            type: string;
        };
    };
    regex: {
        patterns: string[];
        examples: string[];
        testCases: string[];
    };
    rules: {
        extractorCode: string;
        validators: any[];
        testCases: string[];
    };
    ner?: {
        entityTypes: string[];
        confidence: number;
        enabled: boolean;
    };
    llm: {
        systemPrompt: string;
        userPromptTemplate: string;
        responseSchema: object;
        enabled: boolean;
    };
}

/**
 * Carica nlpContract da un nodo
 * Il contract può essere:
 * 1. Direttamente sul nodo: node.nlpContract
 * 2. Nel template originale (se il nodo ha un riferimento)
 */
export function loadContract(node: DDTNode): NLPContract | null {
    const contract = (node as any).nlpContract;

    if (contract) {
        // Log dettagliato: mostra il mapping effettivo
        const mappingDetails = Object.entries(contract.subDataMapping || {}).map(([guid, mapping]: [string, any]) => ({
            guid: guid.substring(0, 20) + '...',
            canonicalKey: mapping.canonicalKey,
            label: mapping.label
        }));

        // ✅ DEBUG: Verifica se la regex è compilata (non contiene placeholder)
        const regexPatterns = contract.regex?.patterns || [];
        const hasPlaceholder = regexPatterns.some(p => p.includes('${MONTHS_PLACEHOLDER}'));

        console.log('✅ [Contract] Loaded', {
            nodeId: node.id,
            nodeLabel: node.label,
            templateName: contract.templateName,
            templateId: contract.templateId,
            sourceTemplateId: contract.sourceTemplateId,
            subMappingsCount: Object.keys(contract.subDataMapping || {}).length,
            regexCompiled: !hasPlaceholder ? '✅ YES' : '❌ NO (contains placeholder!)',
            regexPatternsCount: regexPatterns.length,
            firstPatternPreview: regexPatterns[0]?.substring(0, 100)
        });
        console.log('✅ [Contract] SubDataMapping:', JSON.stringify(mappingDetails, null, 2));

        if (hasPlaceholder) {
            console.error('🚨 [Contract] CRITICAL: Regex contains placeholder! Contract was NOT compiled!', {
                nodeId: node.id,
                templateName: contract.templateName,
                patterns: regexPatterns.map((p, i) => ({
                    index: i,
                    hasPlaceholder: p.includes('${MONTHS_PLACEHOLDER}'),
                    preview: p.substring(0, 100)
                }))
            });
        }

        return contract as NLPContract;
    }

    // Log come warning solo se dovrebbe esserci un contract
    console.warn('❌ [Contract] NOT FOUND', {
        nodeId: node.id,
        nodeLabel: node.label,
        nodeKind: (node as any).kind
    });
    return null;
}

/**
 * Ottiene il mapping canonicalKey → subId per un contract
 */
export function getCanonicalKeyToSubId(contract: NLPContract): Record<string, string> {
    const mapping: Record<string, string> = {};

    Object.entries(contract.subDataMapping).forEach(([subId, data]) => {
        mapping[data.canonicalKey] = subId;
    });

    return mapping;
}

/**
 * Ottiene il subId per un canonicalKey
 */
export function getSubIdForCanonicalKey(contract: NLPContract, canonicalKey: string): string | undefined {
    const entry = Object.entries(contract.subDataMapping).find(
        ([_, data]) => data.canonicalKey === canonicalKey
    );
    return entry ? entry[0] : undefined;
}

