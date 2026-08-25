import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/utils/cn";

interface SectionBigTitleProps {
  bigWord: string;
  subtitle: string;
  description?: string;
  children?: ReactNode;
  /** "lg" raises the heading's resting size for a single theatrical
   * final-section moment (Contact) — still the one real heading. */
  size?: "default" | "lg";
}

/** How much larger the heading announces itself before settling, when the
 * section is wide enough to allow it (see the measurement below). */
const ENTRY_SCALE = 2.1;

/**
 * The one and only heading for a section.
 *
 * A single `<h2>` announces the section oversized and then shrinks — as the
 * *same element* — into its normal resting heading size and position as the
 * visitor scrolls in. There is deliberately no second heading, and no
 * eyebrow label repeating the section name above it: every call site used to
 * pass the same word as both `eyebrow` and `bigWord`, which rendered the
 * section name twice, one directly above the other. That stacked pair was
 * the "two headings" effect — not a duplicated animation. Anything below
 * this heading is plain supporting text, not another heading.
 *
 * `scale` is used rather than an animated font-size so the settle never
 * reflows the page, and the transform is anchored bottom-left so all the
 * extra size grows *upward* into the section's own top padding — never
 * downward into the supporting text sitting right below at its normal
 * position.
 */
export function SectionBigTitle({
  bigWord,
  subtitle,
  description,
  children,
  size = "default",
}: SectionBigTitleProps) {
  const introRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reduceMotion = useReducedMotion();
  const [entryScale, setEntryScale] = useState(1);

  const { scrollYProgress } = useScroll({
    target: introRef,
    offset: ["start 0.9", "start 0.35"],
  });

  // Scaling a shrink-wrapped heading from its left edge pushes its right
  // edge out by `(scale - 1) × word width`, so a fixed entry scale either
  // overflows narrow viewports or wastes the room on wide ones. Measure the
  // word against the space it actually has and take the largest entry scale
  // that still fits. `offsetWidth` is used rather than
  // `getBoundingClientRect()` because it ignores the transform this very
  // component is applying — measuring the rect would feed the current scale
  // back into itself.
  const measure = useCallback(() => {
    const heading = headingRef.current;
    const container = introRef.current;
    if (!heading || !container || !heading.offsetWidth) return;
    const fits = container.clientWidth / heading.offsetWidth;
    setEntryScale(Math.max(1, Math.min(ENTRY_SCALE, fits)));
  }, []);

  useLayoutEffect(measure, [measure, bigWord, size]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    // Web fonts landing after first paint change the measured word width.
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const titleScale = useTransform(scrollYProgress, [0, 1], [entryScale, 1]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.45], [0, 1]);
  const restOpacity = useTransform(scrollYProgress, [0.45, 1], [0, 1]);
  const restY = useTransform(scrollYProgress, [0.45, 1], [20, 0]);

  return (
    <div ref={introRef} className="mb-12 max-w-2xl">
      <motion.h2
        ref={headingRef}
        style={
          reduceMotion
            ? undefined
            : {
                scale: titleScale,
                opacity: titleOpacity,
                transformOrigin: "left bottom",
                // Deliberate, and only here. This is the one element on the
                // page whose scale changes continuously while scrolling, so
                // it is the one element that benefits from being promoted to
                // its own layer up front instead of the compositor deciding
                // to promote it mid-scroll. Seven short headings is a bounded
                // cost; the same hint on the section wrappers would pin seven
                // full-page-height layers in memory, which is why it is not
                // there.
                willChange: "transform",
              }
        }
        className={cn(
          // `inline-block` (not the h2 default `block`) so the layout box
          // shrink-wraps the word instead of stretching to the container —
          // scaling a full-width block from its left edge pushes its right
          // edge off-screen regardless of how short the word is.
          //
          // `font-mono` is the same JetBrains Mono stack the Hero's "Hi, I'm
          // Mukul Negi" line uses (--font-mono in index.css), so the section
          // headings read in the site's own technical voice rather than the
          // generic Inter sans. Monospace advances are much wider than
          // Inter's, so the resting sizes step down one notch per breakpoint
          // — the rendered headings stay close to their previous optical
          // width instead of overrunning the column, and the measured entry
          // scale (above) still clamps whatever is left.
          // `text-accent` rather than the inherited body colour: the section
          // names carry the theme's accent — indigo in light, green in dark —
          // via the same token the rest of the site's accents resolve from,
          // so a palette change in index.css still moves them. The supporting
          // text below stays `text-fg-muted`, which is what keeps the accent
          // reading as a heading treatment rather than a coloured block.
          "inline-block font-mono font-semibold tracking-tight text-balance text-accent",
          size === "lg" ? "text-3xl sm:text-5xl lg:text-6xl" : "text-3xl sm:text-4xl lg:text-5xl",
        )}
      >
        {bigWord}
      </motion.h2>

      <motion.div style={reduceMotion ? undefined : { opacity: restOpacity, y: restY }}>
        <p className="mt-4 text-lg font-medium text-fg-muted sm:text-xl">{subtitle}</p>
        {description && <p className="mt-3 text-base leading-relaxed text-fg-muted">{description}</p>}
        {children}
      </motion.div>
    </div>
  );
}
