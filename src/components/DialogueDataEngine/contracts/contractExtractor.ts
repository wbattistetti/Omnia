/**
 * Contract Extractor
 * Esegue escalation usando contract NLP: Regex → Rules → NER → LLM
 */

import type { NLPContract } from './contractLoader';

export interface ExtractionResult {
    values: Record<string, any>; // subId → value (direct mapping, no canonicalKey)
    hasMatch: boolean;
    source: 'regex' | 'rules' | 'ner' | 'llm' | 'grammarflow' | null;
    confidence?: number;
}

/**
 * Esegue escalation usando contract (versione sincrona per regex)
 * 1. Prova regex patterns (sincrono) - context-aware
 * 2. Se fallisce, prova rules (extractorCode) - TODO
 * 3. Se fallisce e NER abilitato, prova NER (async)
 * 4. Se fallisce e LLM abilitato, prova LLM (async)
 *
 * @param activeSubId - ID del sub attivo (per context-aware pattern selection)
 */
export function extractWithContractSync(
    text: string,
    contract: NLPContract,
    activeSubId?: string
): ExtractionResult {
    // ESCALATION LEVEL 1: Regex (sincrono) - context-aware
    const regexResult = tryRegexExtraction(text, contract, activeSubId);
    if (regexResult.hasMatch) {
        return { ...regexResult, source: 'regex' };
    }

    // ESCALATION LEVEL 2: Rules (extractorCode)
    // TODO: Eseguire extractorCode TypeScript
    // Per ora ritorna no match

    return { values: {}, hasMatch: false, source: null };
}

/**
 * Esegue escalation async (NER/LLM)
 */
export async function extractWithContractAsync(
    text: string,
    contract: NLPContract
): Promise<ExtractionResult> {
    // ✅ NEW: Escalation based on engines array order (only enabled engines)
    if (!contract.engines || contract.engines.length === 0) {
        return { values: {}, hasMatch: false, source: null };
    }

    // ✅ Filter only enabled engines and use them in column order (escalation)
    const enabledEngines = contract.engines.filter(engine => engine.enabled !== false);

    // Try engines in order (escalation)
    for (const contractItem of enabledEngines) {
        switch (contractItem.type) {
            case 'ner':
                const nerResult = await tryNERExtraction(text, contract);
                if (nerResult.hasMatch) {
                    return { ...nerResult, source: 'ner' };
                }
                break;

            case 'llm':
                const llmResult = await tryLLMExtraction(text, contract, contractItem);
                if (llmResult.hasMatch) {
                    return { ...llmResult, source: 'llm' };
                }
                break;

            case 'grammarflow':
                const grammarFlowResult = await tryGrammarFlowExtraction(text, contract, contractItem);
                if (grammarFlowResult.hasMatch) {
                    return { ...grammarFlowResult, source: 'grammarflow' };
                }
                break;
        }
    }

    return { values: {}, hasMatch: false, source: null };
}

/**
 * Prova estrazione con regex patterns - sempre usa mainPattern per correzione implicita
 * @param activeSubId - ID del sub attivo (per risoluzione ambiguità)
 */
