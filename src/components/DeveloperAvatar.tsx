import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "framer-motion";
import { INTRO_TIMELINE } from "@/hooks/useIntroSequence";
import { avatarIsRendered, avatarSize, dockedCenter, introComposition } from "@/utils/avatarLayout";
import { observeModalOpen, trackPointerPosition } from "@/utils/pointerTracking";

const DeveloperAvatarScene = lazy(() => import("@/components/DeveloperAvatarScene"));

// Companion-mode target scale once fully scrolled past Hero, and the
// smoothing time constant for chasing pointer/scroll targets — mirrors the
// exponential-smoothing pattern already used by the theme toggle's drag
// scrub loop (see useThemeToggleController.ts) rather than snapping to the
// raw target every frame.
// Companion mode only — the Hero/docked size is always scale 1 and is not
// affected by this. Halved from 0.42: at full Hero size the companion read
// as a second subject competing with the section content it floats over.
// The scroll loop lerps toward it, so both directions stay smooth.
const COMPANION_SCALE = 0.21;
/**
 * Exponential-smoothing time constant. A finger and a cursor want different
 * numbers, and using one for both is why touch felt disconnected.
 *
 * A cursor is already exactly where the visitor is looking, so the avatar is
 * free to drift lazily behind it. A finger is not: it is *on* the glass, the
 * eye tracks it directly, and any lag between the two reads as the avatar
 * failing to keep up rather than as a graceful trail. Tau is the time to close
 * ~63% of the remaining distance, so 120ms leaves the avatar a visible third
 * of the way behind a quick swipe; 55ms keeps it a hair back without ever
 * feeling detached.
 */
const SMOOTHING_TAU_MS = 120;
const TOUCH_SMOOTHING_TAU_MS = 55;
/**
 * Longest frame delta the smoothing will act on, in ms (~4 frames at 60fps).
 *
 * Without this, one long frame — a GC pause, a dropped frame on a mid-range
 * Android, or the page being backgrounded — produces a `dt` big enough to
 * drive `alpha` to 1, and the avatar teleports to the finger in a single
 * frame. That is exactly the "sudden catching up after fast movement" and the
 * micro-jumps: not a smoothing problem, a delta problem.
 */
const MAX_FRAME_MS = 64;
/**
 * Fraction of the way to the finger the avatar travels on a touch device,
 * at every scroll position. See the note at the use site for why touch is a
 * constant where the mouse is scroll-scaled.
 */
const TOUCH_FOLLOW = 0.94;
/** Cap on the opening screen lean, in px each way. */
const INTRO_LEAN_PX = 46;

/**
 * Velocity extrapolation for the touch follow target.
 *
 * On a phone the finger is only sampled at ~4Hz while the page is scrolling:
 * Chrome throttles passive `touchmove` delivery during an active scroll, and
 * `pointermove` is cancelled outright the moment the scroll gesture is
 * claimed (measured on a physical Oppo — gap p50 ~200ms, p90 ~320ms).
 * `TouchEvent.getCoalescedEvents()` does not exist there, so the intermediate
 * positions cannot be read and are synthesised instead: between real samples
 * the target coasts along the last measured finger velocity, which decays so
 * it settles when the finger stops, and is bounded so one late or abnormal
 * sample can never fling the avatar across the screen.
 *
 * This only improves the *target* the follow loop chases. The 55ms smoothing
 * (`TOUCH_SMOOTHING_TAU_MS`) that actually moves the avatar toward that
 * target is untouched, so a corrected prediction is eased into like any other
 * target change — the avatar itself never snaps.
 */
/** Max lead of the predicted target over the last real sample, px. Bridges a
 * ~200ms gap at moderate speed; a multi-second stale gap is clamped to this. */
const TOUCH_PREDICT_MAX_PX = 64;
/** Time constant for the predicted velocity decaying to zero, ms. ~13% left
 * after 180ms (about one sample gap), so an un-refreshed prediction coasts
 * briefly then stops on its own. */
const TOUCH_VEL_DECAY_TAU_MS = 90;
/** Per-sample smoothing of the measured velocity. Halves a hard reversal, so
 * a direction change slows the prediction rather than overshooting. */
const TOUCH_VEL_EMA = 0.5;
/** Ceiling on measured finger speed, px/ms (~3000px/s; a fast flick is ~2000).
 * Caps an abnormal Δposition/Δtime from a delayed event. */
