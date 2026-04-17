/**
 * Single authority for focus policy in Flow Mode (debugger chat vs canvas vs editor).
 * All programmatic focus to the flow chat input must go through tryFocusChatInput().
 */

export type FlowFocusSurface = 'chat' | 'canvas' | 'editor' | 'none';

const COOLDOWN_AFTER_OUTSIDE_MS = 500;

export class FlowFocusManager {
  private activeSurface: FlowFocusSurface = 'none';

  private isEditorOpen = false;

  private isCanvasActive = false;

  private isChatActive = false;

  private isFlowRemounting = false;

  private lastUserInteractionTs = 0;

  /** Updated when the user clicks outside the chat panel root (capture mousedown). */
  private lastNonChatPointerTs = 0;

  private chatSuspendDepth = 0;

  private replayActive = false;

  /** User clicked / interacted (for diagnostics). */
  touchInteraction(): void {
    this.lastUserInteractionTs = Date.now();
  }

  requestFocus(surface: 'chat' | 'canvas' | 'editor'): void {
    this.touchInteraction();
    if (surface === 'editor') {
      this.isEditorOpen = true;
      this.activeSurface = 'editor';
      this.isCanvasActive = false;
      return;
    }
    if (surface === 'canvas') {
      this.isCanvasActive = true;
      this.activeSurface = 'canvas';
      this.isChatActive = false;
      return;
    }
    this.isChatActive = true;
    this.activeSurface = 'chat';
    this.isCanvasActive = false;
    this.lastNonChatPointerTs = 0;
  }

  releaseFocus(surface: 'chat' | 'canvas' | 'editor'): void {
    this.touchInteraction();
    if (surface === 'editor') {
      this.isEditorOpen = false;
      if (this.activeSurface === 'editor') this.activeSurface = 'none';
      return;
    }
    if (surface === 'canvas') {
      this.isCanvasActive = false;
      if (this.activeSurface === 'canvas') this.activeSurface = 'none';
      return;
    }
    this.isChatActive = false;
    if (this.activeSurface === 'chat') this.activeSurface = 'none';
  }

  suspendFocus(surface: 'chat'): void {
    if (surface === 'chat') {
      this.chatSuspendDepth += 1;
    }
  }

  resumeFocus(surface: 'chat'): void {
    if (surface === 'chat') {
      this.chatSuspendDepth = Math.max(0, this.chatSuspendDepth - 1);
    }
  }

  setFlowRemounting(value: boolean): void {
    this.isFlowRemounting = value;
  }

  setReplayActive(value: boolean): void {
    this.replayActive = value;
  }

  /** Pointer went down outside the chat root (not in a portaled dialog/menu). */
  notifyPointerDownOutsideChatRoot(): void {
    this.lastNonChatPointerTs = Date.now();
    this.isChatActive = false;
    if (this.activeSurface === 'chat') {
      this.activeSurface = 'none';
    }
  }

  /**
   * SSE / orchestrator: chat may only react if the user was already engaged with chat.
   * Does not call focus(); DDEBubbleChat calls tryFocusChatInput when waiting is true.
   */
  notifyOrchestratorWaitingForInput(): void {
    this.touchInteraction();
  }

  getSnapshot(): {
    activeSurface: FlowFocusSurface;
    isEditorOpen: boolean;
    isCanvasActive: boolean;
    isChatActive: boolean;
    isFlowRemounting: boolean;
    lastUserInteractionTs: number;
  } {
    return {
      activeSurface: this.activeSurface,
      isEditorOpen: this.isEditorOpen,
      isCanvasActive: this.isCanvasActive,
      isChatActive: this.isChatActive,
      isFlowRemounting: this.isFlowRemounting,
      lastUserInteractionTs: this.lastUserInteractionTs,
    };
  }

  shouldChatAutoFocus(): boolean {
    if (this.replayActive) return false;
    if (this.isEditorOpen) return false;
    if (this.isFlowRemounting) return false;
    if (this.chatSuspendDepth > 0) return false;
    if (this.isCanvasActive && this.activeSurface === 'canvas') return false;
    if (!this.isChatActive) return false;
    if (Date.now() - this.lastNonChatPointerTs < COOLDOWN_AFTER_OUTSIDE_MS) return false;
    return true;
  }

  /**
   * The only allowed path for programmatic focus on the flow chat input.
   * No retry loop. Returns true if focus was applied.
   */
  tryFocusChatInput(el: HTMLInputElement | null): boolean {
    if (!el || el.disabled) return false;
    if (!this.shouldChatAutoFocus()) return false;
    try {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch {
      return false;
    }
    return document.activeElement === el;
  }
}

let singleton: FlowFocusManager | null = null;

export function getFlowFocusManager(): FlowFocusManager {
  if (!singleton) {
    singleton = new FlowFocusManager();
  }
  return singleton;
}

export function resetFlowFocusManagerForTests(): void {
  singleton = null;
}
