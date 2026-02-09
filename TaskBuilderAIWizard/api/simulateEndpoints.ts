import { WizardTaskTreeNode, WizardConstraint, WizardNLPContract, WizardStepMessages } from '../types';
import { convertApiStructureToWizardTaskTree } from '../utils/convertApiStructureToWizardTaskTree';

/**
 * Generate structure from real API endpoint
 *
 * Calls /api/nlp/generate-structure and converts response to WizardTaskTreeNode[]
 *
 * @param description Task label (e.g., "Chiedi la data di nascita")
 * @param taskId Optional task ID for template generation
 * @param locale Locale for generation (default: 'it')
 * @returns Promise<{ schema: WizardTaskTreeNode[], shouldBeGeneral: boolean }> Array of root nodes with subNodes
 */
export async function generateStructure(
  description: string,
  taskId?: string,
  locale: string = 'it'
): Promise<{ schema: WizardTaskTreeNode[]; shouldBeGeneral: boolean }> {
  try {
    console.log('[generateStructure] 🚀 Calling API /api/nlp/generate-structure', { description, taskId, locale });

    const provider = localStorage.getItem('omnia.aiProvider') || 'openai';
    const model = localStorage.getItem('omnia.aiModel') || undefined;

    const response = await fetch('/api/nlp/generate-structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskLabel: description,
        provider,
        model,
        locale,
        taskId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Structure generation failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.success || !data.structure) {
      throw new Error(data.error || 'Invalid structure generation response');
    }

    const shouldBeGeneral = data.shouldBeGeneral || false;

    console.log('[generateStructure] ✅ API response received', {
      structureLength: data.structure?.length,
      shouldBeGeneral
    });

    // Convert API structure to WizardTaskTreeNode format
    const converted = convertApiStructureToWizardTaskTree(data.structure, taskId || 'temp-task-id');

    console.log('[generateStructure] ✅ Converted to WizardTaskTreeNode', {
      convertedLength: converted.length
    });

    return { schema: converted, shouldBeGeneral };
  } catch (error) {
    console.error('[generateStructure] ❌ Error:', error);
    throw error;
  }
}

/**
 * Convert WizardTaskTreeNode to SemanticContract format
 */
function buildContractFromNode(node: WizardTaskTreeNode): any {
  return {
    entity: {
      label: node.label,
      kind: node.type || 'string',
      id: node.id
    },
    subEntities: node.subNodes?.map(subNode => ({
      label: subNode.label,
      kind: subNode.type || 'string',
      id: subNode.id
    })) || []
  };
}

/**
 * Convert API constraints response to WizardConstraint[]
 */
function convertApiConstraintsToWizardConstraints(
  apiResponse: any,
  nodeLabel: string
): WizardConstraint[] {
  const constraints: WizardConstraint[] = [];
  const constraintsObj = apiResponse.constraints || {};

  // Convert constraints object to array
  Object.entries(constraintsObj).forEach(([key, value]: [string, any]) => {
    constraints.push({
      kind: key,
      title: key,
      payoff: value.description || key,
      min: value.min,
      max: value.max,
      minLength: value.minLength,
      maxLength: value.maxLength,
      pattern: value.pattern,
      values: value.values,
      format: value.format
    });
  });

  return constraints;
}

/**
 * Convert API engines response to WizardNLPContract
 */
function convertApiEnginesToWizardContract(
  apiResponse: any,
  node: WizardTaskTreeNode
): WizardNLPContract {
  const engines = apiResponse.engines || {};

  // Build subDataMapping from subNodes
  const subDataMapping: Record<string, any> = {};
  if (node.subNodes) {
    node.subNodes.forEach(subNode => {
      subDataMapping[subNode.id] = {
        canonicalKey: subNode.id,
        label: subNode.label,
        type: subNode.type || 'string'
      };
    });
  }

  return {
    templateName: node.label,
    templateId: node.id,
    subDataMapping,
    regex: {
      patterns: engines.regex?.patterns || engines.regex?.regex ? [engines.regex.regex] : [],
      testCases: engines.regex?.testCases || []
    },
    rules: {
      extractorCode: engines.rule_based?.extractorCode || '',
      validators: engines.rule_based?.validators || [],
      testCases: engines.rule_based?.testCases || []
    },
    ner: engines.ner ? {
      entityTypes: engines.ner.entityTypes || [],
      confidence: engines.ner.confidence || 0.8,
      enabled: engines.ner.enabled !== false
    } : undefined,
    llm: {
      systemPrompt: engines.llm?.systemPrompt || '',
      userPromptTemplate: engines.llm?.userPromptTemplate || '',
      responseSchema: engines.llm?.responseSchema || {},
      enabled: engines.llm?.enabled !== false
    }
  };
}

