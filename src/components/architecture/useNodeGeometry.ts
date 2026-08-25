import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface NodeBox {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export interface Geometry {
  boxes: Record<string, NodeBox>;
  width: number;
  height: number;
}

/**
 * Walks the offsetParent chain to find an element's position inside the
 * container.
 *
 * `offsetLeft`/`offsetTop` are used rather than `getBoundingClientRect()`
 * because they ignore CSS transforms. The nodes in this map carry a magnetic
 * pull and a hover lift, and measuring their live rects would feed those
 * transforms into the connection endpoints - lines would twitch away from
 * their own node every time the pointer moved near it. Offsets give the
 * layout position, which is what a connection should attach to.
 */
function offsetWithin(el: HTMLElement, container: HTMLElement): NodeBox {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== container) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

/**
 * Measures every registered node's box relative to the container, so an
 * overlay can draw connections between them.
 *
 * The overlay this feeds is absolutely positioned and `pointer-events-none`,
 * so nothing here can affect layout: if measurement is late, wrong, or never
 * runs at all, the diagram still lays out correctly and only the decorative
 * lines are missing. That separation is deliberate - the structure must not
 * depend on the animation layer.
 */
export function useNodeGeometry(dependency: unknown) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLElement | null>>({});
  const [geometry, setGeometry] = useState<Geometry>({ boxes: {}, width: 0, height: 0 });

  const register = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      nodeRefs.current[id] = el;
    },
    [],
  );

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container || !container.offsetWidth) return;
    const boxes: Record<string, NodeBox> = {};
    for (const [id, el] of Object.entries(nodeRefs.current)) {
      if (el && el.offsetWidth) boxes[id] = offsetWithin(el, container);
    }
    setGeometry({ boxes, width: container.offsetWidth, height: container.offsetHeight });
  }, []);

  useLayoutEffect(measure, [measure, dependency]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // A ResizeObserver on the container catches viewport changes and any
    // reflow the expanding integration panel causes, which a window resize
    // listener alone would miss.
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    // Web fonts landing after first paint change every node's width.
    document.fonts?.ready.then(measure).catch(() => {});
    return () => observer.disconnect();
  }, [measure]);

  return { containerRef, register, geometry, measure };
}
