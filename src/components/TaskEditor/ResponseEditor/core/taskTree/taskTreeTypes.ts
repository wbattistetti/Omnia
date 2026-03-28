/**
 * Path-based addressing for TaskTree nodes (indices from root `nodes` downward).
 * Empty array is not a valid node path; root-level siblings use [i], children use [i, j, ...].
 */
export type NodePath = number[];
