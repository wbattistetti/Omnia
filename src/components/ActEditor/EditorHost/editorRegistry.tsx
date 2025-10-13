import React, { lazy } from 'react';
import type { EditorKind, EditorProps } from './types';

type LazyComp = React.LazyExoticComponent<React.ComponentType<EditorProps>>;

const DDTEditor = lazy(() => import('../ResponseEditor/DDTHostAdapter')) as unknown as LazyComp;
const IntentEditor = lazy(() => import('../../../features/intent-editor/HostAdapter')) as unknown as LazyComp;
const TextMessageEditor = lazy(() => import('./editors/TextMessageEditor')) as unknown as LazyComp;
const BackendCallEditor = lazy(() => import('./editors/BackendCallEditor')) as unknown as LazyComp;

export const registry: Record<EditorKind, LazyComp> = {
  message: TextMessageEditor,
  ddt: DDTEditor,
  intent: IntentEditor,
  backend: BackendCallEditor,
};


