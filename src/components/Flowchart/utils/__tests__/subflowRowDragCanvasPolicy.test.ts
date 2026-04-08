import { describe, expect, it } from 'vitest';
import { TaskType } from '@types/taskTypes';
import { shouldCancelSubflowTaskDropOnForeignCanvas } from '../subflowRowDragCanvasPolicy';

describe('shouldCancelSubflowTaskDropOnForeignCanvas', () => {
    it('cancels Subflow task when drop canvas differs from origin', () => {
        expect(
            shouldCancelSubflowTaskDropOnForeignCanvas(TaskType.Subflow, 'main', 'subflow_abc')
        ).toBe(true);
    });

    it('allows Subflow task when canvases match', () => {
        expect(shouldCancelSubflowTaskDropOnForeignCanvas(TaskType.Subflow, 'main', 'main')).toBe(false);
        expect(
            shouldCancelSubflowTaskDropOnForeignCanvas(TaskType.Subflow, 'subflow_x', 'subflow_x')
        ).toBe(false);
    });

    it('allows non-Subflow tasks across canvases', () => {
        expect(
            shouldCancelSubflowTaskDropOnForeignCanvas(TaskType.SayMessage, 'main', 'subflow_abc')
        ).toBe(false);
    });

    it('does not cancel when drop canvas is unknown', () => {
        expect(shouldCancelSubflowTaskDropOnForeignCanvas(TaskType.Subflow, 'main', null)).toBe(false);
    });
});