function tryRegexExtraction(text: string, contract: NLPContract, activeSubId?: string): ExtractionResult {
    const values: Record<string, any> = {};

    // ✅ NEW: Find regex contract from engines array (only enabled)
    const regexContract = contract.engines?.find(c => c.type === 'regex' && c.enabled !== false);
    if (!regexContract || regexContract.type !== 'regex' || !regexContract.patterns || regexContract.patterns.length === 0) {
        console.warn('⚠️ [NLP Regex] Regex contract not found or no patterns');
        return { values: {}, hasMatch: false, source: null };
    }

    // ✅ SEMPLIFICATO: usa sempre solo mainPattern (pattern[0]) per correzione implicita
    const mainPattern = regexContract.patterns[0];
    if (!mainPattern) {
        console.warn('⚠️ [NLP Regex] Main pattern non trovato nel contract');
        return { values: {}, hasMatch: false, source: null };
    }

    // ✅ DEBUG: Log regex pattern per verificare se è compilata
    const hasPlaceholder = mainPattern.includes('${MONTHS_PLACEHOLDER}') || mainPattern.includes('\\${MONTHS_PLACEHOLDER}');
    console.log('🔍 [NLP Regex] Estrazione con mainPattern', {
        mode: activeSubId ? 'collecting_sub' : 'collecting_main',
        activeSubId: activeSubId ? activeSubId.substring(0, 20) + '...' : undefined,
        activeSubLabel: activeSubId ? contract.subDataMapping[activeSubId]?.label : undefined,
        hasPlaceholder: hasPlaceholder ? '❌ YES (NOT COMPILED!)' : '✅ NO (compiled)',
        patternPreview: mainPattern.substring(0, 150),
        templateName: contract.templateName
    });

    try {
        const regex = new RegExp(mainPattern, 'i');
        const match = text.match(regex);

        if (!match || !match.groups) {
            console.log('❌ [NLP Regex] MainPattern non matchato', {
                text: text.substring(0, 100),
                pattern: mainPattern.substring(0, 80)
            });
            return { values: {}, hasMatch: false, source: null };
        }

        console.log(`✅ [NLP Regex] MainPattern MATCHATO`, {
            fullMatch: match[0],
            groupsCount: Object.keys(match.groups).length
        });

        // ✅ SIMPLIFIED: Map groupName directly to subId (no canonicalKey layer)
        // Iterate subDataMapping, use groupName to extract, key by subId
        const allMatchedGroups: Record<string, string> = {};

        Object.entries(contract.subDataMapping).forEach(([subId, info]) => {
            const groupName = (info as any).groupName as string | undefined;
            if (!groupName) return;
            const value = match!.groups![groupName];
            if (value !== undefined && value !== null && value !== '') {
                allMatchedGroups[subId] = value.trim();
                console.log(`  📝 [NLP Regex] Gruppo: ${groupName} → subId ${subId} = ${value}`);
            }
        });

        if (Object.keys(allMatchedGroups).length === 0) {
            console.log('❌ [NLP Regex] Nessun gruppo matchato');
            return { values: {}, hasMatch: false, source: null };
        }

        // ✅ Simplified: Direct mapping groupName → subId (no ambiguity logic needed)
        // If multiple groups matched, use all values (already keyed by subId)
        Object.assign(values, allMatchedGroups);
        console.log('  ℹ️ [NLP Regex] Estrazione completata', {
            matchedSubIds: Object.keys(allMatchedGroups),
            values
        });

        if (Object.keys(values).length > 0) {
            console.log('✅ [NLP Regex] Estrazione completata con successo', {
                values,
                source: 'regex'
            });
            return { values, hasMatch: true, source: 'regex' };
        }

        return { values: {}, hasMatch: false, source: null };
    } catch (error) {
        console.warn(`⚠️ [NLP Regex] MainPattern fallito (sintassi invalida)`, {
            pattern: mainPattern.substring(0, 80),
            error: error instanceof Error ? error.message : String(error)
        });
        return { values: {}, hasMatch: false, source: null };
    }
}

/**
 * Verifica se un valore matchato è ambiguo (può appartenere a più subData)
 * @param text - Testo originale dell'input
 * @param contract - Contract NLP
 * @returns true se il valore è ambiguo
 */
