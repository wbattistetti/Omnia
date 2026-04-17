import { describe, it, expect, beforeEach } from 'vitest';
import { FlowFocusManager, resetFlowFocusManagerForTests } from '../FlowFocusManager';

describe('FlowFocusManager', () => {
  beforeEach(() => {
    resetFlowFocusManagerForTests();
  });

  it('shouldChatAutoFocus is false when editor is open', () => {
    const m = new FlowFocusManager();
    m.requestFocus('chat');
    m.requestFocus('editor');
    expect(m.shouldChatAutoFocus()).toBe(false);
  });

  it('shouldChatAutoFocus is false when canvas is active', () => {
    const m = new FlowFocusManager();
    m.requestFocus('canvas');
    expect(m.shouldChatAutoFocus()).toBe(false);
  });

  it('shouldChatAutoFocus is false until user engaged chat', () => {
    const m = new FlowFocusManager();
    expect(m.shouldChatAutoFocus()).toBe(false);
    m.requestFocus('chat');
    expect(m.shouldChatAutoFocus()).toBe(true);
  });

  it('notifyPointerDownOutsideChatRoot clears chat engagement', () => {
    const m = new FlowFocusManager();
    m.requestFocus('chat');
    m.notifyPointerDownOutsideChatRoot();
    expect(m.getSnapshot().isChatActive).toBe(false);
    expect(m.shouldChatAutoFocus()).toBe(false);
  });

  it('suspend / resume blocks chat auto-focus', () => {
    const m = new FlowFocusManager();
    m.requestFocus('chat');
    m.suspendFocus('chat');
    expect(m.shouldChatAutoFocus()).toBe(false);
    m.resumeFocus('chat');
    expect(m.shouldChatAutoFocus()).toBe(true);
  });

  it('replay blocks chat auto-focus', () => {
    const m = new FlowFocusManager();
    m.requestFocus('chat');
    m.setReplayActive(true);
    expect(m.shouldChatAutoFocus()).toBe(false);
    m.setReplayActive(false);
    expect(m.shouldChatAutoFocus()).toBe(true);
  });

  it('remounting blocks chat auto-focus', () => {
    const m = new FlowFocusManager();
    m.requestFocus('chat');
    m.setFlowRemounting(true);
    expect(m.shouldChatAutoFocus()).toBe(false);
    m.setFlowRemounting(false);
    expect(m.shouldChatAutoFocus()).toBe(true);
  });

  it('releaseFocus(editor) restores ability to focus chat', () => {
    const m = new FlowFocusManager();
    m.requestFocus('editor');
    expect(m.shouldChatAutoFocus()).toBe(false);
    m.releaseFocus('editor');
    m.requestFocus('chat');
    expect(m.shouldChatAutoFocus()).toBe(true);
  });
});
