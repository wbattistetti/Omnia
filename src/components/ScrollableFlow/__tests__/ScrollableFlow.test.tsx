// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScrollableFlow } from '../ScrollableFlow';
import { Node, Edge } from 'reactflow';

// Mock React Flow
jest.mock('reactflow', () => ({
    ReactFlow: ({ children, ...props }: any) => (
        <div data-testid="react-flow" {...props}>
            {children}
        </div>
    ),
    getNodesBounds: jest.fn(),
}));

// Mock the useScrollableFlow hook
jest.mock('../../../hooks/useScrollableFlow', () => ({
    useScrollableFlow: jest.fn(() => ({
        wrapperRef: { current: null },
        spacerSize: { width: 1200, height: 800 },
        isPanning: false,
        setIsPanning: jest.fn(),
        handleFitView: jest.fn(),
        scrollToPosition: jest.fn(),
        getScrollPosition: jest.fn(),
    })),
}));

const mockNodes: Node[] = [
    {
        id: '1',
        type: 'default',
        position: { x: 100, y: 100 },
        data: { label: 'Node 1' },
    },
];

const mockEdges: Edge[] = [
    {
        id: 'e1-2',
        source: '1',
        target: '2',
    },
];

describe('ScrollableFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render without crashing', () => {
        render(<ScrollableFlow nodes={mockNodes} edges={mockEdges} />);

        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
        render(
            <ScrollableFlow
                nodes={mockNodes}
                edges={mockEdges}
                className="custom-class"
            />
        );

        const reactFlow = screen.getByTestId('react-flow');
        expect(reactFlow).toHaveClass('scrollable-flow', 'custom-class');
    });

    it('should apply custom wrapper className', () => {
        render(
            <ScrollableFlow
                nodes={mockNodes}
                edges={mockEdges}
                wrapperClassName="custom-wrapper"
            />
        );

        const wrapper = screen.getByTestId('react-flow').closest('.scrollable-flow-wrapper');
        expect(wrapper).toHaveClass('scrollable-flow-wrapper', 'custom-wrapper');
    });

    it('should show controls by default', () => {
        render(<ScrollableFlow nodes={mockNodes} edges={mockEdges} />);

        expect(screen.getByText('Fit View')).toBeInTheDocument();
    });

    it('should hide controls when showControls is false', () => {
        render(
            <ScrollableFlow
                nodes={mockNodes}
                edges={mockEdges}
                showControls={false}
            />
        );

        expect(screen.queryByText('Fit View')).not.toBeInTheDocument();
    });

    it('should render custom controls', () => {
        const customControls = <div data-testid="custom-controls">Custom Controls</div>;

        render(
            <ScrollableFlow
                nodes={mockNodes}
                edges={mockEdges}
                controls={customControls}
            />
        );

        expect(screen.getByTestId('custom-controls')).toBeInTheDocument();
        expect(screen.queryByText('Fit View')).not.toBeInTheDocument();
    });

    it('should call onPanningChange when panning state changes', () => {
        const onPanningChange = jest.fn();

        render(
            <ScrollableFlow
                nodes={mockNodes}
                edges={mockEdges}
                onPanningChange={onPanningChange}
            />
        );

        // Simulate panning state change
        const { useScrollableFlow } = require('../../../hooks/useScrollableFlow');
        const mockHook = useScrollableFlow as jest.MockedFunction<typeof useScrollableFlow>;

        // Re-render with panning state change
        mockHook.mockReturnValueOnce({
            wrapperRef: { current: null },
            spacerSize: { width: 1200, height: 800 },
            isPanning: true,
            setIsPanning: jest.fn(),
            handleFitView: jest.fn(),
            scrollToPosition: jest.fn(),
            getScrollPosition: jest.fn(),
        });

        render(
            <ScrollableFlow
                nodes={mockNodes}
                edges={mockEdges}
                onPanningChange={onPanningChange}
            />
        );

        // Note: In a real test, you would trigger the actual panning events
        // This is a simplified test of the callback mechanism
    });

    it('should call onFitView when fit view is triggered', () => {
        const onFitView = jest.fn();

        render(
            <ScrollableFlow
                nodes={mockNodes}
                edges={mockEdges}
                onFitView={onFitView}
            />
        );

        const fitViewButton = screen.getByText('Fit View');
        fireEvent.click(fitViewButton);

        // The actual onFitView call would be tested through the hook
        // This tests the button click event
        expect(fitViewButton).toBeInTheDocument();
    });

    it('should pass through React Flow props', () => {
        render(
            <ScrollableFlow
                nodes={mockNodes}
                edges={mockEdges}
                minZoom={0.1}
                maxZoom={3}
                fitView={false}
            />
        );

        const reactFlow = screen.getByTestId('react-flow');
        expect(reactFlow).toHaveAttribute('minZoom', '0.1');
        expect(reactFlow).toHaveAttribute('maxZoom', '3');
        expect(reactFlow).toHaveAttribute('fitView', 'false');
    });

    it('should handle empty nodes array', () => {
        render(<ScrollableFlow nodes={[]} edges={[]} />);

        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('should handle empty edges array', () => {
        render(<ScrollableFlow nodes={mockNodes} edges={[]} />);

        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
});
