/**
 * Contract Extractor
 * Esegue escalation usando contract NLP: Regex → Rules → NER → LLM
 */

import type { NLPContract } from './contractLoader';
import { getSubIdForCanonicalKey } from './contractLoader';

export interface ExtractionResult {
    values: Record<string, any>; // canonicalKey → value
    hasMatch: boolean;
    source: 'regex' | 'rules' | 'ner' | 'llm' | null;
    confidence?: number;
}

/**
 * Esegue escalation usando contract (versione sincrona per regex)
 * 1. Prova regex patterns (sincrono)
 * 2. Se fallisce, prova rules (extractorCode) - TODO
 * 3. Se fallisce e NER abilitato, prova NER (async)
 * 4. Se fallisce e LLM abilitato, prova LLM (async)
 */
export function extractWithContractSync(
    text: string,
    contract: NLPContract
): ExtractionResult {
    // ESCALATION LEVEL 1: Regex (sincrono)
    const regexResult = tryRegexExtraction(text, contract);
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
    // ESCALATION LEVEL 3: NER
    if (contract.ner?.enabled) {
        const nerResult = await tryNERExtraction(text, contract);
        if (nerResult.hasMatch) {
            return { ...nerResult, source: 'ner' };
        }
    }

    // ESCALATION LEVEL 4: LLM
    if (contract.llm.enabled) {
        const llmResult = await tryLLMExtraction(text, contract);
        if (llmResult.hasMatch) {
            return { ...llmResult, source: 'llm' };
        }
    }

    return { values: {}, hasMatch: false, source: null };
}

/**
 * Prova estrazione con regex patterns
 */
function tryRegexExtraction(text: string, contract: NLPContract): ExtractionResult {
    const values: Record<string, any> = {};

    const mappingDetails = Object.entries(contract.subDataMapping).map(([guid, mapping]) => ({
        guid: guid.substring(0, 20) + '...',
        canonicalKey: mapping.canonicalKey,
        label: mapping.label
    }));

    console.log('🔍 [NLP Regex] Inizio estrazione', {
        text: text.substring(0, 100),
        patternsCount: contract.regex.patterns.length,
        templateName: contract.templateName,
        subDataMappingCount: Object.keys(contract.subDataMapping).length
    });
    console.log('🔍 [NLP Regex] SubDataMapping details:', JSON.stringify(mappingDetails, null, 2));

    // ✅ DEBUG: Log regex patterns per verificare se sono compilate
    contract.regex.patterns.forEach((pattern, idx) => {
        const hasPlaceholder = pattern.includes('${MONTHS_PLACEHOLDER}');
        console.log(`🔍 [NLP Regex] Pattern ${idx + 1}:`, {
            hasPlaceholder: hasPlaceholder ? '❌ YES (NOT COMPILED!)' : '✅ NO (compiled)',
            patternPreview: pattern.substring(0, 150),
            patternLength: pattern.length
        });
    });

    for (let i = 0; i < contract.regex.patterns.length; i++) {
        const pattern = contract.regex.patterns[i];
        try {
            const regex = new RegExp(pattern, 'i');
            const match = text.match(regex);

            if (match) {
                console.log(`✅ [NLP Regex] Pattern ${i + 1} MATCHATO`, {
                    pattern: pattern.substring(0, 80),
                    fullMatch: match[0],
                    groups: match.groups ? Object.keys(match.groups).length : 0
                });

                if (match.groups) {
                    // Estrai valori dai gruppi nominati
                    Object.entries(match.groups).forEach(([groupKey, value]) => {
                        if (value !== undefined && value !== null && value !== '') {
                            // ✅ Validazione range per campi numerici
                            const numValue = parseInt(value, 10);
                            if (!isNaN(numValue)) {
                                if (groupKey === 'month' && (numValue < 1 || numValue > 12)) {
                                    console.warn(`  ⚠️ [NLP Regex] ${groupKey} fuori range, scartato: ${numValue} (range: 1-12)`);
                                    return; // Skip this group
                                }
                                if (groupKey === 'day' && (numValue < 1 || numValue > 31)) {
                                    console.warn(`  ⚠️ [NLP Regex] ${groupKey} fuori range, scartato: ${numValue} (range: 1-31)`);
                                    return; // Skip this group
                                }
                                if (groupKey === 'year' && numValue < 1900) {
                                    console.warn(`  ⚠️ [NLP Regex] ${groupKey} fuori range, scartato: ${numValue} (range: >= 1900)`);
                                    return; // Skip this group
                                }
                            }

                            const subId = getSubIdForCanonicalKey(contract, groupKey);
                            if (subId) {
                                values[groupKey] = value;
                                console.log(`  📝 [NLP Regex] Estratto: ${groupKey} = ${value} → subId: ${subId}`);
                            } else {
                                console.warn(`  ⚠️ [NLP Regex] canonicalKey "${groupKey}" NON trovata`, {
                                    groupKey,
                                    subDataMapping: Object.entries(contract.subDataMapping).map(([guid, mapping]) => ({
                                        guid: guid.substring(0, 20) + '...',
                                        canonicalKey: mapping.canonicalKey,
                                        label: mapping.label
                                    }))
                                });
                            }
                        }
                    });

                    if (Object.keys(values).length > 0) {
                        console.log('✅ [NLP Regex] Estrazione completata con successo', {
                            values,
                            source: 'regex'
                        });
                        return { values, hasMatch: true, source: 'regex' };
                    }
                }
            } else {
                console.log(`❌ [NLP Regex] Pattern ${i + 1} non matchato`, {
                    pattern: pattern.substring(0, 80)
                });
            }
        } catch (error) {
            console.warn(`⚠️ [NLP Regex] Pattern ${i + 1} fallito (sintassi invalida)`, {
                pattern: pattern.substring(0, 80),
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    console.log('❌ [NLP Regex] Nessun pattern ha matchato', {
        text: text.substring(0, 100),
        patternsTried: contract.regex.patterns.length
    });

    return { values: {}, hasMatch: false, source: null };
}

/**
 * Prova estrazione con NER
 */
async function tryNERExtraction(text: string, contract: NLPContract): Promise<ExtractionResult> {
    // TODO: Implementare chiamata a backend NER
    // Per ora ritorna no match
    return { values: {}, hasMatch: false, source: null };
}

/**
 * Prova estrazione con LLM
 */
async function tryLLMExtraction(text: string, contract: NLPContract): Promise<ExtractionResult> {
    try {
        // Costruisci prompt
        const subDataList = Object.values(contract.subDataMapping)
            .map(m => `- ${m.canonicalKey}: ${m.label} (${m.type})`)
            .join('\n');

        const canonicalKeys = Object.values(contract.subDataMapping)
            .map(m => m.canonicalKey)
            .join(', ');

        const userPrompt = contract.llm.userPromptTemplate
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
                schema: contract.llm.responseSchema
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.candidates && data.candidates.length > 0) {
                const candidate = data.candidates[0];
                if (candidate.value && typeof candidate.value === 'object') {
                    // Mappa i valori usando canonicalKey
                    const values: Record<string, any> = {};
                    Object.keys(candidate.value).forEach(key => {
                        if (getSubIdForCanonicalKey(contract, key)) {
                            values[key] = candidate.value[key];
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

