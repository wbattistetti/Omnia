import { WizardTaskTreeNode, WizardConstraint, WizardStepMessages } from '../types';
import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';
import { convertApiStructureToWizardTaskTree } from '../utils/convertApiStructureToWizardTaskTree';
import { validateWizardContract } from '../utils/validateWizardContract';

// ✅ REMOVED: generateGroupName, rewritePatternGroupNames, escapeRegex
// Group names are now deterministic (s1, s2, s3) based on subNode index.
// AI generates patterns directly with these names - no rewriting needed.

/**
 * ⚠️ DEPRECATED: This function is no longer needed.
 * Labels are now cleaned at the source (during convertApiStructureToWizardTaskTree).
 * Icons are extracted from emoji and stored separately.
 *
 * Kept for reference only - should be removed in future cleanup.
 *
 * @deprecated Use extractEmojiAndIcon from emojiIconExtractor.ts instead
 */
function sanitizeForBackend(data: any): any {
  if (typeof data === 'string') {
    // Remove ALL emoji using Unicode property escapes (most comprehensive)
    // \p{Emoji_Presentation} matches emoji that are always displayed as emoji
    // \p{Extended_Pictographic} matches emoji that can be displayed as emoji or text
    let sanitized = data
      .replace(/\p{Emoji_Presentation}/gu, '') // Emoji always displayed as emoji
      .replace(/\p{Extended_Pictographic}/gu, '') // Emoji that can be displayed as emoji or text
      .replace(/[\u{1F000}-\u{1F9FF}]/gu, '') // Fallback: All emoji range (including 🔍 U+1F50D)
      .replace(/[\u{2600}-\u{26FF}]/gu, '') // Misc symbols
      .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
      .replace(/[\u{D800}-\u{DFFF}]/gu, '') // Surrogate pairs
      .replace(/[\u{200B}-\u{200D}]/gu, '') // Zero-width characters
      .replace(/[\u{FEFF}]/gu, '') // Zero-width no-break space
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Control characters
      .trim();

    // If Unicode property escapes are not supported, fall back to range-based removal
    if (sanitized === data && /[\u{1F000}-\u{1F9FF}]/u.test(data)) {
      // Fallback: remove emoji using range-based regex
      sanitized = data
        .replace(/[\u{1F000}-\u{1F9FF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
        .trim();
    }

    return sanitized;
  }

  if (Array.isArray(data)) {
    // Recursively sanitize all array elements
    return data.map(item => sanitizeForBackend(item));
  }

  if (data && typeof data === 'object') {
    // Recursively sanitize all object properties
    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        // Sanitize both key and value
        const sanitizedKey = typeof key === 'string' ? sanitizeForBackend(key) : key;
        sanitized[sanitizedKey] = sanitizeForBackend(data[key]);
      }
    }
    return sanitized;
  }

  // Return primitive values as-is (numbers, booleans, null, undefined)
  return data;
}

/**
 * Extract named group names from a regex pattern
 */
function extractGroupNames(pattern: string): string[] {
  const groups: string[] = [];
  // Match both Python (?P<name>...) and JavaScript (?<name>...) syntax
  const pythonPattern = /\(\?P<([^>]+)>/g;
  const jsPattern = /\(\?<([^>]+)>/g;

  let match;
  while ((match = pythonPattern.exec(pattern)) !== null) {
    groups.push(match[1]);
  }
  while ((match = jsPattern.exec(pattern)) !== null) {
    groups.push(match[1]);
  }

  return groups;
}

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
  rowId?: string, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
  locale: string = 'it'
): Promise<{
  schema: WizardTaskTreeNode[];
  shouldBeGeneral: boolean;
  generalizedLabel?: string | null;
  generalizationReason?: string | null;
  generalizedMessages?: any | null;
}> {
  try {
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
        taskId: rowId // ✅ Backend still expects taskId, but we pass rowId (which equals task.id)
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
    const generalizedLabel = data.generalizedLabel || null;
    const generalizationReason = data.generalizationReason || null;
    const generalizedMessages = data.generalizedMessages || null;

    // ✅ CRITICAL: rowId MUST be provided (it equals row.id which equals task.id)
    if (!rowId) {
      throw new Error('[generateStructure] CRITICAL: rowId is required. It must equal row.id (which equals task.id when task exists).');
    }

    // Convert API structure to WizardTaskTreeNode format
    const converted = convertApiStructureToWizardTaskTree(data.structure, rowId); // ✅ ALWAYS equals row.id

    // ✅ Apply generalization fields to root node only
    if (converted.length > 0 && (shouldBeGeneral || generalizedLabel || generalizationReason || generalizedMessages)) {
      converted[0].shouldBeGeneral = shouldBeGeneral;
      converted[0].generalizedLabel = generalizedLabel;
      converted[0].generalizationReason = generalizationReason;
      converted[0].generalizedMessages = generalizedMessages;
    }

    return {
      schema: converted,
      shouldBeGeneral,
      generalizedLabel,
      generalizationReason,
      generalizedMessages
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Convert WizardTaskTreeNode to SemanticContract format
 */
export function buildContractFromNode(node: WizardTaskTreeNode): any {
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
    if (!value || value === null) {
      return; // Skip this constraint
    }
    constraints.push({
      kind: key,
      title: key,
      payoff: value.description ?? key,
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

    const allConstraints: WizardConstraint[] = [];
    const provider = localStorage.getItem('omnia.aiProvider') || 'openai';
    const model = localStorage.getItem('omnia.aiModel') || undefined;

    // Generate constraints for each node
    for (let i = 0; i < schema.length; i++) {
      const node = schema[i];
      const contract = buildContractFromNode(node);

      // ✅ Labels are already clean (no emoji) - extracted during convertApiStructureToWizardTaskTree
      // No sanitization needed

      if (onProgress) {
        const progress = ((i + 1) / schema.length) * 100;
        onProgress(progress);
      }

      const response = await fetch('/api/nlp/generate-constraints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract,
          nodeLabel: node.label, // ✅ Clean label (no emoji)
          locale,
          provider,
          model
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        continue;
      }

      const data = await response.json();

      if (data.success && data.constraints) {
        const nodeConstraints = convertApiConstraintsToWizardConstraints(data.constraints, node.label);
        allConstraints.push(...nodeConstraints);
      }
    }

    return allConstraints;

  } catch (error) {
    // Fallback: return empty array instead of mock
    return [];
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
 * ✅ RINOMINATO: generateMessages (era fakeGenerateMessages)
 * ✅ NUOVO: Fa 8 chiamate API separate, una per ogni step type
 *
 * @param schema Array di WizardTaskTreeNode
 * @param locale Locale code (default: 'it')
 * @param onProgress Callback per progresso (0-100)
 * @returns Promise<WizardStepMessages> con messaggi per tutti gli step
 */
export async function generateMessages(
  schema: WizardTaskTreeNode[],
  locale: string = 'it',
  onProgress?: (progress: number) => void
): Promise<WizardStepMessages> {
  try {
    const provider = localStorage.getItem('omnia.aiProvider') || 'openai';
    const model = localStorage.getItem('omnia.aiModel') || undefined;

    // ✅ IMPORTANT: schema should contain only ONE node when called from generateMessagesForTask
    // If multiple nodes are passed, we only process the first one
    if (schema.length === 0) {
      throw new Error('generateMessages: schema must contain at least one node');
    }
    const targetNode = schema[0];

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
          }
        } else {
          const errorText = await response.text();
        }
      }

      // ✅ Update progress
      completedSteps++;
      if (onProgress) {
        const progress = (completedSteps / totalSteps) * 100;
        onProgress(progress);
      }
    }

    // ✅ Final progress
    if (onProgress) {
      onProgress(100);
    }


    return allMessages;

  } catch (error) {
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
