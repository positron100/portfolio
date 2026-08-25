/** Longest a jump may take, however far it travels. */
const MAX_DURATION_MS = 850;
const MIN_DURATION_MS = 420;

let activeScroll: number | null = null;
/** Tears down the in-flight run's abort listeners. Held at module scope
 * because a superseding call has to remove the previous run's listeners as
 * well as stop its frame — dragging across the navbar fires this many times
 * a second, and without this each superseded run left its wheel/touch/key
 * listeners attached for the life of the page. */
let releaseActive: (() => void) | null = null;

function cancelActiveScroll() {
  if (activeScroll !== null) cancelAnimationFrame(activeScroll);
  activeScroll = null;
  releaseActive?.();
  releaseActive = null;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Scrolls a section into view over a bounded, predictable duration.
 *
 * The browser's own smooth scroll sizes its duration from the distance, and
 * this page is tall: Hero → Contact is ~6,000px, which Chrome animates with a
 * very long decelerating tail — measured at over 1.2s and still creeping,
 * having covered the last 400px at a crawl. It arrives eventually, but it
 * reads as though the button did nothing, or as though the page stopped
 * somewhere in the middle. Short hops like Hero → Projects finished quickly,
 * which is why only the longest jump looked broken.
 *
 * Driving it here instead means the far end of the page takes the same
 * fraction of a second as the near end. `behavior: "instant"` on each frame
 * is deliberate — the global `scroll-behavior: smooth` would otherwise try to
 * animate every one of these steps in turn.
 */
export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;

  history.replaceState(null, "", `#${id}`);

  const start = window.scrollY;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const target = Math.min(el.getBoundingClientRect().top + start, maxScroll);
  const distance = target - start;

  cancelActiveScroll();

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || Math.abs(distance) < 2) {
    window.scrollTo({ top: target, behavior: "instant" });
    return;
  }

  const duration = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Math.abs(distance) * 0.32));
  const startTime = performance.now();

  // Any real scroll input hands control straight back to the visitor rather
  // than fighting them for the rest of the animation.
  function abort() {
    cancelActiveScroll();
  }
  function detach() {
    window.removeEventListener("wheel", abort);
    window.removeEventListener("touchstart", abort);
    window.removeEventListener("keydown", abort);
  }
  window.addEventListener("wheel", abort, { passive: true });
  window.addEventListener("touchstart", abort, { passive: true });
  window.addEventListener("keydown", abort);
  releaseActive = detach;

  function step(now: number) {
    const t = Math.min(1, (now - startTime) / duration);
    window.scrollTo({ top: start + distance * easeInOutCubic(t), behavior: "instant" });
    if (t < 1) {
      activeScroll = requestAnimationFrame(step);
      return;
    }
    activeScroll = null;
    detach();
    releaseActive = null;
  }
  activeScroll = requestAnimationFrame(step);
}
