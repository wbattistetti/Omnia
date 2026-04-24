/**
 * Stable React context singletons for the flow workspace store.
 *
 * Keeping `createContext` here (instead of inline in FlowStore.tsx) avoids Vite HMR
 * reloading FlowStore and allocating new context objects while AppContent still mounts
 * a Provider from the previous module instance — which surfaces as
 * "useFlowWorkspace must be used within FlowWorkspaceProvider".
 */

import { createContext } from 'react';
import type { WorkspaceState } from './FlowTypes';

export const WorkspaceContext = createContext<WorkspaceState | undefined>(undefined);

/** Intentionally `any` to avoid circular type imports with FlowStore action unions. */
export const WorkspaceDispatchContext = createContext<React.Dispatch<any> | undefined>(undefined);

export const WorkspaceSnapshotRefContext = createContext<React.MutableRefObject<WorkspaceState> | null>(
  null
);
