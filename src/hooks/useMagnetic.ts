import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useReducedMotion, useSpring, useTransform, useVelocity } from "framer-motion";

interface UseMagneticOptions {
  /** Peak offset in px at the element's edge. */
  strength?: number;
  /** Neutralizes the pull and springs back to rest while true. */
  disabled?: boolean;
  /** Adds the liquid squash-and-stretch (see below). */
  squash?: boolean;
}

/** Velocity (px/s) of the magnetic offset that produces the maximum deform. */
const VELOCITY_FOR_MAX_STRETCH = 900;
const MAX_STRETCH = 0.06;
const PULL_SPRING = { stiffness: 220, damping: 18, mass: 0.4 } as const;
const STRETCH_SPRING = { stiffness: 300, damping: 26, mass: 0.5 } as const;

/**
 * The site's single magnetic interaction: an element drifts subtly toward the
 * cursor while the cursor is over it, and springs back when it leaves.
 * Desktop and fine-pointer only, inert under reduced motion.
 *
 * Exposed as a hook rather than only as the `Magnetic` wrapper because
 * several surfaces that want it are already motion elements with their own
 * enter/exit animations — wrapping those in another element would break the
 * `AnimatePresence` tracking around them. `Magnetic` is a thin wrapper over
 * this hook, so there is exactly one pointer calculation and one spring
 * config behind every magnetic surface in the portfolio.
 *
 * `squash` derives deformation from the *velocity of the magnetic offset
 * itself*, the same way `LiquidIndicator` derives its stretch from its own
 * travel velocity: the element elongates along the direction it is being
 * pulled and thins across it. Because it comes from that velocity, an element
 * deforms only while actually being drawn toward or released from the cursor,
 * and is perfectly still the rest of the time — nothing animates at idle.
 *
 * Only the element under the pointer ever responds: the maths runs off that
 * element's own `mousemove`, so its neighbours are never told the cursor
 * moved and cannot drift in sympathy.
 */
export function useMagnetic({ strength = 14, disabled = false, squash = false }: UseMagneticOptions = {}) {
  const ref = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  // Measured once when the pointer arrives rather than on every move. This
  // also stops the pull feeding back into its own measurement — a live rect
  // includes the offset already applied, which made the target drift.
  const rectRef = useRef<DOMRect | null>(null);

  const x = useSpring(0, PULL_SPRING);
  const y = useSpring(0, PULL_SPRING);

  const toStretch = (v: number) =>
    squash && !reduceMotion ? Math.min(Math.abs(v) / VELOCITY_FOR_MAX_STRETCH, 1) * MAX_STRETCH : 0;
  const stretchX = useSpring(useTransform(useVelocity(x), toStretch), STRETCH_SPRING);
  const stretchY = useSpring(useTransform(useVelocity(y), toStretch), STRETCH_SPRING);
  const scaleX = useTransform([stretchX, stretchY], ([sx, sy]: number[]) => 1 + sx - sy * 0.6);
  const scaleY = useTransform([stretchX, stretchY], ([sx, sy]: number[]) => 1 + sy - sx * 0.6);

  useEffect(() => {
    setEnabled(!reduceMotion && window.matchMedia("(pointer: fine)").matches);
  }, [reduceMotion]);

  useEffect(() => {
    if (!disabled) return;
    x.set(0);
    y.set(0);
  }, [disabled, x, y]);

  useEffect(() => {
    // Scrolling or resizing moves the box out from under a cached rect.
    function invalidate() {
      rectRef.current = null;
    }
    window.addEventListener("scroll", invalidate, { passive: true });
    window.addEventListener("resize", invalidate);
    return () => {
      window.removeEventListener("scroll", invalidate);
      window.removeEventListener("resize", invalidate);
    };
  }, []);

  function onMouseMove(event: MouseEvent<Element>) {
    if (!enabled || disabled || !ref.current) return;
    const rect = (rectRef.current ??= ref.current.getBoundingClientRect());
    if (!rect.width || !rect.height) return;
    const relX = event.clientX - (rect.left + rect.width / 2);
    const relY = event.clientY - (rect.top + rect.height / 2);
    x.set((relX / (rect.width / 2)) * strength);
    y.set((relY / (rect.height / 2)) * strength);
  }

  function onMouseLeave() {
    rectRef.current = null;
    x.set(0);
    y.set(0);
  }

  const style = !enabled ? undefined : squash ? { x, y, scaleX, scaleY } : { x, y };

  /** Attach the element. Callers that also need their own ref can call this
   * alongside it, rather than writing into the hook's ref from outside. */
  function attach(el: HTMLElement | null) {
    ref.current = el;
  }

  return { ref, attach, onMouseMove, onMouseLeave, style };
}
