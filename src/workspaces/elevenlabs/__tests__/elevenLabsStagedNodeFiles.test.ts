import { describe, expect, it } from 'vitest';
import {
  filesToStaged,
  formatStagedFileSize,
  stagedNodeFilesKey,
} from '../elevenLabsStagedNodeFiles';

describe('elevenLabsStagedNodeFiles', () => {
  it('stagedNodeFilesKey isolates agent, node, and kind', () => {
    const kb = stagedNodeFilesKey('agent-a', 'node-1', 'kb');
    const tools = stagedNodeFilesKey('agent-a', 'node-1', 'tools');
    const otherNode = stagedNodeFilesKey('agent-a', 'node-2', 'kb');
    expect(kb).not.toBe(tools);
    expect(kb).not.toBe(otherNode);
  });

  it('filesToStaged preserves file metadata', () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const [staged] = filesToStaged([file]);
    expect(staged.name).toBe('notes.txt');
    expect(staged.size).toBe(file.size);
    expect(staged.mimeType).toBe('text/plain');
    expect(staged.file).toBe(file);
    expect(staged.id.length).toBeGreaterThan(0);
  });

  it('formatStagedFileSize uses human units', () => {
    expect(formatStagedFileSize(500)).toBe('500 B');
    expect(formatStagedFileSize(2048)).toBe('2.0 KB');
    expect(formatStagedFileSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
