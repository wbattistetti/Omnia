# AI Agent editor module (design-time)

Self-contained UI and logic for editing **AI Agent** tasks: repository sync, LLM generation, proposed fields table, and multi-style dialogue preview. Flow variable bulk-link / **Implement** was removed from the UI (linking TBD); `agentDesignFrozen` is cleared on save (`false`).

## Phases

1. **Create**: single natural-language description + **Create Agent**.
2. **Structured**: tab bar switches one `AIAgentRevisionEditorShell` at a time; extra tab **Prompt finale** shows read-only textarea (composed Markdown).
3. **Refine**: one **Refine comportamento** button sends `sectionRefinements` (per-section `baseText` + `refinementOpLog`) in a single `/design/ai-agent-generate` call; IA can return per-section diffs.

## Persistence

- `agentStructuredSectionsJson`: per-section `{ base, deletedMask, inserts }`.
- `agentPrompt`: composed Markdown snapshot for runtime (kept in sync with structured state).
- `agentDesignDescription`: refine context; editable after create.

## Files

- **Shell**: `../AIAgentEditor.tsx` composes columns and hooks only.
- **Pure/domain**: `buildTaskSnapshot`, `mergeDesignFromApi`, `structuredSectionPersist`, `composeRuntimePromptMarkdown`, `revisionStateToPersisted`, `buildPersistPatch`.
- **Hooks**: `useAIAgentEditorController`, `useStructuredAgentSectionsRevision`, `useAIAgentToolbarController`.
