import { ReviewItem, StepGroup, RecoveryGroup } from '@responseEditor/MessageReview/types';
import { getTaskText } from '@responseEditor/utils/escalationHelpers';

const STEP_ORDER = ['start', 'confirmation', 'noInput', 'noMatch', 'notConfirmed', 'notAcquired', 'success'];

export function orderOf(k: string): number {
    const i = STEP_ORDER.indexOf(k);
    return i === -1 ? 999 : i;
}

export function groupMessagesByStep(items: ReviewItem[]): StepGroup[] {
    const groups: Record<string, ReviewItem[]> = {};

    items.forEach(item => {
        if (!groups[item.stepKey]) {
            groups[item.stepKey] = [];
        }
        groups[item.stepKey].push(item);
    });

    // Map numeric stepKeys to actual step names
    const stepKeyMapping: Record<string, string> = {
        '0': 'start',
        '1': 'noMatch',
        '2': 'noInput',
        '3': 'confirmation',
        '4': 'success',
        '5': 'notAcquired',
        '6': 'notConfirmed'
    };

    // Convert numeric keys to string keys and group by actual step type
    // Also deduplicate by textKey within each step group
    const mappedGroups: Record<string, Map<string, ReviewItem>> = {};
    Object.keys(groups).forEach(numericKey => {
        const actualStepKey = stepKeyMapping[numericKey] || numericKey;
        if (!mappedGroups[actualStepKey]) {
            mappedGroups[actualStepKey] = new Map();
        }
        // Use textKey as key to deduplicate
        groups[numericKey].forEach(item => {
            if (item.textKey) {
                if (!mappedGroups[actualStepKey].has(item.textKey)) {
                    mappedGroups[actualStepKey].set(item.textKey, item);
                }
            } else {
                // For items without textKey, use id
                mappedGroups[actualStepKey].set(item.id, item);
            }
        });
    });

    // Group by stepKey first, then by escIndex (recovery) within each step
    const stepGroups: StepGroup[] = [];

    const allSteps = [...STEP_ORDER, ...Object.keys(mappedGroups).filter(key => !STEP_ORDER.includes(key))];

    allSteps.forEach(stepKey => {
        const stepItems = Array.from(mappedGroups[stepKey]?.values() || []);
        if (stepItems.length === 0) return;

        // Group items by escIndex (recovery)
        const recoveryGroups: Record<string, ReviewItem[]> = {};
        stepItems.forEach(item => {
            const escKey = item.escIndex !== null && item.escIndex !== undefined
                ? `esc_${item.escIndex}`
                : 'no_esc';
            if (!recoveryGroups[escKey]) {
                recoveryGroups[escKey] = [];
            }
            recoveryGroups[escKey].push(item);
        });

        // Convert to RecoveryGroup array, sorted by escIndex
        const recoveries = Object.keys(recoveryGroups)
            .map(escKey => {
                const escIndex = escKey === 'no_esc' ? null : parseInt(escKey.replace('esc_', ''), 10);
                return {
                    escIndex,
                    items: recoveryGroups[escKey].sort((a, b) => (a.taskIndex ?? 0) - (b.taskIndex ?? 0))
                };
            })
            .sort((a, b) => {
                // Sort: null last, then by index
                if (a.escIndex === null) return 1;
                if (b.escIndex === null) return -1;
                return a.escIndex - b.escIndex;
            });

        stepGroups.push({
            stepKey,
            recoveries
        });
    });

    return stepGroups.filter(group => group.recoveries.length > 0);
}

export function extractTaskTextKey(task: any): string | undefined {
    const params = Array.isArray(task?.parameters) ? task.parameters : [];
    const p = params.find((x: any) => x?.parameterId === 'text');
    return typeof p?.value === 'string' ? p.value : undefined;
}

