import * as React from 'react';

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function usePanelZoom<T extends HTMLElement>(targetRef?: React.RefObject<T>) {
	const localRef = React.useRef<T | null>(null);
	const ref = (targetRef as React.RefObject<T>) || localRef;
	const [zoom, setZoom] = React.useState<number>(1);

	React.useEffect(() => {
		const el = ref.current as HTMLElement | null;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			if (e.ctrlKey) {
				e.preventDefault();
				setZoom(prev => clamp(prev * (e.deltaY < 0 ? 1.1 : 0.9), 0.5, 2.5));
			}
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => {
			el.removeEventListener('wheel', onWheel as EventListener);
		};
		// It's fine to depend on ref.current implicitly; effect runs after mount when ref is set
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ref]);

	const resetZoom = React.useCallback(() => setZoom(1), []);

	const zoomStyle = React.useMemo(() => ({ zoom: zoom as unknown as string }), [zoom]);

	return { ref, zoom, setZoom, resetZoom, zoomStyle } as const;
}

export default usePanelZoom;


