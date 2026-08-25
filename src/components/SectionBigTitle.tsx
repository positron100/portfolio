import { useLayoutEffect, useRef, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
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
 * One shared, batched measurement pass for every `SectionBigTitle` on the page.
 *
 * Seven of these mount in the same React commit, and each one used to read
 * `offsetWidth` in its own `useLayoutEffect`. Because React interleaves DOM
 * mutation with those effects, every read landed on a freshly invalidated
 * document and forced its own full layout — **seven forced layouts on a cold
 * load, measured at 896ms of forced reflow at 390x844 / 4x CPU, the single
 * largest contributor in the load trace.**
 *
 * The fix is read/write separation across the whole set rather than per
 * component: every instance registers here, one pass reads all of them back
 * to back (only the first read pays for a layout, the rest are free because
 * nothing mutates in between), and only then does it write. One forced
 * layout instead of seven.
 *
 * The pass is scheduled with `queueMicrotask` from inside the layout-effect
 * phase, which is what keeps it correct: microtasks drain when the commit's
 * JS stack unwinds, so the pass still runs **before the browser paints**.
 * That is the guarantee `useLayoutEffect` was there for, and it is preserved
 * — this is deliberately not a move to `useEffect`, which would run after
 * paint and could show a heading at the wrong scale.
 */
interface TitleMeasurement {
  heading: HTMLElement;
  container: HTMLElement;
  entryScale: MotionValue<number>;
}

const measurementTargets = new Set<TitleMeasurement>();
let measurementQueued = false;

function flushMeasurements() {
  measurementQueued = false;
  // Read phase — every geometry read happens before any write, so the whole
  // set costs one layout.
  const results: Array<[MotionValue<number>, number]> = [];
  for (const { heading, container, entryScale } of measurementTargets) {
    const width = heading.offsetWidth;
    if (!width) continue;
    const fits = container.clientWidth / width;
    results.push([entryScale, Math.max(1, Math.min(ENTRY_SCALE, fits))]);
  }
  // Write phase. These are motion values, not React state: writing one costs
  // no render pass at all, where `setEntryScale` used to schedule seven.
  // A transform also cannot change `offsetWidth`, so writing here can never
  // feed back into the ResizeObserver below.
  for (const [entryScale, value] of results) {
    if (entryScale.get() !== value) entryScale.set(value);
  }
}

function scheduleMeasurement() {
  if (measurementQueued) return;
  measurementQueued = true;
  queueMicrotask(flushMeasurements);
}

/**
 * One observer for every heading and container on the page.
 *
 * This replaces two things that were previously per-instance: a `resize`
 * listener each, and a `document.fonts.ready.then(measure)` each — seven
 * independent handlers that fired a second seven-way forced-layout storm the
 * moment the web font landed. A `ResizeObserver` on the heading covers both
 * causes at once, because the shrink-wrapped heading's own box is what
 * actually changes when either the font swaps or the column resizes, and it
 * reports off the critical path instead of on it.
 */
const geometryObserver =
  typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleMeasurement);

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
  const entryScale = useMotionValue(1);

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
  useLayoutEffect(() => {
    const heading = headingRef.current;
    const container = introRef.current;
    // Nothing is scaled under reduced motion, so there is nothing to measure.
    if (!heading || !container || reduceMotion) return;

    const target: TitleMeasurement = { heading, container, entryScale };
    measurementTargets.add(target);
    // Registering during the layout-effect phase and flushing in a microtask
    // is what batches all seven into one pass while still landing before
    // paint. See `flushMeasurements`.
    scheduleMeasurement();
    geometryObserver?.observe(heading);
    geometryObserver?.observe(container);

    return () => {
      measurementTargets.delete(target);
      geometryObserver?.unobserve(heading);
      geometryObserver?.unobserve(container);
    };
  }, [bigWord, size, reduceMotion, entryScale]);

  // Reads `entryScale` as a motion value rather than a rendered prop, so a
  // new measurement retargets the scale without a React render.
  const titleScale = useTransform([scrollYProgress, entryScale], ([progress, scale]: number[]) =>
    scale + (1 - scale) * progress,
  );
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
