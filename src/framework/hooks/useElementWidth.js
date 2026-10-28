import { useCallback, useEffect, useState } from 'react';

/**
 * The content width of an element, kept current with a `ResizeObserver`
 * (OW-060). It follows the element itself, so a collapsed admin menu or a
 * capped content column changes it, unlike `window.innerWidth`.
 *
 * Use the returned ref callback as the element's `ref`. The width is 0
 * until the element is mounted and measured, and the observer is
 * disconnected when the element unmounts.
 *
 * @return {[Function, number]} The ref callback and the width in pixels.
 */
const useElementWidth = () => {
	const [element, setElement] = useState(null);
	const [width, setWidth] = useState(0);
	const ref = useCallback((node) => setElement(node), []);

	useEffect(() => {
		if (!element) {
			return undefined;
		}
		setWidth(element.clientWidth);
		if (typeof window.ResizeObserver !== 'function') {
			return undefined;
		}
		const observer = new window.ResizeObserver((entries) => {
			const box = entries[0]?.contentRect;
			if (box) {
				setWidth(Math.round(box.width));
			}
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [element]);

	return [ref, width];
};

export default useElementWidth;
