/**
 * Canonical step: reserved for future input-side S2 bindings.
 * Current product persists all portal wiring via {@link CreateOutputBindings} + single `subflowBindings` array.
 */

export type CreateInputBindingsInput = Record<string, never>;

export type CreateInputBindingsOutput = true;

/**
 * No-op: input-parameter bindings are not split from output bindings in the current schema.
 */
export function CreateInputBindings(_input: CreateInputBindingsInput): CreateInputBindingsOutput {
  return true;
}
