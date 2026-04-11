/**
 * GUID-centric domain types for task→subflow move: identity is VarId; display text lives in translations.
 */

/** Project variable / task identity (RFC UUID or app safe id). */
export type VarId = string & { readonly __brand: 'VarId' };

export type TaskVariables = ReadonlySet<VarId>;
export type ReferencedTaskVariables = ReadonlySet<VarId>;
export type VarsReferencedInOrigin = ReadonlySet<VarId>;
export type DeletableOriginVariables = ReadonlySet<VarId>;
export type ChildRequiredVariables = ReadonlySet<VarId>;
export type InterfaceOutputVars = readonly VarId[];
export type InterfaceInputVars = readonly VarId[];
