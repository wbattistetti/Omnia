/**
 * Shared types for third-party workspace providers (remote agent platforms mirrored in Omnia).
 */

/** Stable provider id (e.g. `elevenlabs`). */
export type WorkspaceProviderId = string;

export type RemoteAgentRef = {
  providerId: WorkspaceProviderId;
  agentId: string;
  name?: string;
};

export type WorkspaceWorkflowNodeKind =
  | 'start'
  | 'end'
  | 'subagent'
  | 'tool'
  | 'transfer'
  | 'unknown';

/** Normalized workflow node for UI and import (provider-agnostic). */
export type WorkspaceWorkflowNode = {
  id: string;
  label: string;
  kind: WorkspaceWorkflowNodeKind;
  /**
   * Node-specific override only (`additional_prompt` / per-node prompt).
   * Never the agent-level system prompt — that lives in `WorkspaceAgentSettings.globalPrompt`.
   */
  promptText: string;
  /** ElevenLabs-style: subagent uses agent system prompt when no override text is set. */
  inheritsGlobalPrompt?: boolean;
  /** Outgoing edge ids in display order when known. */
  edgeOrder: readonly string[];
  /** Canvas coordinates from ElevenLabs workflow editor when present. */
  position?: { x: number; y: number };
  knowledgeBase?: WorkspaceNodeKnowledgeBase;
  tools?: WorkspaceNodeTools;
  /** Original workflow node JSON from ConvAI (for Raw tab). */
  raw?: Record<string, unknown>;
};

export type WorkspaceKnowledgeDocumentRef = {
  id: string;
  name: string;
};

/** Per-node Knowledge Base (ElevenLabs workflow subagent). */
export type WorkspaceNodeKnowledgeBase = {
  inheritsAgentKnowledgeBase: boolean;
  additionalDocuments: readonly WorkspaceKnowledgeDocumentRef[];
};

export type WorkspaceNodeBuiltInTool = {
  id: string;
  label: string;
  enabled: boolean;
};

export type WorkspaceNodeAdditionalToolRef = {
  id: string;
  name: string;
};

/** Per-node tools (ElevenLabs workflow subagent). */
export type WorkspaceNodeTools = {
  inheritsAgentTools: boolean;
  builtInTools: readonly WorkspaceNodeBuiltInTool[];
  additionalTools: readonly WorkspaceNodeAdditionalToolRef[];
};

/** Agent-level settings mirrored from ConvAI `conversation_config` (read-only in Omnia v1). */
export type WorkspaceAgentSettings = {
  globalPrompt: string;
  firstMessage: string;
  language: string;
  llm: string;
  voiceId: string;
  ttsModel: string;
  preventSubagentLoops: boolean;
};

export type WorkspaceWorkflowEdgeConditionKind = 'unconditional' | 'llm' | 'expression' | 'unknown';

export type WorkspaceWorkflowEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  conditionKind: WorkspaceWorkflowEdgeConditionKind;
  conditionText?: string;
};

export type WorkspaceWorkflowGraph = {
  nodes: readonly WorkspaceWorkflowNode[];
  edges: readonly WorkspaceWorkflowEdge[];
};

export type WorkspaceToolKind =
  | 'webhook'
  | 'client'
  | 'system'
  | 'api_integration_webhook'
  | 'unknown';

export type WorkspaceToolScope = 'agent' | 'node';

/** Resolved ConvAI tool for workspace UI (agent-level or per-node). */
export type WorkspaceResolvedTool = {
  id: string;
  name: string;
  kind: WorkspaceToolKind;
  description?: string;
  httpMethod?: string;
  url?: string;
  enabled: boolean;
  scope: WorkspaceToolScope;
  nodeId?: string;
  nodeLabel?: string;
};

export type WorkspaceAgentToolInventory = {
  /** Tools attached to the agent (global prompt). */
  agentTools: readonly WorkspaceResolvedTool[];
  /** Agent tools + per-node additional tools, each row scoped (for Webhook tab). */
  allTools: readonly WorkspaceResolvedTool[];
};

export type WorkspaceAgentSnapshot = {
  ref: RemoteAgentRef;
  /** Raw provider payload subset for debug / advanced UI. */
  rawConversationConfig?: Record<string, unknown>;
  workflow: WorkspaceWorkflowGraph;
  globalPrompt?: string;
  settings: WorkspaceAgentSettings;
  toolInventory: WorkspaceAgentToolInventory;
};

export type WorkspaceTaskBinding = {
  providerId: WorkspaceProviderId;
  remoteAgentId: string;
  lastSelectedNodeId?: string;
};

export type ImportNodeToOmniaResult = {
  promptApplied: boolean;
  variableNames: readonly string[];
  toolCount: number;
  backendsAdded: number;
  backendsLinked: number;
};