export function collectNodeMessages(
    node: any,
    translations: Record<string, string>,
    pathLabel: string
): ReviewItem[] {
    const out: ReviewItem[] = [];
    // ✅ NO FALLBACKS: node.steps must exist after validation (can be empty object)
    const steps = node?.steps ?? {};
    // Track which textKeys we've already collected to avoid duplicates
    const collectedTextKeys = new Set<string>();

    // Handle both array format (new) and object format (legacy)
    let stepsToProcess: Array<{ stepKey: string; escalations: any[] }> = [];

    if (Array.isArray(steps)) {
        // ✅ NUOVO MODELLO: Array MaterializedStep[]
        // Estrai stepKey da templateStepId (formato: `${nodeTemplateId}:${stepKey}`)
        stepsToProcess = steps.map((step: any) => {
            let stepKey = 'start'; // Default fallback

            // Prova prima con type diretto (se presente per retrocompatibilità)
            if (step?.type) {
                stepKey = step.type;
            } else if (step?.templateStepId) {
                // Estrai il tipo step da templateStepId (ultima parte dopo ':')
                const extractedKey = step.templateStepId.split(':').pop();
                if (extractedKey) {
                    stepKey = extractedKey;
                }
            }

            return {
                stepKey,
                escalations: Array.isArray(step?.escalations) ? step.escalations : []
            };
        });
    } else {
        // Legacy format: steps is an object with stepKey as keys
        stepsToProcess = Object.keys(steps).map((stepKey) => {
            const stepData = steps[stepKey];
            if (Array.isArray(stepData)) {
                // Array format: stepData is array of escalations
                return { stepKey, escalations: stepData };
            } else if (stepData?.escalations) {
                // Object format: stepData has escalations property
                return { stepKey, escalations: Array.isArray(stepData.escalations) ? stepData.escalations : [] };
            }
            return { stepKey, escalations: [] };
        });
    }

    stepsToProcess.forEach(({ stepKey, escalations }) => {
        // Priority 1: Check escalations (preferred source)
        let hasEscalations = false;

        if (escalations.length > 0) {
            hasEscalations = true;
            escalations.forEach((esc: any, escIdx: number) => {
                // ✅ CAMBIATO: usa tasks invece di actions
                const tasks = Array.isArray(esc?.tasks) ? esc.tasks : [];
                tasks.forEach((task: any, taskIdx: number) => {
                    // ✅ CAMBIATO: estrai textKey dalle task (funziona anche per task perché hanno parameters)
                    const key = extractTaskTextKey(task);
                    const templateId = task?.templateId || 'sayMessage';

                    // Include messages with or without textKey (to show newly added messages)
                    const shouldInclude = !key || !collectedTextKeys.has(key);
                    if (shouldInclude) {
                        if (key) collectedTextKeys.add(key);

                        // ✅ USA getTaskText per applicare la stessa logica di fallback (traduzione → label template → task.label)
                        const text = getTaskText(task, translations);

                        out.push({
                            id: `${pathLabel}|${stepKey}|${escIdx}|${taskIdx}`,
                            stepKey,
                            escIndex: escIdx,
                            taskIndex: taskIdx,
                            textKey: key,
                            text: text,
                            pathLabel,
                            taskId: templateId, // ✅ CAMBIATO: usa templateId invece di actionId
                            color: task.color,
                        });
                    }
                });
            });
        }

        // Priority 2: Legacy messages field removed - NO FALLBACKS
        // After validation strict, node.messages should not exist
        // If no escalations found and messages exist, log warning
        if (!hasEscalations && node?.messages) {
            console.warn(
                `[collectNodeMessages] Node has legacy 'messages' field but no escalations. ` +
                `Node id: ${node.id || 'unknown'}, stepKey: ${stepKey}. ` +
                `Legacy messages field is deprecated. Use steps dictionary with escalations instead.`
            );
        }
    });

    return out;
}

export function collectAllMessages(
    node: any,
    translations: Record<string, string>
): ReviewItem[] {
    if (!node) {
        return [];
    }

    // ✅ NO FALLBACKS: node.label must exist, use 'Current Node' only as explicit default for logging
    const nodeLabel = node?.label ?? 'Current Node';
    const items = collectNodeMessages(node, translations, nodeLabel);

    return items.sort((a, b) => {
        const d = orderOf(a.stepKey) - orderOf(b.stepKey);
        if (d !== 0) return d;
        const e = (a.escIndex ?? 0) - (b.escIndex ?? 0);
        if (e !== 0) return e;
        return (a.taskIndex ?? 0) - (b.taskIndex ?? 0);
    });
}

