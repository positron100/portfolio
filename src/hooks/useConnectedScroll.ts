import { useEffect, useRef, useState } from "react";
import { useScroll, useTransform, useReducedMotion } from "framer-motion";

/**
 * Drives a section's inner content so it settles in as it enters the
 * viewport and gently recedes (fades/scales down) as it's scrolled past —
 * the "previous scene makes room for the next" connective feel. Applied to
 * an inner wrapper, never the section itself, so full-bleed section
 * backgrounds/borders stay crisp (no edge gaps from a scaled container).
 */
export function useConnectedScroll(options: { recede?: boolean } = {}) {
  const { recede = true } = options;
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  // Compact viewports drop the section-level `scale`.
  //
  // This is what made the section headings stutter on a phone. Each of the
  // seven sections scales its entire content subtree on scroll, and
  // `SectionBigTitle` scales its heading *inside* that. Two nested scales
  // mean the browser re-rasterises every glyph in the section at a new
  // compound scale on every scroll frame, and text rasterisation is the most
  // expensive thing on a mobile GPU.
  //
  // Dropping only the outer scale removes the compounding while keeping the
  // fade and the vertical settle, so the connective feel between sections
  // survives and the heading keeps its own shrink-and-grow untouched. A 3%
  // section scale is the least visible part of the effect and by far the
  // most expensive.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const exitOpacity = recede ? 0.55 : 1;
  const exitScale = recede ? 0.98 : 1;
  const exitY = recede ? -20 : 0;

  // Wider blend zones (vs. a hard 12%/88% cut) so a section's settle-in and
  // recede-out overlap more with its neighbors' own motion — the boundary
  // reads as a continuous handoff rather than one scene ending before the
  // next begins.
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.78, 1], [0, 1, 1, exitOpacity]);
  const scale = useTransform(scrollYProgress, [0, 0.2, 0.78, 1], [0.97, 1, 1, exitScale]);
  const y = useTransform(scrollYProgress, [0, 0.2, 0.78, 1], [36, 0, 0, exitY]);

  return {
    sectionRef,
    style: reduceMotion ? undefined : compact ? { opacity, y } : { opacity, scale, y },
  };
}
