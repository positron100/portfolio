import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, useVelocity } from "framer-motion";
import { cn } from "@/utils/cn";

interface LiquidIndicatorProps {
  /** Positioning context. Must be `relative`. */
  containerRef: RefObject<HTMLElement | null>;
  /** Resolves the item the indicator should sit behind. Called at effect
   * time rather than read during render, so it sees callback refs that were
   * only attached during the same commit. */
  getTarget: () => HTMLElement | null;
  /**
   * Which axis the items run along, which is the axis it stretches on.
   * `"auto"` derives the deformation from both axes at once — needed by
   * wrapping rows (skill tags, filter chips), where moving to the next line
   * is mostly a vertical journey and stretching sideways for it would look
   * plainly wrong.
   */
  orientation?: "horizontal" | "vertical" | "auto";
  className?: string;
  /** Re-measure whenever this changes (the active id, typically). */
  dependency: unknown;
  /**
   * While true the indicator re-measures every frame instead of only when
   * `dependency` changes, so a gesture can drive it continuously. Used by
   * the navbar's drag-to-navigate: the pointer supplies a free x/width each
   * frame and the existing springs turn that into the same liquid travel and
   * deformation a click produces.
   */
  live?: boolean;
  /**
   * Consulted on each measurement. Whichever axis it supplies overrides the
   * measured value; the other axis still comes from the real item, so a
   * dragged indicator keeps the row's (or column's) own geometry.
   *
   * A horizontal drag supplies `x`/`width`, a vertical one `y`/`height` —
   * the navbar uses the first, the mobile menu the second.
   */
  getOverride?: () => Partial<{ x: number; width: number; y: number; height: number }> | null;
}

/** Softer than `spring.indicator` on purpose: this one is allowed a little
 * overshoot so the travel reads as a droplet settling rather than a box
 * sliding. Still nowhere near bouncy. */
const TRAVEL_SPRING = { stiffness: 320, damping: 30, mass: 0.9 } as const;
const SIZE_SPRING = { stiffness: 380, damping: 34, mass: 0.8 } as const;
/** Velocity (px/s) that produces the maximum stretch. */
const VELOCITY_FOR_MAX_STRETCH = 2600;
const MAX_STRETCH = 0.3;
const STRETCH_SPRING = { stiffness: 260, damping: 26, mass: 0.6 } as const;
/** Frames to wait for a not-yet-attached target before giving up. */
const MAX_MEASURE_RETRIES = 3;

/**
 * A shared active-state marker: one element that never unmounts, moves
 * between items on springs, and deforms in the direction it's travelling.
 * Used by the navbar, the skill category tabs, the skill tags and the
 * project filters, so every selector in the site shares one motion language.
 *
 * This replaces a `layoutId` shared-layout pill. `layoutId` moves an element
 * between parents smoothly but can only ever interpolate a rectangle — there
 * is no point during the move where it can be told to stretch. Owning the
 * geometry here means the travel can carry squash-and-stretch derived from
 * the indicator's *own* spring velocity: it thins and elongates as it leaves,
 * and compresses back as it settles. Longer jumps build more velocity and so
 * deform more, which is what makes a jump across the whole bar read
 * differently from a nudge to the next item.
 *
 * Idle cost is nothing. Framer stops driving a spring once it settles, and
 * every value here derives from those springs, so a resting navbar runs no
 * animation loop at all.
 */
