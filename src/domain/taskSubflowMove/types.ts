/**
 * Pipeline-facing aliases for task → subflow move (canonical 14-function pipeline).
 */

import type { Flow, FlowId } from '@flows/FlowTypes';
import type { TaskTreeNode } from '@types/taskTypes';

export type { FlowId };

export type TaskRoot = TaskTreeNode;
export type FlowSlice = Flow;

export type VariableId = string;
export type ObjectGuid = string;

export type TranslationKey = string;
export type TranslationValue = string | Record<string, string>;

export type TranslationPatch = Record<TranslationKey, TranslationValue>;

export type TaskTranslations = Record<TranslationKey, TranslationValue>;
