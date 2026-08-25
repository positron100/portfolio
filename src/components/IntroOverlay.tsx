import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import type { PointerEvent as ReactPointerEvent } from "react";
import { IntroParticles } from "@/components/IntroParticles";
import { Magnetic } from "@/components/Magnetic";
import { INTRO_TIMELINE, type IntroPhase } from "@/hooks/useIntroSequence";
import { avatarIsRendered, avatarSize, introComposition } from "@/utils/avatarLayout";
import { useTypeOnce } from "@/hooks/useTypeOnce";

/**
 * The opening sequence's backdrop, caption and continue control.
 *
 * Every visual is a continuous `useTransform` window over the single
 * `elapsed` clock from `useIntroSequence` — nothing here mounts, unmounts or
 * branches on a phase mid-sequence, so each stage grows out of the one
 * before it instead of starting fresh:
 *
 *   dots fly in → edges draw between them → the real avatar resolves in over
 *   that exact wireframe (see IntroParticles) → caption → the continue
 *   button builds itself out of a single line → the visitor decides when the
 *   site appears.
 *
 * The final reveal opens a circular hole through this backdrop rather than
 * cross-fading it: same visual principle as the theme toggle's circular
 * reveal, but an entirely separate implementation (a plain CSS mask, no View
 * Transition API) — there is no second full-page snapshot to swap here, the
 * real site is already live underneath the whole time.
 */

/** Pointer travel for a full 0→1 pull. Longer than the button so the drag
 * reads as a deliberate gesture rather than a twitch. */
const DRAG_RANGE_PX = 190;
/** Movement below this is a click, not a drag — matches the threshold the
 * theme toggle's own gesture model uses. */
const DRAG_THRESHOLD_PX = 6;
const DRAG_COMMIT_PROGRESS = 0.45;
const FLICK_VELOCITY_PX_MS = 0.5;
/** Time constant (ms) for the per-frame chase toward the raw pointer target.
 * Small enough to read as direct manipulation, large enough to bridge the
 * gaps between pointer samples so the reveal never advances in visible
 * steps. Mirrors the smoothing the theme toggle's own drag scrub uses. */
const SCRUB_TAU_MS = 35;

const CAPTION_TEXT = "Welcome to my portfolio";