export function LiquidIndicator({
  containerRef,
  getTarget,
  orientation = "horizontal",
  className,
  dependency,
  live = false,
  getOverride,
}: LiquidIndicatorProps) {
  const reduceMotion = useReducedMotion();
  const measuredRef = useRef(false);
  // Held in a ref so an inline arrow from the caller does not invalidate
  // `measure` (and re-run the layout effect) on every single render.
  const getTargetRef = useRef(getTarget);
  getTargetRef.current = getTarget;
  const getOverrideRef = useRef(getOverride);
  getOverrideRef.current = getOverride;
  const retriesRef = useRef(0);
  const retryFrameRef = useRef<number | null>(null);

  const x = useSpring(0, TRAVEL_SPRING);
  const y = useSpring(0, TRAVEL_SPRING);
  const width = useSpring(0, SIZE_SPRING);
  const height = useSpring(0, SIZE_SPRING);
  const opacity = useMotionValue(0);

  // Deformation is read off each axis independently, so travel in any
  // direction elongates along its own path and thins across it.
  const usesX = orientation !== "vertical";
  const usesY = orientation !== "horizontal";
  const toStretch = (v: number, enabled: boolean) =>
    reduceMotion || !enabled ? 0 : Math.min(Math.abs(v) / VELOCITY_FOR_MAX_STRETCH, 1) * MAX_STRETCH;

  const velocityX = useVelocity(x);
  const velocityY = useVelocity(y);
  // Smoothed so the deformation eases in and out instead of tracking raw
  // velocity noise frame to frame.
  const stretchX = useSpring(
    useTransform(velocityX, (v) => toStretch(v, usesX)),
    STRETCH_SPRING,
  );
  const stretchY = useSpring(
    useTransform(velocityY, (v) => toStretch(v, usesY)),
    STRETCH_SPRING,
  );
  const scaleX = useTransform([stretchX, stretchY], ([sx, sy]: number[]) => 1 + sx - sy * 0.55);
  const scaleY = useTransform([stretchX, stretchY], ([sx, sy]: number[]) => 1 + sy - sx * 0.55);

  const measure = useCallback(() => {
    const target = getTargetRef.current();
    const container = containerRef.current;
    if (!target || !container) {
      // Not necessarily gone — a list whose items are all replaced at once
      // (the skill tags, when the category changes) can measure in the gap
      // before the incoming element has registered its ref. Give it a frame
      // before concluding there is nothing to point at, otherwise the
      // indicator hides itself and never comes back, since only a later
      // dependency change would measure again.
      if (retriesRef.current < MAX_MEASURE_RETRIES) {
        retriesRef.current += 1;
        cancelAnimationFrame(retryFrameRef.current ?? 0);
        retryFrameRef.current = requestAnimationFrame(() => measure());
        return;
      }
      opacity.set(0);
      return;
    }
    retriesRef.current = 0;

    // `offset*` rather than `getBoundingClientRect()`: every item is wrapped
    // in a magnetic pull, and a rect read would fold that live transform into
    // the measurement, leaving the indicator parked a few pixels off whichever
    // item happened to be under the cursor when it was measured. Offsets are
    // layout values, so transforms cannot reach them.
    //
    // They are relative to the nearest *positioned* ancestor, which is not
    // necessarily the container — a magnetic wrapper in between can be
    // positioned too — so walk up the offsetParent chain and accumulate.
    // The rect path stays as a fallback for anything this can't resolve.
    let next: { x: number; y: number; w: number; h: number } | null = null;
    let offsetX = 0;
    let offsetY = 0;
    let node: HTMLElement | null = target;
    while (node && node !== container) {
      offsetX += node.offsetLeft;
      offsetY += node.offsetTop;
      const parent = node.offsetParent as HTMLElement | null;
      if (!parent) break;
      if (parent === container) {
        next = { x: offsetX, y: offsetY, w: target.offsetWidth, h: target.offsetHeight };
        break;
      }
      node = parent;
    }
    if (!next) {
      const t = target.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      next = { x: t.left - c.left, y: t.top - c.top, w: t.width, h: t.height };
    }
    // A gesture may be driving one axis directly; the item still supplies the
    // other, so a dragged indicator keeps the row's height or the column's
    // width rather than having to reproduce it.
    const override = getOverrideRef.current?.();
    if (override) {
      next = {
        x: override.x ?? next.x,
        y: override.y ?? next.y,
        w: override.width ?? next.w,
        h: override.height ?? next.h,
      };
    }

    if (!next.w || !next.h) return;
    // The first placement must not fly in from the origin — jump straight
    // there, then animate every subsequent move.
    if (!measuredRef.current || reduceMotion) {
      measuredRef.current = true;
      x.jump(next.x);
      y.jump(next.y);
      width.jump(next.w);
      height.jump(next.h);
    } else {
      x.set(next.x);
      y.set(next.y);
      width.set(next.w);
      height.set(next.h);
    }
    opacity.set(1);
  }, [containerRef, reduceMotion, x, y, width, height, opacity]);

  useLayoutEffect(() => {
    retriesRef.current = 0;
    measure();
  }, [measure, dependency]);

  useEffect(() => () => cancelAnimationFrame(retryFrameRef.current ?? 0), []);

  // One frame loop, alive only for the duration of a gesture. Outside a
  // gesture nothing here runs and the springs sit idle, exactly as before.
  useEffect(() => {
    if (!live) return;
    let frame = requestAnimationFrame(function tick() {
      measure();
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [live, measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    // Web fonts landing after first paint change every item's width.
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <motion.span
      aria-hidden="true"
      style={{ x, y, width, height, opacity, scaleX, scaleY }}
      // No radius here: `cn` is a plain join, not tailwind-merge, so a base
      // radius would sit in the class list alongside whatever a caller passes
      // and the winner would come down to Tailwind's own rule order. Each
      // call site states its own.
      className={cn("pointer-events-none absolute top-0 left-0", className)}
    />
  );
}
