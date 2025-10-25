// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { renderHook, act } from '@testing-library/react';
import { useScrollableFlow } from '../useScrollableFlow';
import { Node } from 'reactflow';

// Mock getNodesBounds
jest.mock('reactflow', () => ({
    ...jest.requireActual('reactflow'),
    getNodesBounds: jest.fn(),
}));

import { getNodesBounds } from 'reactflow';

const mockGetNodesBounds = getNodesBounds as jest.MockedFunction<typeof getNodesBounds>;

describe('useScrollableFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockNodes: Node[] = [
        {
            id: '1',
            type: 'default',
            position: { x: 100, y: 100 },
            data: { label: 'Node 1' },
        },
        {
            id: '2',
            type: 'default',
            position: { x: 300, y: 200 },
            data: { label: 'Node 2' },
        },
    ];

    it('should return default values when no nodes provided', () => {
        mockGetNodesBounds.mockReturnValue({
            x: 0,
            y: 0,
            width: 0,
            height: 0,
        });

        const { result } = renderHook(() => useScrollableFlow([]));

        expect(result.current.spacerSize).toEqual({
            width: 1200,
            height: 800,
        });
        expect(result.current.isPanning).toBe(false);
        expect(result.current.wrapperRef.current).toBeNull();
    });

    it('should calculate spacer size based on node bounds', () => {
        mockGetNodesBounds.mockReturnValue({
            x: 100,
            y: 100,
            width: 200,
            height: 100,
        });

        const { result } = renderHook(() => useScrollableFlow(mockNodes));

        expect(result.current.spacerSize).toEqual({
            width: 1000, // 200 + 400*2 padding
            height: 900, // 100 + 400*2 padding
        });
    });

    it('should respect minimum dimensions', () => {
        mockGetNodesBounds.mockReturnValue({
            x: 0,
            y: 0,
            width: 50,
            height: 30,
        });

        const { result } = renderHook(() =>
            useScrollableFlow(mockNodes, { minWidth: 1500, minHeight: 1000 })
        );

        expect(result.current.spacerSize).toEqual({
            width: 1500, // minWidth
            height: 1000, // minHeight
        });
    });

    it('should handle panning state', () => {
        const { result } = renderHook(() => useScrollableFlow(mockNodes));

        expect(result.current.isPanning).toBe(false);

        act(() => {
            result.current.setIsPanning(true);
        });

        expect(result.current.isPanning).toBe(true);
    });

    it('should provide utility functions', () => {
        const { result } = renderHook(() => useScrollableFlow(mockNodes));

        expect(typeof result.current.handleFitView).toBe('function');
        expect(typeof result.current.scrollToPosition).toBe('function');
        expect(typeof result.current.getScrollPosition).toBe('function');
    });

    it('should handle getNodesBounds errors gracefully', () => {
        mockGetNodesBounds.mockImplementation(() => {
            throw new Error('Bounds calculation failed');
        });

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        const { result } = renderHook(() => useScrollableFlow(mockNodes));

        expect(result.current.spacerSize).toEqual({
            width: 1200,
            height: 800,
        });
        expect(consoleSpy).toHaveBeenCalledWith(
            'Error calculating node bounds:',
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });
});
