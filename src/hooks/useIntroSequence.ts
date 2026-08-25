import { useCallback, useEffect, useRef, useState } from "react";
import { animate, useMotionValue, useReducedMotion, type MotionValue } from "framer-motion";

/**
 * One continuous clock (ms) drives every stage of the opening sequence,
 * instead of a discrete phase enum. Each visual (dot positions, edge
 * drawing, avatar opacity/scale/position, caption, continue button, the
 * final circular reveal) derives its own value from a `useTransform` window
 * over this same `elapsed` value — since it's all one continuous function of
 * one number, stages overlap and hand off with no boundary to get wrong.
 *
 * The clock runs in two segments rather than straight through, because the
 * sequence deliberately *waits* for the visitor:
 *
 *   0 ──────────────────► formEndMs        (automatic: form, caption, button)
 *                         ▲ parks here until the continue button is used
 *   formEndMs ──────────► totalMs          (on activation: reveal + dock)
 *
 * Both segments write to the same motion value, so every consumer stays a
 * pure function of `elapsed` and nothing needs to know which segment is
 * running.
 *
 * Runs on every load/reload — no sessionStorage/localStorage gating.
 */

export const INTRO_TIMELINE = {
  /** Dots fly in from outside and settle onto the avatar's own vertices. */
  dotsIn: [0, 1000] as [number, number],
  /** Edges draw between settled dots, back-to-front. */
  edgesDraw: [640, 1620] as [number, number],
  /**
   * The three windows below deliberately overlap rather than running in
   * sequence, and they hand off in a specific order so no single instant
   * reads as "the particles ended, the avatar began":
   *
   *   1500  lines start receding — the scaffolding goes first, while the
   *         dots that anchor it are all still lit
   *   1400  the avatar is already fading up underneath, reaching just over
   *         half presence while the wireframe is still clearly there, so the
   *         two are simultaneously visible on the same geometry for ~700ms
   *   1850  the dots — the points the avatar's own vertices sit on — fade
   *         last, so they look absorbed into the form rather than switched
   *         off
   *
   * Because everything is drawn at identical positions, the overlap reads as
   * one structure gaining definition. Dots and lines fade separately inside
   * the canvas (see IntroParticles) rather than as one layer opacity.
   */
  avatarForm: [1400, 1750, 2500] as [number, number, number],
  linesFadeOut: [1500, 2100] as [number, number],
  dotsFadeOut: [1850, 2500] as [number, number],
  /** The avatar is fully solid at avatarForm's end; this is that plus a
   * short settling beat, after which it starts tracking the cursor. */
  avatarAwake: 2800,
  /** The caret fades in here — visibly waiting before a single character is
   * typed. Typing itself starts at `captionType`, after the avatar has woken. */
  caption: [2600, 2820] as [number, number],
  captionType: 2900,
  /** Line → pill → arrow. */
  buttonForm: [2700, 3350] as [number, number],
  /** The clock parks here, waiting for the visitor. */
  formEndMs: 3350,
  /** Everything below runs only once the continue button is activated —
   * either by a click, or scrubbed directly by dragging the button. */
  revealSpanMs: 1000,
  /** Late enough that a partial drag never hides the control being dragged. */
  captionFadeOut: [3550, 4050] as [number, number],
  /** Circular hole opening through the backdrop onto the live site. */
  reveal: [3350, 4350] as [number, number],
  /** Avatar travelling from the composition into its Hero dock. */
  dock: [3350, 4350] as [number, number],
  totalMs: 4350,
};

export type IntroPhase = "forming" | "waiting" | "revealing" | "done";

export interface IntroSequence {
  elapsed: MotionValue<number>;
  phase: IntroPhase;
  /** True once the overlay is gone and the site owns the avatar again. */
  done: boolean;
  /** Runs the reveal segment. No-op unless currently waiting. */
  beginReveal: () => void;
  /** Drives the reveal segment directly from a 0..1 gesture position.
   * The whole reveal — circular mask, gradient edge, caption fade, the
   * avatar's flight to its dock — is already a pure function of `elapsed`,
   * so dragging simply moves that one number and every part follows in
   * lockstep. No separate drag animation exists to keep in sync. */
  scrubReveal: (progress: number) => void;
  /** Ends a scrub: plays the remainder out, or runs it back to the parked
   * state, from wherever the gesture left it. */
  settleReveal: (commit: boolean) => void;
}