const TOUCH_VEL_MAX_PX_PER_MS = 3;
/** Ignore sample gaps shorter than this, ms — sub-frame event clumping makes
 * px/ms meaningless. */
const TOUCH_SAMPLE_MIN_MS = 6;
/** Beyond this gap, ms, the finger path is unknowable — zero the velocity
 * rather than extrapolate across it. */
const TOUCH_SAMPLE_GAP_RESET_MS = 320;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * A small experimental companion — a stylized procedural form, not a
 * modeled character (no asset pipeline here to source/rig one). Desktop
 * only; mobile screen space and device budget both make it not worth it
 * there. `lazy` + `Suspense` keep the `three` / `@react-three/fiber` chunk
 * out of the main bundle. Purely decorative: `pointer-events-none` here AND
 * on the r3f `<Canvas>` itself (see DeveloperAvatarScene.tsx — r3f defaults
 * its own wrapper to `pointer-events: auto`, which otherwise silently wins
 * over this element's `none`) — it must never intercept clicks/hover
 * meant for the real page underneath.
 *
 * One instance, mounted once at the app root (see App.tsx), never
 * unmounting while desktop/motion conditions hold. Its `x`/`y`/`scale`/
 * `opacity` motion values have exactly two sources, handed off cleanly:
 * during the opening sequence they mirror continuous `useTransform`
 * windows over `useIntroSequence`'s single `elapsed` clock (see
 * `INTRO_TIMELINE`), so forming/docking is one unbroken interpolation with
 * no phase-boundary jumps; once the intro's `elapsed` stops advancing
 * (sequence complete or skipped) those windows go static and the
 * scroll/pointer rAF loop below becomes the only thing still writing to
 * the same values — same motion values throughout, so there is nothing to
 * visibly hand off.
 */
