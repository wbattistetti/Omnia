# ScrollableFlow Component

A production-ready, enterprise-grade React component that provides scrollable React Flow with pan support.

## Features

- ✅ **Scrollable wrapper** with custom scrollbars
- ✅ **Pan support** for dragging the view
- ✅ **Automatic bounds calculation** based on node positions
- ✅ **Configurable padding** and minimum dimensions
- ✅ **TypeScript support** with full type safety
- ✅ **Customizable controls** and minimap
- ✅ **Responsive design** with mobile support
- ✅ **Dark mode support**
- ✅ **High contrast mode** accessibility
- ✅ **Enterprise-ready** with proper error handling

## Usage

### Basic Usage

```tsx
import { ScrollableFlow } from '../components/ScrollableFlow';
import { useNodes, useEdges } from 'reactflow';

const MyFlowComponent = () => {
  const nodes = useNodes();
  const edges = useEdges();

  return (
    <div className="h-full w-full">
      <ScrollableFlow
        nodes={nodes}
        edges={edges}
      />
    </div>
  );
};
```

### Advanced Usage

```tsx
import { ScrollableFlow } from '../components/ScrollableFlow';

const AdvancedFlowComponent = () => {
  const nodes = useNodes();
  const edges = useEdges();

  const handlePanningChange = (isPanning: boolean) => {
    console.log('Panning state:', isPanning);
  };

  const handleFitView = () => {
    console.log('View fitted to content');
  };

  const customControls = (
    <div className="custom-controls">
      <button onClick={handleCustomAction}>Custom Action</button>
    </div>
  );

  return (
    <ScrollableFlow
      nodes={nodes}
      edges={edges}
      options={{
        padding: 500,
        minWidth: 1500,
        minHeight: 1000,
        autoCenter: true,
      }}
      className="my-flow"
      wrapperClassName="my-flow-wrapper"
      showControls={true}
      showMinimap={false}
      controls={customControls}
      onPanningChange={handlePanningChange}
      onFitView={handleFitView}
      minZoom={0.1}
      maxZoom={3}
    />
  );
};
```

## Props

### ScrollableFlowProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `nodes` | `Node[]` | - | Array of React Flow nodes |
| `edges` | `Edge[]` | - | Array of React Flow edges |
| `options` | `UseScrollableFlowOptions` | `{}` | Configuration options |
| `className` | `string` | `''` | CSS class for React Flow container |
| `wrapperClassName` | `string` | `''` | CSS class for wrapper container |
| `showControls` | `boolean` | `true` | Whether to show default controls |
| `showMinimap` | `boolean` | `false` | Whether to show minimap |
| `controls` | `React.ReactNode` | - | Custom controls component |
| `onPanningChange` | `(isPanning: boolean) => void` | - | Callback for panning state changes |
| `onFitView` | `() => void` | - | Callback when view is fitted |

### UseScrollableFlowOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `padding` | `number` | `400` | Padding around content in pixels |
| `minWidth` | `number` | `1200` | Minimum width for spacer element |
| `minHeight` | `number` | `800` | Minimum height for spacer element |
| `autoCenter` | `boolean` | `true` | Whether to auto-center on mount |
| `recalculateOnNodeChange` | `boolean` | `true` | Whether to recalculate on node changes |

## Styling

The component includes comprehensive CSS with:

- **Custom scrollbars** for webkit browsers
- **Dark mode support** via `prefers-color-scheme`
- **High contrast mode** support via `prefers-contrast`
- **Responsive design** for mobile devices
- **Smooth transitions** and hover effects

### CSS Classes

- `.scrollable-flow-wrapper` - Main wrapper container
- `.scrollable-flow-spacer` - Spacer element for scrollable area
- `.scrollable-flow-container` - React Flow container
- `.scrollable-flow` - React Flow component
- `.scrollable-flow-controls` - Controls container
- `.scrollable-flow-minimap` - Minimap container

## Architecture

The component is built with enterprise-grade architecture:

- **Separation of concerns** - Logic in hook, UI in component
- **Reusability** - Hook and component can be used independently
- **Testability** - Each part can be tested in isolation
- **Maintainability** - Modular code with clear responsibilities
- **Performance** - Memoization and optimized callbacks
- **Accessibility** - Proper event handling and ARIA support

## Testing

Run the test suite:

```bash
npm test -- ScrollableFlow.test.tsx
```

The component includes comprehensive tests for:
- Rendering and props
- Event handling
- State management
- Edge cases
- Accessibility

## Dependencies

- React 18+
- React Flow 11+
- TypeScript 4.5+

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

MIT License - see LICENSE file for details.