function checkAmbiguity(text: string, contract: NLPContract): boolean {
    // ✅ NEW: Find regex contract from engines array (only enabled)
    const regexContract = contract.engines?.find(c => c.type === 'regex' && c.enabled !== false);
    if (!regexContract || regexContract.type !== 'regex') {
        return false;
    }

    const ambiguityPattern = (regexContract as any).ambiguityPattern;

    if (!ambiguityPattern) {
        // Nessun pattern ambiguità definito → non è ambiguo
        return false;
    }

    try {
        const regex = new RegExp(ambiguityPattern, 'i');
        const match = text.match(regex);

        const isAmbiguous = match !== null;
        console.log('🔍 [NLP Regex] checkAmbiguity', {
            text: text.substring(0, 50),
            ambiguityPattern: ambiguityPattern.substring(0, 80),
            isAmbiguous
        });

        return isAmbiguous;
    } catch (error) {
        console.warn('⚠️ [NLP Regex] checkAmbiguity fallito (sintassi invalida)', {
            pattern: ambiguityPattern.substring(0, 80),
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
}

// ✅ REMOVED: resolveWithContext - no longer needed with direct subId mapping
// Ambiguity resolution is now handled at a higher level if needed.

/**
 * Prova estrazione con NER
 */
async function tryNERExtraction(_text: string, _contract: NLPContract): Promise<ExtractionResult> {
    // TODO: Implementare chiamata a backend NER
    // Per ora ritorna no match
    return { values: {}, hasMatch: false, source: null };
}

/**
 * Prova estrazione con LLM
 */
async function tryLLMExtraction(text: string, contract: NLPContract, llmContractItem: any): Promise<ExtractionResult> {
    try {
        // ✅ NEW: Use aiPrompt from contract item
        if (llmContractItem.type !== 'llm') {
            return { values: {}, hasMatch: false, source: null };
        }

        // Costruisci prompt
        const subDataList = Object.entries(contract.subDataMapping)
            .map(([subId, m]) => `- ${subId}: ${m.label} (${m.type})`)
            .join('\n');

        const userPrompt = llmContractItem.aiPrompt
            .replace('{text}', text)
            .replace('{subData}', subDataList);

        const response = await fetch('/api/nlp/llm-extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                field: contract.templateName,
                text,
                subData: Object.values(contract.subDataMapping),
                prompt: userPrompt,
                schema: llmContractItem.responseSchema
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.candidates && data.candidates.length > 0) {
                const candidate = data.candidates[0];
                if (candidate.value && typeof candidate.value === 'object') {
                    // ✅ SIMPLIFIED: Map values directly using subId (LLM should return subId keys)
                    // If LLM returns groupName keys (s1, s2, s3), map them to subId
                    const values: Record<string, any> = {};
                    Object.entries(candidate.value).forEach(([key, value]) => {
                        // Check if key is a groupName (s1, s2, s3) and find corresponding subId
                        const subId = Object.entries(contract.subDataMapping).find(
                            ([_, info]) => (info as any).groupName === key
                        )?.[0];
                        if (subId) {
                            values[subId] = value;
                        } else if (contract.subDataMapping[key]) {
                            // Key is already a subId
                            values[key] = value;
                        }
                    });

                    if (Object.keys(values).length > 0) {
                        return {
                            values,
                            hasMatch: true,
                            source: 'llm',
                            confidence: candidate.confidence || 0.7
                        };
                    }
                }
            }
        }
    } catch (error) {
        console.warn('[ContractExtractor] LLM extraction failed', error);
    }

    return { values: {}, hasMatch: false, source: null };
}

/**
 * Prova estrazione con GrammarFlow
 */
async function tryGrammarFlowExtraction(text: string, contract: NLPContract, grammarFlowContractItem: any): Promise<ExtractionResult> {
    try {
        if (grammarFlowContractItem.type !== 'grammarflow' || !grammarFlowContractItem.grammarFlow) {
            return { values: {}, hasMatch: false, source: null };
        }

        // ✅ Call backend GrammarFlow engine
        const response = await fetch('/api/nlp/grammarflow-extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                grammar: grammarFlowContractItem.grammarFlow,
                contract: {
                    templateName: contract.templateName,
                    subDataMapping: contract.subDataMapping
                }
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.values && Object.keys(data.values).length > 0) {
                // ✅ Map values using subDataMapping (similar to LLM extraction)
                const values: Record<string, any> = {};
                Object.entries(data.values).forEach(([key, value]) => {
                    // Check if key is a groupName and find corresponding subId
                    const subId = Object.entries(contract.subDataMapping).find(
                        ([_, info]) => (info as any).groupName === key
                    )?.[0];
                    if (subId) {
                        values[subId] = value;
                    } else if (contract.subDataMapping[key]) {
                        // Key is already a subId
                        values[key] = value;
                    }
                });

                if (Object.keys(values).length > 0) {
                    return {
                        values,
                        hasMatch: true,
                        source: 'grammarflow',
                        confidence: data.confidence || 0.8
                    };
                }
            }
        }
    } catch (error) {
        console.warn('[ContractExtractor] GrammarFlow extraction failed', error);
    }    return { values: {}, hasMatch: false, source: null };
}
