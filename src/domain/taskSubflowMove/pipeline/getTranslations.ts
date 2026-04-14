/**
 * Canonical step: logical translation keys to copy for the moved task (SayMessage + var: rows).
 */

import type { Task } from '@types/taskTypes';
import type { VariableInstance } from '@types/variableTypes';
import { buildTranslationKeysForTaskMove } from '../taskMoveTranslationPipeline';

export type GetTranslationsInput = {
  movedTask: Task | undefined;
  taskVariableRows: readonly VariableInstance[];
};

export type GetTranslationsOutput = ReadonlySet<string>;

/**
 * Keys used for clone/remove translation policy (resolved against parent flow in CloneTranslations).
 */
export function GetTranslations(input: GetTranslationsInput): GetTranslationsOutput {
  return buildTranslationKeysForTaskMove(input.movedTask, input.taskVariableRows);
}