/**
 * Convert API messages response to WizardStepMessages
 * API returns: { start, noInput, noMatch, confirmation, success }
 * WizardStepMessages expects: { ask, confirm, notConfirmed, violation, disambiguation, success }
 */
function convertApiMessagesToWizardMessages(apiResponse: any): WizardStepMessages {
  // API response structure: { success: true, messages: { start, noInput, noMatch, confirmation, success } }
  const messages = apiResponse.messages || apiResponse || {};

  return {
    ask: {
      base: Array.isArray(messages.start) ? messages.start : messages.start ? [messages.start] : []
    },
    confirm: messages.confirmation ? {
      base: Array.isArray(messages.confirmation) ? messages.confirmation : [messages.confirmation]
    } : undefined,
    notConfirmed: messages.noMatch ? {
      base: Array.isArray(messages.noMatch) ? messages.noMatch : [messages.noMatch]
    } : undefined,
    violation: messages.noInput ? {
      base: Array.isArray(messages.noInput) ? messages.noInput : [messages.noInput]
    } : undefined,
    disambiguation: undefined, // API doesn't return disambiguation, can be added later
    success: messages.success ? {
      base: Array.isArray(messages.success) ? messages.success : [messages.success]
    } : undefined
  };
}

// ✅ RIMOSSO: simulateProgressWithEasing e easeOut (erano simulazioni, non servono più)

