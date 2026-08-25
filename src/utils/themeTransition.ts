import { flushSync } from "react-dom";
import { viewTransition } from "@/utils/motion";
import type { Theme } from "@/hooks/useTheme";

export interface ThemeOrigin {
  x: number;
  y: number;
}

export interface ThemeRevealHandle {
  transition: ViewTransition;
  animation: Animation;
  enteringDark: boolean;
}

export function supportsViewTransitions(): boolean {
  return typeof document !== "undefined" && "startViewTransition" in document;
}

export function prefersReducedMotionNow(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Module-scoped (not per-hook-instance) because both the desktop and mobile
// nav render their own <ThemeToggle>, each running an independent
// controller — without a single shared guard, two overlapping gestures
// (or a drag and a stray click) could each start their own
// `document.startViewTransition()`. Each one holds a full-page GPU
// snapshot until it finishes; overlapping ones pile up rather than
// replacing each other, which is what turns "a bit janky" into the
// multi-second freeze / tab crash seen when transitions overlap.
let activeTransition: ViewTransition | null = null;
let activeAnimation: Animation | null = null;

/**
 * Starts a View Transition from the current theme to `next`, originating at
 * `origin` (the toggle button's center). Shared by both the plain-click
 * transition and the draggable-scrub controller — the only difference is
 * whether the resulting clip-path animation is left paused for manual
 * scrubbing or allowed to play on its own.
 *
 * Three things here specifically avoid flicker/flash:
 * 1. The theme attribute is applied synchronously inside the transition
 *    callback (not via a later effect), so the "new" snapshot the browser
 *    captures right after this callback already reflects the destination
 *    theme's real colors — otherwise it captures a stale/mid-fade frame
 *    and a visible repaint pops in once the transition finishes.
 * 2. `data-theme-transition` also suppresses the global color CSS
 *    transition (see index.css) for the duration of the reveal, so that
 *    transition can't be mid-flight when the snapshot is taken either.
 * 3. `--reveal-x`/`--reveal-y` are set *before* the pseudo-element tree is
 *    created, and index.css gives the entering layer an explicit starting
 *    `clip-path` at that origin. Without this, the pseudo-element briefly
 *    renders with no clip-path at all (its UA default) the instant it's
 *    created — which for light→dark means a full, unclipped dark layer
 *    flashes on top before our JS animation gets a chance to collapse it
 *    to a point. Dark→light doesn't show this because the unclipped
 *    default there happens to match the dark screen already on screen.
 */
export async function startThemeReveal(
  next: Theme,
  origin: ThemeOrigin,
  applyTheme: () => void,
  options: { paused?: boolean } = {},
): Promise<ThemeRevealHandle | null> {
  const enteringDark = next === "dark";
  const root = document.documentElement;

  // Never let two transitions run at once — skip whatever's still settling
  // before starting a new one (see the comment on `activeTransition`).
  try {
    activeAnimation?.cancel();
    activeTransition?.skipTransition();
  } catch {
    // Already settled — nothing to clean up.
  }
  activeAnimation = null;
  activeTransition = null;

  root.style.setProperty("--reveal-x", `${origin.x}px`);
  root.style.setProperty("--reveal-y", `${origin.y}px`);
  root.setAttribute("data-theme-transition", enteringDark ? "to-dark" : "to-light");

  const endRadius = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  );

  const transition = document.startViewTransition(() => {
    flushSync(applyTheme);
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });
  activeTransition = transition;
  // Captured locally (not read off `activeAnimation`) so this transition's
  // cleanup always tears down *its own* animation, even after a newer
  // gesture has already replaced the module-scoped ref.
  let ownAnimation: Animation | null = null;

  transition.finished.finally(() => {
    // A *finished* WAAPI animation with `fill: both` never stops applying
    // its end value, and one created with `pseudoElement` is bound to the
    // pseudo *selector*, not to a node — so it silently re-attaches to the
    // next view transition's freshly created ::view-transition-old/new(root)
    // and overrides both index.css's start clip-path and the new
    // animation's opening frames. That is why only the first transition
    // after a page load looked right: from the second on, the destination
    // layer rendered at its final clip (unclipped, or fully collapsed) the
    // instant the pseudo tree existed, flashing the whole page to the
    // destination theme before the circle had grown at all. Cancelling here
    // is visually inert — `finished` only resolves once the pseudo tree is
    // already gone.
    ownAnimation?.cancel();
    if (activeAnimation === ownAnimation) activeAnimation = null;

    // Only the *currently active* reveal may tear down the shared
    // `data-theme-transition` attribute. A superseded transition settles
    // asynchronously — after the newer `startThemeReveal` call has already
    // synchronously set the attribute for its own reveal — so removing it
    // unconditionally here wiped the live reveal's CSS (its start clip-path
    // and old/new z-index ordering) a frame in. That left the destination
    // theme unclipped and on top: light->dark flashed fully dark instantly,
    // and dark->light lost its retraction and simply snapped.
    if (activeTransition !== transition) return;
    root.removeAttribute("data-theme-transition");
    activeTransition = null;
  });

  try {
    await transition.ready;
  } catch {
    // Skipped/aborted (e.g. tab backgrounded) — applyTheme already ran via
    // flushSync above, so state is correct even without the visual reveal.
    return null;
  }

  const grow = [
    `circle(0px at ${origin.x}px ${origin.y}px)`,
    `circle(${endRadius}px at ${origin.x}px ${origin.y}px)`,
  ];

  const animation = root.animate(
    { clipPath: enteringDark ? grow : [...grow].reverse() },
    {
      duration: viewTransition.durationMs,
      easing: viewTransition.easing,
      pseudoElement: enteringDark ? "::view-transition-new(root)" : "::view-transition-old(root)",
      fill: "both",
    },
  );

  if (options.paused) {
    animation.pause();
  }

  activeAnimation = animation;
  ownAnimation = animation;
  animation.finished
    .catch(() => {
      // Cancelled (e.g. by a newer gesture skipping this transition).
    })
    .finally(() => {
      if (activeAnimation === animation) activeAnimation = null;
    });

  return { transition, animation, enteringDark };
}
