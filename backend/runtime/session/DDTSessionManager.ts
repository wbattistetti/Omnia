// DDT Session Manager - Backend Runtime
// Manages DDT Engine sessions for interactive dialogues with SSE support

import type { AssembledDDT, DDTNavigatorCallbacks } from '../ddt/types';
import { runDDT } from '../ddt/ddtEngine';
import type { RetrieveResult } from '../ddt/types';
import { EventEmitter } from 'events';
import { loadContract, findOriginalNode, extractWithContractSync } from '../ddt/utils';

export interface DDTSession {
  id: string;
  ddtInstance: AssembledDDT;
  state: any; // DDTEngineState
  callbacks: DDTNavigatorCallbacks;
  messages: Array<{ text: string; stepType?: string; escalationNumber?: number; timestamp: string }>;
  isRunning: boolean;
  result?: RetrieveResult;
  error?: Error;
  createdAt: Date;
  lastActivity: Date;
  eventEmitter?: EventEmitter; // ✅ SSE event emitter
  waitingForInput?: { nodeId: string; timestamp: Date }; // ✅ Track if waiting for input
}

export class DDTSessionManager {
  private sessions: Map<string, DDTSession> = new Map();
  private sessionTimeout: number = 30 * 60 * 1000; // 30 minutes

  /**
   * Creates a new DDT session
   */
  createSession(
    ddtInstance: AssembledDDT,
    translations: Record<string, string> = {},
    limits: { noMatchMax?: number; noInputMax?: number; notConfirmedMax?: number } = {}
  ): string {
    const sessionId = `ddt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🚀 [DDT SESSION] Creating new DDT session');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('[DDT SESSION] Session info:', {
      sessionId,
      mainDataCount: ddtInstance.mainData?.length || 0,
      hasTranslations: Object.keys(translations).length > 0,
      translationsCount: Object.keys(translations).length,
      limits
    });

    // Prepare callbacks that will be used by the DDT Engine
    const messages: Array<{ text: string; stepType?: string; escalationNumber?: number; timestamp: string }> = [];
    const pendingInputs: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }> = new Map();
    const eventEmitter = new EventEmitter(); // ✅ SSE event emitter

    const callbacks: DDTNavigatorCallbacks = {
      onMessage: (text: string, stepType?: string, escalationNumber?: number) => {
        const msg = {
          text,
          stepType: stepType || 'message',
          escalationNumber,
          timestamp: new Date().toISOString()
        };
        messages.push(msg);
        console.log('[DDTSessionManager] Message added to session', {
          sessionId,
          text: text.substring(0, 50),
          stepType,
          escalationNumber
        });
        // ✅ Emit SSE event
        eventEmitter.emit('message', msg);
      },
      onGetRetrieveEvent: async (nodeId: string, ddtParam?: AssembledDDT) => {
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log('⏳ [DDTSessionManager] Waiting for user input', { sessionId, nodeId });
        console.log('═══════════════════════════════════════════════════════════════════════════');

        // ✅ Track waiting state in session (so SSE can send it even if listener registers late)
        session.waitingForInput = { nodeId, timestamp: new Date() };

        // ✅ Emit SSE event for waiting input
        console.log('[DDTSessionManager] 📡 Emitting waitingForInput SSE event', { sessionId, nodeId });
        eventEmitter.emit('waitingForInput', { nodeId });
        console.log('[DDTSessionManager] ✅ waitingForInput event emitted', { sessionId, nodeId });

        // Return a promise that will be resolved when input is provided via provideInput()
        return new Promise((resolve, reject) => {
          pendingInputs.set(nodeId, { resolve, reject });
        });
      },
      onProcessInput: async (input: string, node: any) => {
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log('[DDTSessionManager] Processing input', {
          sessionId,
          input: input.substring(0, 50),
          nodeId: node?.id,
          nodeLabel: node?.label
        });
        console.log('═══════════════════════════════════════════════════════════════════════════');

        // ✅ Load contract from original node (like frontend does)
        let originalNode: any = null;
        if (session.ddtInstance) {
          originalNode = findOriginalNode(session.ddtInstance, node?.label, node?.id);
        }

        // ✅ Use contract for extraction (like frontend does)
        const contract = originalNode ? loadContract(originalNode) : loadContract(node);

        if (contract) {
          console.log('[DDTSessionManager] ✅ Contract found, extracting values', {
            templateName: contract.templateName,
            hasRegex: !!contract.regex,
            patternsCount: contract.regex?.patterns?.length || 0
          });

          const result = extractWithContractSync(input, contract, undefined);

          if (result.hasMatch && Object.keys(result.values).length > 0) {
            console.log('[DDTSessionManager] ✅ Values extracted successfully', {
              values: result.values,
              valuesCount: Object.keys(result.values).length,
              source: result.source
            });
            return {
              status: 'match' as const,
              value: result.values // ✅ Return structured object (e.g., { day: 1, month: 1, year: 1980 })
            };
          } else {
            console.log('[DDTSessionManager] ⚠️ No match found with contract, returning noMatch');
            return { status: 'noMatch' as const };
          }
        } else {
          console.warn('[DDTSessionManager] ⚠️ No contract found, fallback to simple string match', {
            hasOriginalNode: !!originalNode,
            hasContract: !!contract
          });
          // Fallback: return input as string (for backward compatibility)
          return {
            status: 'match' as const,
            value: input
          };
        }
      },
      onUserInputProcessed: (input: string, matchStatus: 'match' | 'noMatch' | 'partialMatch', extractedValues?: any[]) => {
        console.log('[DDTSessionManager] Input processed', { sessionId, matchStatus });
      },
      translations
    };

    const session: DDTSession = {
      id: sessionId,
      ddtInstance,
      state: null, // Will be set by DDT Engine
      callbacks,
      messages,
      isRunning: false,
      createdAt: new Date(),
      lastActivity: new Date(),
      eventEmitter // ✅ Store event emitter for SSE
    };

    // Store pending inputs map in session for later use
    (session as any).pendingInputs = pendingInputs;

    this.sessions.set(sessionId, session);

    console.log('✅ [DDT SESSION] Session created, starting DDT Engine...');

    // Start DDT Engine in background
    this.startDDTEngine(session, limits).catch(error => {
      console.error('❌ [DDT SESSION] Error starting DDT Engine', { sessionId, error });
      session.error = error;
      session.isRunning = false;
    });

    return sessionId;
  }

  /**
   * Starts DDT Engine for a session
   */
  private async startDDTEngine(
    session: DDTSession,
    limits: { noMatchMax?: number; noInputMax?: number; notConfirmedMax?: number }
  ): Promise<void> {
    session.isRunning = true;
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🚀 [DDT ENGINE] Starting DDT Engine for session:', { sessionId: session.id });
    console.log('═══════════════════════════════════════════════════════════════════════════');

    try {
      const result = await runDDT(session.ddtInstance, session.callbacks, {
        noMatchMax: limits.noMatchMax || 3,
        noInputMax: limits.noInputMax || 3,
        notConfirmedMax: limits.notConfirmedMax || 2
      });

      session.result = result;
      session.isRunning = false;
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('✅ [DDT ENGINE] DDT Engine completed', {
        sessionId: session.id,
        success: result.success,
        messagesCount: session.messages.length,
        hasValue: !!result.value
      });
      console.log('═══════════════════════════════════════════════════════════════════════════');
      // ✅ Emit SSE event for completion
      session.eventEmitter?.emit('complete', result);
    } catch (error) {
      session.error = error as Error;
      session.isRunning = false;
      console.error('═══════════════════════════════════════════════════════════════════════════');
      console.error('❌ [DDT ENGINE] DDT Engine error', { sessionId: session.id, error });
      console.error('═══════════════════════════════════════════════════════════════════════════');
      // ✅ Emit SSE event for error
      session.eventEmitter?.emit('error', error);
    }
  }

  /**
   * Gets session by ID (for SSE stream)
   */
  getSession(sessionId: string): DDTSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Provides user input to a session
   */
  provideInput(sessionId: string, input: string): { success: boolean; error?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (!session.isRunning) {
      return { success: false, error: 'Session is not running' };
    }

    const pendingInputs: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }> = (session as any).pendingInputs;
    if (!pendingInputs || pendingInputs.size === 0) {
      return { success: false, error: 'No pending input request' };
    }

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('📥 [DDT SESSION] Input received', {
      sessionId,
      inputLength: input.length,
      isEmpty: !input || input.trim() === ''
    });
    console.log('═══════════════════════════════════════════════════════════════════════════');

    session.lastActivity = new Date();

    // Resolve the first pending input (usually there's only one)
    const firstPending = Array.from(pendingInputs.entries())[0];
    if (firstPending) {
      const [nodeId, { resolve }] = firstPending;

      // Determine event type based on input
      let event: any;
      if (!input || input.trim() === '') {
        event = { type: 'noInput' };
      } else {
        event = { type: 'match', value: input };
      }

      resolve(event);
      pendingInputs.delete(nodeId);

      // ✅ Clear waitingForInput flag when input is provided
      if (session.waitingForInput && session.waitingForInput.nodeId === nodeId) {
        session.waitingForInput = undefined;
      }

      console.log('✅ [DDT SESSION] Input provided successfully', {
        sessionId,
        nodeId,
        eventType: event.type
      });
    }

    return { success: true };
  }

  /**
   * Gets session status
   */
  getSessionStatus(sessionId: string): {
    found: boolean;
    session?: {
      id: string;
      isRunning: boolean;
      messages: Array<{ text: string; stepType?: string; escalationNumber?: number; timestamp: string }>;
      result?: RetrieveResult;
      error?: string;
      waitingForInput: boolean;
      currentInputNodeId?: string;
    };
  } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { found: false };
    }

    const pendingInputs: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }> = (session as any).pendingInputs || new Map();
    const waitingForInput = pendingInputs.size > 0;
    const currentInputNodeId = waitingForInput ? Array.from(pendingInputs.keys())[0] : undefined;

    return {
      found: true,
      session: {
        id: session.id,
        isRunning: session.isRunning,
        messages: [...session.messages], // Copy array
        result: session.result,
        error: session.error?.message,
        waitingForInput,
        currentInputNodeId
      }
    };
  }

  /**
   * Gets new messages since last check
   */
  getNewMessages(sessionId: string, lastMessageIndex: number): {
    found: boolean;
    messages?: Array<{ text: string; stepType?: string; escalationNumber?: number; timestamp: string }>;
    hasMore: boolean;
  } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { found: false, hasMore: false };
    }

    const newMessages = session.messages.slice(lastMessageIndex);
    return {
      found: true,
      messages: newMessages,
      hasMore: session.isRunning
    };
  }

  /**
   * Deletes a session
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Cleans up old sessions
   */
  cleanup(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      const lastActivity = session.lastActivity.getTime();
      if (now - lastActivity > this.sessionTimeout) {
        console.log('[DDTSessionManager] Cleaning up old session', { sessionId });
        this.sessions.delete(sessionId);
      }
    }
  }
}

// Singleton instance
export const ddtSessionManager = new DDTSessionManager();

// Cleanup old sessions every 5 minutes
setInterval(() => {
  ddtSessionManager.cleanup();
}, 5 * 60 * 1000);