export async function generateConstraints(
  schema: WizardTaskTreeNode[],
  onProgress?: (progress: number) => void,
  locale: string = 'it'
): Promise<WizardConstraint[]> {
  try {
    console.log('[generateConstraints] 🚀 Calling API /api/nlp/generate-constraints', { schemaLength: schema.length });

    const allConstraints: WizardConstraint[] = [];
    const provider = localStorage.getItem('omnia.aiProvider') || 'openai';
    const model = localStorage.getItem('omnia.aiModel') || undefined;

    // Generate constraints for each node
    for (let i = 0; i < schema.length; i++) {
      const node = schema[i];
      const contract = buildContractFromNode(node);

      if (onProgress) {
        const progress = ((i + 1) / schema.length) * 100;
        onProgress(progress);
      }

      const response = await fetch('/api/nlp/generate-constraints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract,
          nodeLabel: node.label,
          locale,  // ✅ NEW: Pass locale
          provider,
          model
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[generateConstraints] ❌ API error for node ${node.id}:`, response.status, errorText);
        continue;
      }

      const data = await response.json();

      if (data.success && data.constraints) {
        const nodeConstraints = convertApiConstraintsToWizardConstraints(data.constraints, node.label);
        allConstraints.push(...nodeConstraints);
      }
    }

    console.log('[generateConstraints] ✅ Generated constraints', { count: allConstraints.length });
    return allConstraints;

  } catch (error) {
    console.error('[generateConstraints] ❌ Error:', error);
    // Fallback: return empty array instead of mock
    return [];
  }
}

/**
 * Parser substeps in sequenza
 */
const PARSER_SUBSTEPS = [
  'regex',
  'NER',
  'LLM',
  'fallback',
  'escalation',
  'normalizzazione',
  'validazione semantica'
];

export async function generateParsers(
  schema: WizardTaskTreeNode[],
  onProgress?: (progress: number) => void,
  onSubstepChange?: (substep: string) => void,
  locale: string = 'it'
): Promise<WizardNLPContract> {
  try {
    console.log('[generateParsers] 🚀 Calling API /api/nlp/generate-engines', { schemaLength: schema.length });

    const provider = localStorage.getItem('omnia.aiProvider') || 'openai';
    const model = localStorage.getItem('omnia.aiModel') || undefined;

    // For now, generate engines for the first node (root)
    // TODO: Support multiple nodes if needed
    const rootNode = schema[0];
    if (!rootNode) {
      throw new Error('No root node found in schema');
    }

    const contract = buildContractFromNode(rootNode);

    // ✅ Update substeps for UI feedback (visual only)
    if (onSubstepChange) {
      for (const substep of PARSER_SUBSTEPS) {
        onSubstepChange(substep);
      }
      onSubstepChange(null);
    }

    const response = await fetch('/api/nlp/generate-engines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract,
        nodeLabel: rootNode.label,
        locale,
        provider,
        model
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Engines generation failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.success || !data.engines) {
      throw new Error(data.error || 'Invalid engines generation response');
    }

    const nlpContract = convertApiEnginesToWizardContract(data.engines, rootNode);

    // ✅ Update progress to 100% only after API responds successfully
    if (onProgress) {
      onProgress(100);
    }

    console.log('[generateParsers] ✅ Generated engines/contract', nlpContract);
    return nlpContract;

  } catch (error) {
    console.error('[generateParsers] ❌ Error:', error);
    throw error;
  }
}

/**
 * ✅ NEW: Step types in order (8 total)
 */
const STEP_TYPES = [
  'start',
  'noInput',
  'noMatch',
  'confirmation',
  'notConfirmed',
  'violation',
  'disambiguation',
  'success'
] as const;

/**
 * ✅ NEW: Step type to substep label mapping (for UI)
 */
const STEP_TYPE_TO_SUBSTEP: Record<string, string> = {
  'start': 'richiesta iniziale',
  'noInput': 'gestione no input',
  'noMatch': 'gestione no match',
  'confirmation': 'gestione conferma',
  'notConfirmed': 'gestione non confermato',
  'violation': 'gestione violazione',
  'disambiguation': 'gestione ambiguità',
  'success': 'gestione completamento'
};

/**
 * ✅ RINOMINATO: generateMessages (era fakeGenerateMessages)
 * ✅ NUOVO: Fa 8 chiamate API separate, una per ogni step type
 *
 * @param schema Array di WizardTaskTreeNode
 * @param locale Locale code (default: 'it')
 * @param onProgress Callback per progresso (0-100)
 * @param onSubstepChange Callback per cambio substep (per UI)
 * @returns Promise<WizardStepMessages> con messaggi per tutti gli step
 */
export async function generateMessages(
  schema: WizardTaskTreeNode[],
  locale: string = 'it',
  onProgress?: (progress: number) => void,
  onSubstepChange?: (substep: string | null) => void
): Promise<WizardStepMessages> {
  try {
    console.log('[generateMessages] 🚀 Starting 8 separate API calls (one per step type)', {
      schemaLength: schema.length,
      locale,
      stepTypes: STEP_TYPES
    });

    const provider = localStorage.getItem('omnia.aiProvider') || 'openai';
    const model = localStorage.getItem('omnia.aiModel') || undefined;

    // ✅ IMPORTANT: schema should contain only ONE node when called from generateMessagesForTask
    // If multiple nodes are passed, we only process the first one
    if (schema.length === 0) {
      throw new Error('generateMessages: schema must contain at least one node');
    }
    const targetNode = schema[0];
    console.log('[generateMessages] 🎯 Processing messages for single node', {
      nodeId: targetNode.id,
      nodeLabel: targetNode.label,
      schemaLength: schema.length
    });

    // ✅ Initialize result structure for this single node
    const allMessages: WizardStepMessages = {
      ask: { base: [] },
      confirm: { base: [] },
      notConfirmed: { base: [] },
      violation: { base: [] },
      disambiguation: { base: [], options: [] },
      success: { base: [] }
    };

    const totalSteps = STEP_TYPES.length;
    let completedSteps = 0;

    // ✅ Iterate through each step type and make a separate API call
    for (let stepIndex = 0; stepIndex < totalSteps; stepIndex++) {
      const stepType = STEP_TYPES[stepIndex];
      const substepLabel = STEP_TYPE_TO_SUBSTEP[stepType] || stepType;

      // Update UI substep
      if (onSubstepChange) {
        onSubstepChange(substepLabel);
      }

      console.log(`[generateMessages] 📞 Calling API for step: ${stepType} (${stepIndex + 1}/${totalSteps}) for node: ${targetNode.label}`);

      // ✅ Generate messages for the target node only
      {
        const node = targetNode;
        const contract = buildContractFromNode(node);

        const response = await fetch('/api/nlp/generate-ai-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contract,
            nodeLabel: node.label,
            stepType,  // ✅ NEW: Pass stepType to API
            locale,    // ✅ NEW: Pass locale to API
            provider,
            model
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.messages) {
            // ✅ API returns: { messages: ["msg1", "msg2", ...], options: [...] }
            const messages = Array.isArray(data.messages) ? data.messages : [data.messages];

            console.log(`[generateMessages] ✅ Received ${messages.length} messages for ${stepType}`, {
              stepType,
              messagesCount: messages.length,
              nodeId: node.id,
              nodeLabel: node.label
            });

            // ✅ Map step type to WizardStepMessages structure
            switch (stepType) {
              case 'start':
                allMessages.ask.base.push(...messages);
                break;
              case 'noInput':
                if (!allMessages.noInput) allMessages.noInput = { base: [] };
                allMessages.noInput.base.push(...messages);
                break;
              case 'noMatch':
                if (!allMessages.ask.reask) allMessages.ask.reask = [];
                allMessages.ask.reask.push(...messages);
                break;
              case 'confirmation':
                if (!allMessages.confirm) allMessages.confirm = { base: [] };
                allMessages.confirm.base.push(...messages);
                break;
              case 'notConfirmed':
                if (!allMessages.notConfirmed) allMessages.notConfirmed = { base: [] };
                allMessages.notConfirmed.base.push(...messages);
                break;
              case 'violation':
                if (!allMessages.violation) allMessages.violation = { base: [] };
                allMessages.violation.base.push(...messages);
                break;
              case 'disambiguation':
                if (!allMessages.disambiguation) allMessages.disambiguation = { base: [], options: [] };
                allMessages.disambiguation.base.push(...messages);
                if (data.options && Array.isArray(data.options)) {
                  allMessages.disambiguation.options.push(...data.options);
                }
                break;
              case 'success':
                if (!allMessages.success) allMessages.success = { base: [] };
                allMessages.success.base.push(...messages);
                break;
            }
          } else {
            console.warn(`[generateMessages] ⚠️ API returned success=false for ${stepType}`, data);
          }
        } else {
          const errorText = await response.text();
            console.error(`[generateMessages] ❌ API error for ${stepType} (node ${targetNode.id}):`, response.status, errorText);
        }
      }

      // ✅ Update progress
      completedSteps++;
      if (onProgress) {
        const progress = (completedSteps / totalSteps) * 100;
        onProgress(progress);
      }
    }

    // ✅ Clear substep
    if (onSubstepChange) {
      onSubstepChange(null);
    }

    // ✅ Final progress
    if (onProgress) {
      onProgress(100);
    }

    console.log('[generateMessages] ✅ Generated all messages', {
      askCount: allMessages.ask.base.length,
      askReaskCount: allMessages.ask.reask?.length || 0,
      noInputCount: allMessages.noInput?.base.length || 0,
      confirmCount: allMessages.confirm?.base.length || 0,
      notConfirmedCount: allMessages.notConfirmed?.base.length || 0,
      violationCount: allMessages.violation?.base.length || 0,
      disambiguationCount: allMessages.disambiguation?.base.length || 0,
      disambiguationOptionsCount: allMessages.disambiguation?.options.length || 0,
      successCount: allMessages.success?.base.length || 0
    });

    return allMessages;

  } catch (error) {
    console.error('[generateMessages] ❌ Error:', error);
    // Fallback: return empty messages
    return {
      ask: { base: [] },
      confirm: { base: [] },
      notConfirmed: { base: [] },
      violation: { base: [] },
      disambiguation: { base: [], options: [] },
      success: { base: [] }
    };
  }
}

/**
 * Calculate total number of parsers needed for all nodes
 * This is a simple calculation based on node structure, not a real API call
 *
 * @param schema Array of WizardTaskTreeNode
 * @returns Total count of parsers needed (1 per node)
 */
export function calculateTotalParsers(schema: WizardTaskTreeNode[]): number {
  const countNodes = (nodes: WizardTaskTreeNode[]): number => {
    let count = 0;
    nodes.forEach(node => {
      count += 1; // 1 parser per nodo
      if (node.subNodes && node.subNodes.length > 0) {
        count += countNodes(node.subNodes);
      }
    });
    return count;
  };
  return countNodes(schema);
}
