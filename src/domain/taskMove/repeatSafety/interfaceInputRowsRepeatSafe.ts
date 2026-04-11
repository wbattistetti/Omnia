/**
 * Child `flowInterface.input` is rebuilt from {@link InterfaceInputVars} each apply; duplicate VarIds
 * are skipped via a seen-set — second pipeline run is a no-op for identical sets.
 */

export const interfaceInputMergeIsIdempotentByConstruction = true;
