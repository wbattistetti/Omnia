import { ReviewItem, StepGroup, RecoveryGroup } from './types';

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
                    items: recoveryGroups[escKey].sort((a, b) => (a.actionIndex ?? 0) - (b.actionIndex ?? 0))
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

export function extractActionTextKey(action: any): string | undefined {
    const params = Array.isArray(action?.parameters) ? action.parameters : [];
    const p = params.find((x: any) => x?.parameterId === 'text');
    return typeof p?.value === 'string' ? p.value : undefined;
}

export function collectNodeMessages(
    node: any,
    translations: Record<string, string>,
    pathLabel: string
): ReviewItem[] {
    const out: ReviewItem[] = [];
    const steps = node?.steps || {};
    // Track which textKeys we've already collected to avoid duplicates
    const collectedTextKeys = new Set<string>();

    Object.keys(steps).forEach((stepKey) => {
        const stepData = steps[stepKey];

        // Priority 1: Check escalations (preferred source)
        let hasEscalations = false;

        if (Array.isArray(stepData)) {
            // Array format: stepData is array of escalations
            hasEscalations = true;
            stepData.forEach((esc: any, escIdx: number) => {
                const actions = Array.isArray(esc?.actions) ? esc.actions : [];
                actions.forEach((a: any, actIdx: number) => {
                    const key = extractActionTextKey(a);
                    const actionId = a.actionId || 'sayMessage';

                    // Include messages with or without textKey (to show newly added messages)
                    const shouldInclude = !key || !collectedTextKeys.has(key);
                    if (shouldInclude) {
                        if (key) collectedTextKeys.add(key);

                        // Priority: a.text (edited text) > translations[key] (persisted translation)
                        const text = (typeof a.text === 'string' && a.text.length > 0)
                            ? a.text
                            : (typeof key === 'string' ? (translations[key] || key) : a.text || '');

                        out.push({
                            id: `${pathLabel}|${stepKey}|${escIdx}|${actIdx}`,
                            stepKey,
                            escIndex: escIdx,
                            actionIndex: actIdx,
                            textKey: key,
                            text: text,
                            pathLabel,
                            actionId: actionId,
                            color: a.color,
                        });
                    }
                });
            });
        } else if (stepData?.escalations) {
            // Object format: stepData has escalations property
            hasEscalations = true;
            const escs = Array.isArray(stepData.escalations) ? stepData.escalations : [];
            escs.forEach((esc: any, escIdx: number) => {
                const actions = Array.isArray(esc?.actions) ? esc.actions : [];
                actions.forEach((a: any, actIdx: number) => {
                    const key = extractActionTextKey(a);
                    const actionId = a.actionId || 'sayMessage';

                    // Include messages with or without textKey (to show newly added messages)
                    const shouldInclude = !key || !collectedTextKeys.has(key);
                    if (shouldInclude) {
                        if (key) collectedTextKeys.add(key);

                        // Priority: a.text (edited text) > translations[key] (persisted translation)
                        const text = (typeof a.text === 'string' && a.text.length > 0)
                            ? a.text
                            : (typeof key === 'string' ? (translations[key] || key) : a.text || '');

                        out.push({
                            id: `${pathLabel}|${stepKey}|${escIdx}|${actIdx}`,
                            stepKey,
                            escIndex: escIdx,
                            actionIndex: actIdx,
                            textKey: key,
                            text: text,
                            pathLabel,
                            actionId: actionId,
                            color: a.color,
                        });
                    }
                });
            });
        }

        // Priority 2: Check legacy messages field ONLY if no escalations were found
        if (!hasEscalations) {
            const msgs = node?.messages || {};
            const m = msgs[stepKey];
            const key = typeof m?.textKey === 'string' ? m.textKey : undefined;
            if (key && !collectedTextKeys.has(key)) {
                collectedTextKeys.add(key);
                out.push({
                    id: `${pathLabel}|${stepKey}|-1|-1`,
                    stepKey,
                    escIndex: null,
                    actionIndex: null,
                    textKey: key,
                    text: translations[key] || key,
                    pathLabel,
                    actionId: 'sayMessage', // Default for legacy messages
                    color: undefined,
                });
            }
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

    const nodeLabel = node?.label || 'Current Node';
    const items = collectNodeMessages(node, translations, nodeLabel);

    return items.sort((a, b) => {
        const d = orderOf(a.stepKey) - orderOf(b.stepKey);
        if (d !== 0) return d;
        const e = (a.escIndex ?? 0) - (b.escIndex ?? 0);
        if (e !== 0) return e;
        return (a.actionIndex ?? 0) - (b.actionIndex ?? 0);
    });
}