export function useIntroSequence(): IntroSequence {
  const reduceMotion = useReducedMotion();
  const elapsed = useMotionValue(0);
  const phaseRef = useRef<IntroPhase>("forming");
  const [phase, setPhase] = useState<IntroPhase>(() => {
    if (typeof window === "undefined") return "done";
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "done" : "forming";
  });

  function updatePhase(next: IntroPhase) {
    phaseRef.current = next;
    setPhase(next);
  }

  const beginReveal = useCallback(() => {
    if (phaseRef.current !== "waiting") return;
    updatePhase("revealing");
    animate(elapsed, INTRO_TIMELINE.totalMs, {
      duration: INTRO_TIMELINE.revealSpanMs / 1000,
      ease: [0.65, 0, 0.35, 1],
      onComplete: () => updatePhase("done"),
    });
  }, [elapsed]);

  // A scrub keeps the phase at "waiting" on purpose: the gesture is still
  // reversible, the button must stay enabled to keep receiving pointer
  // events, and nothing is committed until release.
  const scrubReveal = useCallback(
    (progress: number) => {
      if (phaseRef.current !== "waiting") return;
      const clamped = Math.min(1, Math.max(0, progress));
      elapsed.set(INTRO_TIMELINE.formEndMs + clamped * INTRO_TIMELINE.revealSpanMs);
    },
    [elapsed],
  );

  const settleReveal = useCallback(
    (commit: boolean) => {
      if (phaseRef.current !== "waiting") return;
      const from = elapsed.get();
      const target = commit ? INTRO_TIMELINE.totalMs : INTRO_TIMELINE.formEndMs;
      // Time the run-out by the distance actually left, so releasing at 90%
      // finishes quickly instead of replaying the whole span.
      const remaining = Math.abs(target - from) / INTRO_TIMELINE.revealSpanMs;
      if (commit) updatePhase("revealing");
      animate(elapsed, target, {
        duration: Math.max(0.18, remaining * (INTRO_TIMELINE.revealSpanMs / 1000)),
        ease: commit ? [0.65, 0, 0.35, 1] : [0.33, 1, 0.68, 1],
        onComplete: commit ? () => updatePhase("done") : undefined,
      });
    },
    [elapsed],
  );

  useEffect(() => {
    // No "already started" ref guard — under React 19 StrictMode's dev
    // double-invoke (mount → cleanup → mount), a ref would survive the
    // simulated remount and wrongly suppress the second, kept invocation
    // from ever starting the clock/listeners (the first invocation's
    // cleanup already tore them down). The empty dep array is what keeps
    // this to one real run in production.
    if (phaseRef.current !== "forming") return;

    const controls = animate(elapsed, INTRO_TIMELINE.formEndMs, {
      duration: INTRO_TIMELINE.formEndMs / 1000,
      ease: "linear",
      onComplete: () => updatePhase("waiting"),
    });

    /** Any deliberate input jumps the *formation* straight to its finished,
     * waiting state — it never skips past the continue button, so control
     * over entering the site always stays with the visitor. */
    function skipFormation() {
      if (phaseRef.current !== "forming") return;
      controls.stop();
      elapsed.set(INTRO_TIMELINE.formEndMs);
      updatePhase("waiting");
    }
    window.addEventListener("pointerdown", skipFormation);
    window.addEventListener("keydown", skipFormation);
    window.addEventListener("wheel", skipFormation, { passive: true });

    return () => {
      controls.stop();
      window.removeEventListener("pointerdown", skipFormation);
      window.removeEventListener("keydown", skipFormation);
      window.removeEventListener("wheel", skipFormation);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = Boolean(reduceMotion) || phase === "done";
  return { elapsed, phase: done ? "done" : phase, done, beginReveal, scrubReveal, settleReveal };
}
