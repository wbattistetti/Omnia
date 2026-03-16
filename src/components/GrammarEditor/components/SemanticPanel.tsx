// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { SlotEditor } from './SlotEditor/SlotEditor';

/**
 * Semantic Panel component
 * Wraps the SlotEditor component
 */
export function SemanticPanel({ editorMode = 'text' }: { editorMode?: 'text' | 'graph' }) {
  return <SlotEditor editorMode={editorMode} />;
}
