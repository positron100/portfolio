import { useCallback, useRef } from "react";
import { useMotionValue } from "framer-motion";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import type { Theme } from "@/hooks/useTheme";
import {
  startThemeReveal,
  prefersReducedMotionNow,
  supportsViewTransitions,
  type ThemeOrigin,
} from "@/utils/themeTransition";
import { viewTransition } from "@/utils/motion";

const DRAG_THRESHOLD_PX = 6;
// Physical distance for a full 0→1 drag. Deliberately larger than the
// toggle's own visual width — dragging past the control itself is normal
// for this kind of gesture, and a longer range makes progress far less
// sensitive to small pointer movements.
const DRAG_RANGE_PX = 150;
const FLICK_VELOCITY_PX_MS = 0.55;
// Time constant (ms) for the exponential smoothing between the raw pointer
// target and the value actually applied to the reveal/knob each frame —
// small enough to feel directly responsive, large enough to absorb jitter.
const SMOOTHING_TAU_MS = 40;
// Mirrors `KNOB_TRAVEL_PX` in ThemeToggle.tsx — the knob's own `x` transform
// range. Kept local rather than imported to avoid a component→hook import.
const KNOB_TRAVEL_PX = 22;

function clampUnit(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

interface Sample {
  x: number;
  t: number;
}

/**
 * Owns the theme toggle's full interaction model: a plain click/tap/keyboard
 * activation still runs the complete circular reveal exactly as before, but
 * the same button now also supports dragging — the drag distance directly
 * scrubs the reveal's progress via the Web Animations API's `currentTime`
 * (cheap, no React re-renders per pointer move), and release either plays
 * it to completion or reverses it based on progress + flick velocity.
 *
 * Raw pointer position only ever updates a *target* progress; a small
 * per-frame exponential smoothing loop is what actually drives the visible
 * reveal and knob, so the motion reads as damped, direct manipulation
 * rather than a value snapping straight to the cursor.
 *
 * `darkness` (0 = light, 1 = dark) tracks that smoothed visual progress for
 * the toggle's knob position and sun/moon icon, in sync with click, drag,
 * and release alike.
 */
export function useThemeToggleController(
  theme: Theme,
  setTheme: (theme: Theme) => void,
  /**
   * The thumb. The reveal is supposed to open from the thing the finger is
   * actually on, and on a phone that is the 24px knob, not the 56px track it
   * slides in — measuring the button put the origin up to 11px away from the
   * touch, which on a small screen is visibly off-centre. Optional: without
   * it the button is used, exactly as before.
   */
  originRef?: { current: HTMLElement | null },
) {
  const darkness = useMotionValue(theme === "dark" ? 1 : 0);

  /**
   * Measured fresh at the start of every gesture, never cached and never
   * stored between them. Returns a viewport-relative point — the same space
   * the reveal's `clip-path` circle is resolved in.
   *
   * It must NOT use `getBoundingClientRect` on the knob directly. On mobile
   * the toggle lives inside the nav menu panel, which is still running its
   * open spring (an under-damped `scaleY` overshoot, plus the menu item's own
   * `y`/`scale`) for ~400ms after it opens. `getBoundingClientRect` folds
   * every ancestor transform into its result, so a tap during that window
   * measured a distorted point and the reveal opened from the wrong place —
   * which is exactly why the origin was correct on desktop (toggle has no
   * animated ancestor) and inconsistent on mobile.
   *
   * `offsetLeft`/`offsetTop` are layout values that transforms never touch
   * (the same property `LiquidIndicator` relies on for the same reason), so
   * the knob's untransformed box is summed up the `offsetParent` chain and
   * anchored to the `<header>`'s rect — the header is `position: fixed` and
   * never transformed, so its rect is reliable at any scroll offset. The
   * knob's own live `x` transform is added back explicitly (offset* omits
   * it), preserving "a part-way drag opens from where the thumb actually is".
   */
  function measureOrigin(fallback: HTMLElement): ThemeOrigin {
    const el = originRef?.current ?? fallback;
    const header = el.closest("header");
    if (!header) {
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    let ox = 0;
    let oy = 0;
    let node: HTMLElement | null = el;
    while (node && node !== header) {
      ox += node.offsetLeft;
      oy += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    const headerRect = header.getBoundingClientRect();
    // The knob's own `x` transform: `knobX = useTransform(darkness, [0,1], [0,
    // KNOB_TRAVEL_PX])`, mirrored here since offset* cannot see it.
    const knobSelfShiftX = clampUnit(darkness.get()) * KNOB_TRAVEL_PX;
    return {
      x: headerRect.left + ox + knobSelfShiftX + el.offsetWidth / 2,
      y: headerRect.top + oy + el.offsetHeight / 2,
    };
  }

  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const gestureOriginRef = useRef<ThemeOrigin>({ x: 0, y: 0 });
  const directionRef = useRef<1 | -1>(1);
  const nextThemeRef = useRef<Theme>("dark");
  const originalThemeRef = useRef<Theme>(theme);
  const animationRef = useRef<Animation | null>(null);
  // Raw target, updated instantly on every pointermove.
  const progressRef = useRef(0);
  // What's actually applied to the reveal/knob each frame — chases
  // `progressRef` with exponential smoothing while a drag is active.
  const smoothedProgressRef = useRef(0);
  const scrubFrameRef = useRef<number | null>(null);
  const samplesRef = useRef<Sample[]>([]);
  const suppressClickRef = useRef(false);
  // True once `startThemeReveal` has actually been called for the current
  // gesture — its `flushSync(applyTheme)` runs synchronously the instant
  // it's invoked, regardless of whether the visual reveal later succeeds,
  // aborts (e.g. a backgrounded tab), or is still pending when the pointer
  // is released. Every cancel path below reverts through this flag alone,
  // so it doesn't matter which of those three outcomes actually happened.
  const themeFlippedRef = useRef(false);
  // False until the reveal's `.then()` has actually run (with or without a
  // usable animation). Without this, a reveal that resolves to `null`
  // *before* release looks identical to one still in flight — both show
  // `animationRef.current === null` — and a release would defer its
  // decision into `pendingReleaseRef` forever with no `.then()` left to
  // ever pick it up.
  const revealSettledRef = useRef(false);
  const pendingReleaseRef = useRef<boolean | null>(null);
  // Bumped on every pointerdown; async reveal callbacks capture the value
  // at creation time and no-op if it's stale, so a fast new gesture starting
  // before an old gesture's `transition.ready` has settled can never apply
  // its (now-irrelevant) decision on top of the new one.
  const gestureIdRef = useRef(0);

  function applyDarkness(progress: number) {
    darkness.set(directionRef.current === 1 ? progress : 1 - progress);
  }

  /** Chases `progressRef` (the raw pointer target) toward the smoothed
   * value actually rendered, every frame, for as long as the drag is
   * active. Frame-rate independent via real elapsed time. */
  function startScrubLoop() {
    let lastTime: number | null = null;

    function tick(now: number) {
      if (!draggingRef.current) {
        scrubFrameRef.current = null;
        return;
      }

      const dt = lastTime === null ? 16 : now - lastTime;
      lastTime = now;

      const target = progressRef.current;
      const alpha = 1 - Math.exp(-dt / SMOOTHING_TAU_MS);
      let smoothed = smoothedProgressRef.current + (target - smoothedProgressRef.current) * alpha;
      if (Math.abs(target - smoothed) < 0.0015) smoothed = target;
      smoothedProgressRef.current = smoothed;

      applyDarkness(smoothed);
      if (animationRef.current) {
        animationRef.current.currentTime = smoothed * viewTransition.durationMs;
      }

      scrubFrameRef.current = requestAnimationFrame(tick);
    }

    if (scrubFrameRef.current === null) {
      scrubFrameRef.current = requestAnimationFrame(tick);
    }
  }

  function pollAnimation(animation: Animation) {
    function tick() {
      if (animation.playState !== "running") {
        applyDarkness(animation.playbackRate > 0 ? 1 : 0);
        return;
      }
      const t = typeof animation.currentTime === "number" ? animation.currentTime : 0;
      applyDarkness(Math.min(1, Math.max(0, t / viewTransition.durationMs)));
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function revertToOriginalTheme() {
    setTheme(originalThemeRef.current);
    document.documentElement.setAttribute("data-theme", originalThemeRef.current);
    localStorage.setItem("theme", originalThemeRef.current);
  }

  /** Used whenever no WAAPI animation is available to reverse/complete —
   * either the reveal never started (reduced motion / unsupported) or it
   * started but never produced a usable animation (aborted transition). */
  function finalizeWithoutAnimation(commit: boolean) {
    if (commit) {
      if (!themeFlippedRef.current) setTheme(nextThemeRef.current);
      darkness.set(nextThemeRef.current === "dark" ? 1 : 0);
    } else {
      if (themeFlippedRef.current) revertToOriginalTheme();
      darkness.set(originalThemeRef.current === "dark" ? 1 : 0);
    }
  }

  function applyDecisionToAnimation(animation: Animation, commit: boolean) {
    if (!commit) revertToOriginalTheme();
    animation.playbackRate = commit ? 1 : -1;
    animation.play();
    pollAnimation(animation);
  }

  const triggerFullTransition = useCallback(
    (origin: ThemeOrigin) => {
      const next: Theme = theme === "dark" ? "light" : "dark";
      directionRef.current = next === "dark" ? 1 : -1;

      if (!supportsViewTransitions() || prefersReducedMotionNow()) {
        setTheme(next);
        darkness.set(next === "dark" ? 1 : 0);
        return;
      }

      startThemeReveal(next, origin, () => setTheme(next)).then((handle) => {
        if (!handle) {
          darkness.set(next === "dark" ? 1 : 0);
          return;
        }
        pollAnimation(handle.animation);
      });
    },
    [theme, setTheme, darkness],
  );

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    gestureIdRef.current += 1;
    draggingRef.current = false;
    startXRef.current = event.clientX;
    progressRef.current = 0;
    smoothedProgressRef.current = 0;
    samplesRef.current = [{ x: event.clientX, t: event.timeStamp }];
    originalThemeRef.current = theme;
    nextThemeRef.current = theme === "dark" ? "light" : "dark";
    directionRef.current = nextThemeRef.current === "dark" ? 1 : -1;
    animationRef.current = null;
    themeFlippedRef.current = false;
    revealSettledRef.current = false;
    pendingReleaseRef.current = null;

    gestureOriginRef.current = measureOrigin(event.currentTarget);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nice-to-have (keeps the gesture tracked off-element) —
      // the rest of the drag logic works fine without it.
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.buttons === 0) return;
    const deltaX = event.clientX - startXRef.current;

    if (!draggingRef.current) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;
      draggingRef.current = true;
      startScrubLoop();

      if (supportsViewTransitions() && !prefersReducedMotionNow()) {
        themeFlippedRef.current = true;
        const gestureId = gestureIdRef.current;

        startThemeReveal(nextThemeRef.current, gestureOriginRef.current, () => setTheme(nextThemeRef.current), {
          paused: true,
        }).then((handle) => {
          if (gestureIdRef.current !== gestureId) return; // superseded by a newer gesture
          revealSettledRef.current = true;

          if (!handle) {
            if (pendingReleaseRef.current !== null) {
              const commit = pendingReleaseRef.current;
              pendingReleaseRef.current = null;
              finalizeWithoutAnimation(commit);
            }
            return;
          }

          animationRef.current = handle.animation;
          animationRef.current.currentTime = smoothedProgressRef.current * viewTransition.durationMs;

          if (pendingReleaseRef.current !== null) {
            const commit = pendingReleaseRef.current;
            pendingReleaseRef.current = null;
            applyDecisionToAnimation(animationRef.current, commit);
          }
        });
      }
    }

    progressRef.current = Math.min(1, Math.max(0, (directionRef.current * deltaX) / DRAG_RANGE_PX));

    samplesRef.current.push({ x: event.clientX, t: event.timeStamp });
    if (samplesRef.current.length > 6) samplesRef.current.shift();
  }

  function computeVelocity(): number {
    const samples = samplesRef.current;
    if (samples.length < 2) return 0;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = last.t - first.t;
    // A too-small time span (coalesced events, or back-to-back synthetic
    // dispatches) makes px/ms blow up into a meaningless spike — require a
    // real window before trusting it as a deliberate flick.
    if (dt < 8) return 0;
    return (directionRef.current * (last.x - first.x)) / dt;
  }

  function commitOrCancel(commit: boolean) {
    if (animationRef.current) {
      applyDecisionToAnimation(animationRef.current, commit);
      return;
    }
    if (themeFlippedRef.current && !revealSettledRef.current) {
      // A reveal was started but hasn't settled yet (with or without a
      // usable animation) — defer; the pointermove `.then()` above will
      // apply this the instant it resolves.
      pendingReleaseRef.current = commit;
      return;
    }
    finalizeWithoutAnimation(commit);
  }

  function endDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released or never captured — fine either way.
    }
    if (!draggingRef.current) {
      draggingRef.current = false;
      return;
    }

    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 400);

    const velocity = computeVelocity();
    let commit: boolean;
    if (velocity > FLICK_VELOCITY_PX_MS) commit = true;
    else if (velocity < -FLICK_VELOCITY_PX_MS) commit = false;
    else commit = progressRef.current >= 0.5;

    draggingRef.current = false; // stops the scrub loop before the release takes over
    commitOrCancel(commit);
    animationRef.current = null;
  }

  function cancelDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released or never captured — fine either way.
    }
    if (!draggingRef.current) return;

    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 400);

    draggingRef.current = false;
    commitOrCancel(false);
    animationRef.current = null;
  }

  function handleClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    gestureIdRef.current += 1;
    triggerFullTransition(measureOrigin(event.currentTarget));
  }

  return {
    darkness,
    handleClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: endDrag,
    handlePointerCancel: cancelDrag,
  };
}