export function DeveloperAvatar({
  introElapsed,
  introDone,
}: {
  introElapsed: MotionValue<number>;
  introDone: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [isDesktop, setIsDesktop] = useState(false);
  // One-way latch: the avatar stays perfectly still while the dots are
  // converging and the lines are drawing (its pose has to match the wireframe
  // the dots drew), then comes alive once it is fully formed and has had a
  // beat to settle. Flips exactly once and unsubscribes, so watching the
  // clock costs nothing after that.
  const [awake, setAwake] = useState(false);
  /** A project modal is open: the avatar is behind it and behind its scrim,
   * so every frame it renders is invisible work competing with the card's
   * expansion. Flips twice per interaction, never per frame. */
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => observeModalOpen(setModalOpen), []);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const opacity = useMotionValue(0);
  const pointerRef = useRef({ x: 0, y: 0 });
  // Until the screen has actually been pointed at, the avatar stays docked
  // rather than drifting toward the 0,0 corner a fresh ref would name.
  const hasPointed = useRef(false);
  // Opening-screen lean only. Zero for the whole of the rest of the site.
  const introFollowX = useMotionValue(0);
  const introFollowY = useMotionValue(0);

  // Pure functions of the intro clock — never mutated directly, only read
  // (via the forwarding effect below) or left to freeze once the clock
  // stops advancing.
  const size = avatarSize();
  const dock = dockedCenter(size);
  // Exactly where the dot field converges (both derive from the same
  // `introComposition`), so the avatar resolves in on top of its own
  // finished wireframe rather than near it.
  const introCentre = introComposition(size).avatarCenter;
  const introTopLeft = { x: introCentre.x - size / 2, y: introCentre.y - size / 2 };
  const dockTopLeft = { x: dock.x - size / 2, y: dock.y - size / 2 };

  // Scale stays at 1 for the whole formation: the dots have already drawn
  // this exact wireframe at this exact size, so the avatar's job is only to
  // become *solid* in place — growing it would slide it off the structure
  // the dots just built and reintroduce the visible swap this replaced.
  const introOpacity = useTransform(introElapsed, INTRO_TIMELINE.avatarForm, [0, 1]);
  const introX = useTransform(
    introElapsed,
    [0, INTRO_TIMELINE.dock[0], INTRO_TIMELINE.dock[1]],
    [introTopLeft.x, introTopLeft.x, dockTopLeft.x],
  );
  const introY = useTransform(
    introElapsed,
    [0, INTRO_TIMELINE.dock[0], INTRO_TIMELINE.dock[1]],
    [introTopLeft.y, introTopLeft.y, dockTopLeft.y],
  );

  useEffect(() => {
    setIsDesktop(avatarIsRendered());
  }, []);

  useEffect(() => {
    if (awake) return;
    if (introDone || introElapsed.get() >= INTRO_TIMELINE.avatarAwake) {
      setAwake(true);
      return;
    }
    return introElapsed.on("change", (v) => {
      if (v >= INTRO_TIMELINE.avatarAwake) setAwake(true);
    });
  }, [awake, introDone, introElapsed]);

  // Mirrors the intro-clock-derived values into the real x/y/scale/opacity
  // as long as the clock is still advancing. Once `introElapsed` stops
  // changing (sequence complete or skipped straight to its end value),
  // these simply stop firing — there's nothing to unsubscribe, and nothing
  // left for the scroll/pointer loop below to conflict with once it starts.
  useEffect(() => {
    if (!isDesktop) return;
    if (reduceMotion) {
      x.set(dockTopLeft.x);
      y.set(dockTopLeft.y);
      scale.set(1);
      opacity.set(1);
      return;
    }
    x.set(introX.get());
    y.set(introY.get());
    scale.set(1);
    opacity.set(introOpacity.get());
    const unsubscribes = [
      introX.on("change", (v) => x.set(v)),
      introY.on("change", (v) => y.set(v)),
      introOpacity.on("change", (v) => opacity.set(v)),
    ];
    return () => unsubscribes.forEach((unsub) => unsub());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, reduceMotion]);

  // Opening-screen lean: runs from the moment the avatar is fully formed
  // until the visitor enters the site, then stops for good and eases its
  // offset back to zero so the flight to the dock starts from a clean slate.
  // Same smoothing as the main loop, and the same passive listener rules.
  useEffect(() => {
    if (!isDesktop || reduceMotion || !awake || introDone) return;

    let raf = 0;
    let last: number | null = null;
    const target = { x: 0, y: 0 };

    const untrack = trackPointerPosition((px, py) => {
      const centre = introComposition(avatarSize()).avatarCenter;
      // Bounded lean rather than a chase: the offset is a fraction of the
      // distance from the composition centre, capped, so however far away
      // the finger is the avatar only ever tilts within its own space and
      // never drifts over the caption or the continue button.
      target.x = Math.max(-INTRO_LEAN_PX, Math.min(INTRO_LEAN_PX, (px - centre.x) * 0.18));
      target.y = Math.max(-INTRO_LEAN_PX, Math.min(INTRO_LEAN_PX, (py - centre.y) * 0.18));
    });

    function tick(now: number) {
      const dt = last === null ? 16 : Math.min(now - last, MAX_FRAME_MS);
      last = now;
      const alpha = 1 - Math.exp(-dt / SMOOTHING_TAU_MS);
      introFollowX.set(introFollowX.get() + (target.x - introFollowX.get()) * alpha);
      introFollowY.set(introFollowY.get() + (target.y - introFollowY.get()) * alpha);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      untrack();
      introFollowX.set(0);
      introFollowY.set(0);
    };
  }, [isDesktop, reduceMotion, awake, introDone, introFollowX, introFollowY]);

  // Persistent scroll + cursor behavior, active only once the opening
  // sequence is done: shrinks and follows the cursor past Hero, grows and
  // re-docks on the way back — driven by motion values + rAF, no per-frame
  // React state, per the project's established performance pattern.
  useEffect(() => {
    // `modalOpen` tears the whole loop down rather than being checked inside
    // it: no rAF, no listeners, no motion-value writes at all while a modal
    // is up. The avatar keeps its last position, so reopening is seamless.
    if (!isDesktop || reduceMotion || !introDone || modalOpen) return;

    const pointerFine = window.matchMedia("(pointer: fine)").matches;
    // A mouse delivers a sample every frame; only touch is starved during a
    // scroll and needs the predicted target. See the constants above.
    const predict = !pointerFine;

    // Predicted finger target and its decaying velocity (px, px/ms), plus the
    // last real sample. Plain closure state, exactly like `lastTime`/`scrollY`
    // below — no React state, no refs, no layout reads.
    const predicted = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    let sampleT: number | null = null;
    let sampleX = 0;
    let sampleY = 0;

    // Pointer *and* touch, via the shared subscription — `pointermove` alone
    // stops arriving the instant a touch becomes a scroll, which is what made
    // the avatar look like it was reacting to the last touch rather than
    // following the finger. See `pointerTracking.ts`.
    const untrack = trackPointerPosition((px, py, t) => {
      pointerRef.current.x = px;
      pointerRef.current.y = py;
      hasPointed.current = true;
      if (!predict) return;
      if (sampleT !== null) {
        const gap = t - sampleT;
        if (gap >= TOUCH_SAMPLE_MIN_MS && gap <= TOUCH_SAMPLE_GAP_RESET_MS) {
          const vx = clamp((px - sampleX) / gap, -TOUCH_VEL_MAX_PX_PER_MS, TOUCH_VEL_MAX_PX_PER_MS);
          const vy = clamp((py - sampleY) / gap, -TOUCH_VEL_MAX_PX_PER_MS, TOUCH_VEL_MAX_PX_PER_MS);
          vel.x = lerp(vel.x, vx, TOUCH_VEL_EMA);
          vel.y = lerp(vel.y, vy, TOUCH_VEL_EMA);
        } else {
          // Sub-frame clump, or a gap too long to trust — don't extrapolate.
          vel.x = 0;
          vel.y = 0;
        }
      }
      sampleT = t;
      sampleX = px;
      sampleY = py;
      // Immediate correction to the newest real position. This jumps the
      // *target*, not the avatar — the 55ms smoothing eases the avatar to it.
      predicted.x = px;
      predicted.y = py;
    });

    let raf = 0;
    let lastTime: number | null = null;

    // Measured on resize, not on every frame.
    //
    // This loop used to call `avatarSize()`, `dockedCenter()` and
    // `document.getElementById("home").offsetHeight` inside `tick`. Reading
    // `offsetHeight` forces the browser to flush layout, so the avatar was
    // triggering a synchronous layout on every single animation frame for as
    // long as the page was open: 189 of them across 60 frames, measured.
    // None of these values change while scrolling.
    let currentSize = avatarSize();
    let currentDock = dockedCenter(currentSize);
    let heroHeight = document.getElementById("home")?.offsetHeight ?? window.innerHeight;

    function remeasure() {
      currentSize = avatarSize();
      currentDock = dockedCenter(currentSize);
      heroHeight = document.getElementById("home")?.offsetHeight ?? window.innerHeight;
    }
    window.addEventListener("resize", remeasure);
    window.addEventListener("orientationchange", remeasure);

    // The last layout read left in the loop, and it was a real one: reading
    // `window.scrollY` forces the browser to flush pending style/layout, and
    // the loop had just written `x`/`y`/`scale` on the previous frame — so
    // every single frame did a write-then-read across the boundary and paid
    // for a synchronous layout. Cached from a passive scroll listener instead;
    // the loop now only reads a number. (The comment above about removing the
    // `offsetHeight` reads was right about those and missed this one.)
    let scrollY = window.scrollY;
    function onScroll() {
      scrollY = window.scrollY;
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    function tick(now: number) {
      // Clamped: see MAX_FRAME_MS. One long frame must not become a jump.
      const dt = lastTime === null ? 16 : Math.min(now - lastTime, MAX_FRAME_MS);
      lastTime = now;

      const heroProgress = Math.min(1, Math.max(0, scrollY / (heroHeight * 0.9)));

      // How far the avatar travels toward the pointer.
      //
      // Mouse: scaled by how far past Hero the visitor has scrolled, exactly
      // as it always has been. A cursor is present the entire time, so
      // following it over the hero copy would be a distraction.
      //
      // Touch: a constant, and a high one. A finger is only on the screen
      // when its owner is deliberately moving it, so there is nothing to
      // distract from - and this is the behaviour asked for, a companion
      // that tracks the finger rather than acknowledging where it last was.
      // Short of 1 on purpose: combined with the 120ms smoothing below, the
      // avatar trails the finger by a hair instead of sitting under it,
      // which is what makes it read as following rather than as a cursor.
      //
      // Nothing resets when the finger lifts. `pointermove` simply stops
      // arriving, the target stays where the finger left it, and the
      // smoothing carries the avatar the last of the way and settles it
      // there - no snap, no return.
      const follow = hasPointed.current ? (pointerFine ? heroProgress : TOUCH_FOLLOW) : 0;

      let fingerX = pointerRef.current.x;
      let fingerY = pointerRef.current.y;
      if (predict && hasPointed.current && sampleT !== null) {
        // Coast the target along the decaying measured velocity, then clamp
        // its lead over the last real sample. `dt` is the real clamped frame
        // time, so this is frame-rate independent like the smoothing below.
        predicted.x += vel.x * dt;
        predicted.y += vel.y * dt;
        const decay = Math.exp(-dt / TOUCH_VEL_DECAY_TAU_MS);
        vel.x *= decay;
        vel.y *= decay;
        const leadX = predicted.x - sampleX;
        const leadY = predicted.y - sampleY;
        const lead = Math.hypot(leadX, leadY);
        if (lead > TOUCH_PREDICT_MAX_PX) {
          predicted.x = sampleX + (leadX / lead) * TOUCH_PREDICT_MAX_PX;
          predicted.y = sampleY + (leadY / lead) * TOUCH_PREDICT_MAX_PX;
        }
        fingerX = predicted.x;
        fingerY = predicted.y;
      }

      const targetCenterX = lerp(currentDock.x, fingerX, follow);
      const targetCenterY = lerp(currentDock.y, fingerY, follow);
      const targetScale = lerp(1, COMPANION_SCALE, heroProgress);
      const targetX = targetCenterX - currentSize / 2;
      const targetY = targetCenterY - currentSize / 2;

      // Frame-rate independent by construction: `alpha` is derived from the
      // real elapsed time, so a 30fps device covers the same ground per
      // millisecond as a 120fps one. Position gets the responsive tau on
      // touch; scale keeps the slower one either way, since it is driven by
      // scroll rather than by the finger and a snappy scale reads as jitter.
      const positionTau = pointerFine ? SMOOTHING_TAU_MS : TOUCH_SMOOTHING_TAU_MS;
      const alpha = 1 - Math.exp(-dt / positionTau);
      const scaleAlpha = 1 - Math.exp(-dt / SMOOTHING_TAU_MS);
      x.set(x.get() + (targetX - x.get()) * alpha);
      y.set(y.get() + (targetY - y.get()) * alpha);
      scale.set(scale.get() + (targetScale - scale.get()) * scaleAlpha);

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      untrack();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("orientationchange", remeasure);
    };
  }, [isDesktop, reduceMotion, introDone, modalOpen, x, y, scale]);

  if (!isDesktop || reduceMotion) return null;

  return (
    // Two nested transforms, and deliberately so.
    //
    // The inner one is the avatar's real position, owned by the intro clock
    // during the opening sequence and by the scroll/pointer loop afterwards.
    // The outer one is a small pointer-driven offset that only exists on the
    // opening screen, where the inner position is not available to write to:
    // the clock parks there waiting for the visitor, and the moment they
    // press the arrow it resumes and flies the avatar to its dock. A follow
    // loop writing the same x/y would be fighting that flight. Layering the
    // offset on a separate element means the two can never collide, and it
    // is bounded so the avatar leans within its own composition rather than
    // wandering off toward the continue button.
    <motion.div
      style={{ x: introFollowX, y: introFollowY }}
      className={`pointer-events-none fixed top-0 left-0 ${introDone ? "z-40" : "z-[110]"}`}
      aria-hidden="true"
    >
    <motion.div
      // `will-change: transform` is justified here in a way it is not on the
      // rest of the site (see §11): this element's transform is rewritten on
      // literally every frame for the whole visit, which is exactly the case
      // the hint exists for. It keeps the avatar on its own compositor layer
      // so its movement never asks for a repaint of anything beneath it.
      // One element, not a blanket hint.
      style={{ x, y, scale, opacity, width: size, height: size, willChange: "transform" }}
      className="pointer-events-none absolute top-0 left-0"
      aria-hidden="true"
    >
      <Suspense fallback={null}>
        {/* Frozen only until the avatar has finished forming: the dot field
            drew this wireframe at rotation 0, so it must resolve in at
            rotation 0 or the two shapes won't line up. Once formed it wakes
            and tracks the cursor for the rest of the opening screen, and
            keeps tracking straight through the reveal into the live site —
            same component, same pose, so there is no handoff to see. */}
        <DeveloperAvatarScene reduceMotion={Boolean(reduceMotion)} frozen={!awake} paused={modalOpen} />
      </Suspense>
    </motion.div>
    </motion.div>
  );
}