export function IntroOverlay({
  elapsed,
  phase,
  done,
  onEnter,
  onScrub,
  onSettle,
}: {
  elapsed: MotionValue<number>;
  phase: IntroPhase;
  done: boolean;
  onEnter: () => void;
  onScrub: (progress: number) => void;
  onSettle: (commit: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Where the reveal's circle opens from. Read from the live button rather
  // than assumed, and held in a ref so the per-frame mask transform below
  // always sees the current value without needing a re-render first.
  const originRef = useRef({ x: 0, y: 0 });

  const [layout] = useState(() => {
    const size = avatarSize();
    return { captionTop: introComposition(size).captionTop };
  });
  // Below the desktop breakpoint no 3D avatar is rendered at all, so nothing
  // arrives to take the wireframe's place — there, the dots and edges *are*
  // the avatar and must not fade.
  const [avatarTakesOver] = useState(avatarIsRendered);
  const [maxRadius] = useState(() => Math.hypot(window.innerWidth, window.innerHeight));
  const [isDragging, setIsDragging] = useState(false);
  // Same one-way latch the avatar uses to wake: watch the shared clock, flip
  // once, unsubscribe. Typing is deliberately a step behind the avatar coming
  // alive, so the order reads avatar forms → settles → looks around → speaks.
  const [typingStarted, setTypingStarted] = useState(false);
  const caption = useTypeOnce(CAPTION_TEXT, typingStarted);

  // --- gesture state (refs: nothing here should re-render per pointermove)
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  /** Raw pointer-derived target, written by pointermove and read by the
   * frame loop. Never drives a visual directly. */
  const progressRef = useRef(0);
  /** What is actually rendered — chases `progressRef` once per frame. */
  const smoothedRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const samplesRef = useRef<{ x: number; t: number }[]>([]);
  const dragX = useMotionValue(0);

  const captionOpacity = useTransform(
    elapsed,
    [INTRO_TIMELINE.caption[0], INTRO_TIMELINE.caption[1], ...INTRO_TIMELINE.captionFadeOut],
    [0, 1, 1, 0],
  );
  const captionY = useTransform(elapsed, INTRO_TIMELINE.caption, [12, 0]);

  // The button assembles itself: a hairline draws, stretches open into a
  // pill, and only then does the arrow stroke itself in.
  const buttonWidth = useTransform(elapsed, [2700, 2980, 3220], [0, 64, 76]);
  const buttonHeight = useTransform(elapsed, [2980, 3220], [2, 52]);
  const buttonSurface = useTransform(elapsed, [3000, 3260], [0, 1]);
  const arrowLength = useTransform(elapsed, [3180, INTRO_TIMELINE.formEndMs], [0, 1]);
  const buttonOpacity = useTransform(
    elapsed,
    [INTRO_TIMELINE.buttonForm[0], ...INTRO_TIMELINE.captionFadeOut],
    [0, 1, 0],
  );
  // The hairline that became the pill, dissolving once the surface behind
  // it has taken over.
  const buttonSeedOpacity = useTransform(elapsed, [2700, 3000, 3220], [1, 1, 0]);

  const revealRadius = useTransform(elapsed, INTRO_TIMELINE.reveal, [0, maxRadius]);
  const maskImage = useTransform(revealRadius, (r) => {
    const { x, y } = originRef.current;
    return `radial-gradient(circle at ${x}px ${y}px, transparent 0 ${r}px, #000 ${r + 1.5}px)`;
  });

  // A soft band of colour riding the leading edge of the hole, so the reveal
  // is legible even though the splash and the site share a background. Its
  // colours come from the theme's own accent tokens (indigo→violet in light,
  // green→teal in dark), defined as `--intro-reveal-*` in index.css — this
  // layer belongs to the overlay alone and unmounts with it, so nothing about
  // the page's own colours or the theme toggle is touched.
  const revealEdge = useTransform(revealRadius, (r) => {
    const { x, y } = originRef.current;
    const inner = Math.max(0, r - 190);
    const wash = Math.max(0, r - 96);
    const edge = Math.max(0, r - 10);
    return (
      `radial-gradient(circle at ${x}px ${y}px, transparent 0 ${inner}px,` +
      ` var(--intro-reveal-wash) ${wash}px,` +
      ` var(--intro-reveal-edge) ${edge}px,` +
      ` transparent ${r + 2}px)`
    );
  });
  const revealEdgeOpacity = useTransform(
    elapsed,
    [INTRO_TIMELINE.reveal[0], INTRO_TIMELINE.reveal[0] + 90, INTRO_TIMELINE.reveal[1] - 220, INTRO_TIMELINE.reveal[1]],
    [0, 1, 0.9, 0],
  );

  useEffect(() => {
    if (typingStarted) return;
    if (elapsed.get() >= INTRO_TIMELINE.captionType) {
      setTypingStarted(true);
      return;
    }
    return elapsed.on("change", (v) => {
      if (v >= INTRO_TIMELINE.captionType) setTypingStarted(true);
    });
  }, [typingStarted, elapsed]);

  // Hand keyboard control straight to the one thing there is to do here.
  useEffect(() => {
    if (phase === "waiting") buttonRef.current?.focus();
  }, [phase]);

  // The overlay covers the page but doesn't stop it scrolling underneath —
  // a wheel or arrow key during the sequence left the visitor part-way down
  // the site the moment it was revealed, with the avatar's "settle into
  // Home" landing nowhere near Home.
  useEffect(() => {
    if (reduceMotion || done) return;
    // Locked on the documentElement, not the body: body→viewport overflow
    // propagation only applies while the root's own overflow is `visible`,
    // and here it isn't — a body-level lock left the page scrolling freely.
    const root = document.documentElement;
    const scrollbar = window.innerWidth - root.clientWidth;
    const previousOverflow = root.style.overflow;
    const previousPadding = root.style.paddingRight;
    root.style.overflow = "hidden";
    if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
    return () => {
      root.style.overflow = previousOverflow;
      root.style.paddingRight = previousPadding;
    };
  }, [reduceMotion, done]);

  /** The circle always opens from where the control actually is. Captured at
   * gesture start so a dragged button doesn't drag the origin with it. */
  function captureOrigin() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (phase !== "waiting") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    draggingRef.current = false;
    startXRef.current = event.clientX;
    progressRef.current = 0;
    smoothedRef.current = 0;
    samplesRef.current = [{ x: event.clientX, t: performance.now() }];
    captureOrigin();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nice-to-have; the gesture still works without it.
    }
  }

  /**
   * Advances the reveal once per rendered frame, chasing the raw pointer
   * target held in `progressRef`.
   *
   * The scrub used to be driven straight from `pointermove`, which made the
   * reveal advance only on frames where a pointer sample happened to land:
   * measured over a slow drag, 79% of rendered frames showed an identical
   * mask radius and the radius jumped in ~27px steps. The circle's radius
   * spans the viewport diagonal (~1700px) over a 190px drag, so it amplifies
   * every gap in the pointer stream about ninefold — which is exactly what
   * read as frame skipping. Driving it from the frame loop instead means one
   * update per painted frame, no wasted duplicate work when samples arrive
   * faster than frames, and no frozen frames when they arrive slower.
   */
  function startScrubLoop() {
    if (frameRef.current !== null) return;
    let last: number | null = null;

    function tick(now: number) {
      if (!draggingRef.current) {
        frameRef.current = null;
        return;
      }
      const dt = last === null ? 16 : now - last;
      last = now;

      const target = progressRef.current;
      const alpha = 1 - Math.exp(-dt / SCRUB_TAU_MS);
      let value = smoothedRef.current + (target - smoothedRef.current) * alpha;
      if (Math.abs(target - value) < 0.0005) value = target;
      smoothedRef.current = value;

      onScrub(value);
      // The control follows the finger, damped, so the gesture reads as
      // direct manipulation rather than a slider watched from a distance.
      dragX.set(value * DRAG_RANGE_PX * 0.32);

      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (phase !== "waiting" || event.buttons === 0) return;
    const deltaX = event.clientX - startXRef.current;

    if (!draggingRef.current) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;
      draggingRef.current = true;
      setIsDragging(true); // once per gesture, not per move
      startScrubLoop();
    }

    // Only a rightward pull opens the site — the direction the arrow points.
    // This handler does no visual work at all; the frame loop above owns it.
    progressRef.current = Math.min(1, Math.max(0, deltaX / DRAG_RANGE_PX));

    samplesRef.current.push({ x: event.clientX, t: performance.now() });
    if (samplesRef.current.length > 6) samplesRef.current.shift();
  }

  /** px/ms over the recent sample window. Samples are stamped with
   * `performance.now()` rather than `event.timeStamp`: those timestamps are
   * not guaranteed to share a clock across input sources, and a pointerdown
   * stamped on a different one made `dt` read as seconds instead of
   * milliseconds — velocity came out ~60x too small and the flick-to-commit
   * path never fired. One clock, read here, removes the ambiguity. */
  function velocity() {
    const s = samplesRef.current;
    if (s.length < 2) return 0;
    const dt = s[s.length - 1].t - s[0].t;
    // Too short a window turns coalesced events into a meaningless spike.
    if (dt < 8) return 0;
    return (s[s.length - 1].x - s[0].x) / dt;
  }

  function endGesture(event: ReactPointerEvent<HTMLButtonElement>, cancelled: boolean) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released or never captured.
    }
    if (!draggingRef.current) return; // a plain click — let onClick handle it

    draggingRef.current = false; // stops the frame loop before the release takes over
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setIsDragging(false);
    // A drag must not also fire the click that follows pointerup, or the
    // release decision and the click would both try to run the reveal.
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 350);

    const v = velocity();
    const commit = cancelled
      ? false
      : v > FLICK_VELOCITY_PX_MS
        ? true
        : v < -FLICK_VELOCITY_PX_MS
          ? false
          : progressRef.current >= DRAG_COMMIT_PROGRESS;

    onSettle(commit);
    animate(dragX, 0, commit ? { duration: 0.3, ease: [0.65, 0, 0.35, 1] } : { type: "spring", stiffness: 380, damping: 26 });
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (phase !== "waiting") return;
    captureOrigin();
    onEnter();
  }

  if (reduceMotion || done) return null;

  const idle = phase === "waiting" && !isDragging;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Only the backdrop carries the mask, so the reveal's circle opens
          cleanly onto the live site. The caption and button sit in an
          unmasked layer above it and fade out on their own — masked, the
          growing hole sliced letters out of the caption mid-word. */}
      <motion.div
        style={{ maskImage, WebkitMaskImage: maskImage }}
        className="absolute inset-0 bg-bg"
        aria-hidden="true"
      >
        <IntroParticles elapsed={elapsed} absorb={avatarTakesOver} />
      </motion.div>

      <motion.div
        style={{ backgroundImage: revealEdge, opacity: revealEdgeOpacity }}
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      />

      <div
        className="absolute inset-x-0 flex flex-col items-center px-6"
        style={{ top: layout.captionTop }}
      >
        <motion.p
          style={{ opacity: captionOpacity, y: captionY }}
          aria-label={CAPTION_TEXT}
          // Roughly double the previous 14/16px. Letter-spacing eases off as the
          // size grows: at 0.2em a 23-character line overran a 390px viewport
          // once the type doubled.
          className="text-center font-mono text-xl tracking-[0.1em] text-fg-muted uppercase sm:text-3xl sm:tracking-[0.14em]"
        >
          {/* The full line is on the element as `aria-label`, so assistive
              tech reads it once rather than announcing each keystroke. */}
          <span aria-hidden="true">{caption.display}</span>
          <span
            aria-hidden="true"
            // A deliberate block caret: twice cap height, and wide enough to
            // read as a solid rectangle rather than a hairline. Sized in `em`
            // so it tracks the caption's own font-size (30px desktop / 20px
            // mobile) without needing a breakpoint of its own.
            //
            // Centred on the capitals rather than sitting on the baseline: at
            // 1.44em it overshoots the letters by 0.36em at each end, and the
            // negative bottom margin drops it by exactly half that. An
            // inline-block's baseline is its bottom *margin* edge, so this
            // stays pure layout — no `translate-y`, which silently did
            // nothing here when it was tried. Still no left margin: the 0.1em
            // letter-spacing already leaves a gap after the final glyph.
            //
            // `bg-accent` is the theme's own accent token — indigo in light,
            // green in dark — so the caret follows the palette instead of
            // hardcoding either colour.
            className="-mb-[0.36em] inline-block h-[1.44em] w-[0.2em] bg-accent animate-[caret-blink_1.15s_steps(1,end)_infinite]"
          />
        </motion.p>

        {/* Same magnetic pull the Hero's "View My Work" / "Get In Touch"
            CTAs use — the existing component, not a lookalike, so the arrow
            speaks the site's established interaction language. The wrapper
            owns the magnetic x/y while the button itself owns the drag
            offset, so the two never write the same transform, and the pull
            is switched off outright for the duration of a drag. */}
        <Magnetic className="mt-10 inline-block" disabled={isDragging}>
        <motion.button
          ref={buttonRef}
          type="button"
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(e) => endGesture(e, false)}
          onPointerCancel={(e) => endGesture(e, true)}
          disabled={phase !== "waiting"}
          aria-label="Enter portfolio"
          title="Click, or drag right, to enter"
          style={{ width: buttonWidth, height: buttonHeight, opacity: buttonOpacity, x: dragX }}
          // These must stay mounted rather than flipping to `undefined` when
          // a drag starts: swapping a `while*` prop out mid-gesture removes
          // the handler without unwinding the variant it had already
          // applied, which left the button stuck at the pressed scale for
          // good after any cancelled drag. Keeping them constant — with an
          // explicit `rest` for `animate` to fall back to — means the
          // gesture always has somewhere to unwind to.
          animate="rest"
          whileHover="hover"
          whileTap="press"
          variants={{
            rest: { scale: 1 },
            hover: { scale: 1.07 },
            press: { scale: 0.94 },
          }}
          transition={{ type: "spring", stiffness: 420, damping: 24 }}
          className="relative flex touch-none items-center justify-center rounded-full text-accent disabled:cursor-default"
        >
          {/* The pill's surface and border arrive after the line has opened
              out, so the hairline reads as becoming the button rather than
              being replaced by one. */}
          <motion.span
            style={{ opacity: buttonSurface }}
            className="absolute inset-0 rounded-full border border-accent/40 bg-accent/5"
            aria-hidden="true"
          />
          <motion.span
            style={{ opacity: buttonSeedOpacity }}
            className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-accent"
            aria-hidden="true"
          />

          {/* Two nested spans so the two motions never fight for the same
              property: the outer one carries the occasional idle nudge, the
              inner one answers hover/press through the button's variants. */}
          <motion.span
            animate={idle ? { x: [0, 0, 5, 0, 0] } : { x: 0 }}
            transition={
              idle
                ? {
                    duration: 1.5,
                    times: [0, 0.12, 0.4, 0.72, 1],
                    repeat: Infinity,
                    repeatDelay: 2.2,
                    ease: "easeInOut",
                  }
                : { type: "spring", stiffness: 400, damping: 30 }
            }
            className="relative"
            aria-hidden="true"
          >
            <motion.span
              variants={{ rest: { x: 0 }, hover: { x: 4 }, press: { x: 1 } }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="block"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <motion.path d="M4 12h14" style={{ pathLength: arrowLength, opacity: arrowLength }} />
                <motion.path d="m12 6 6 6-6 6" style={{ pathLength: arrowLength, opacity: arrowLength }} />
              </svg>
            </motion.span>
          </motion.span>
        </motion.button>
        </Magnetic>
      </div>
    </div>
  );
}
