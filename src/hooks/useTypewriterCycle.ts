import { useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotion } from "framer-motion";

const TYPE_SPEED_MS = 55;
const DELETE_SPEED_MS = 28;
const HOLD_MS = 1500;
const GAP_MS = 450;

/** Types each word out, holds it, deletes it, then moves to the next —
 * a single self-contained timeout loop rather than a phase/reducer state
 * machine, since the whole sequence is linear. Collapses to the first word,
 * static, under reduced motion.
 *
 * The chain is **suspended whenever the text is not actually on screen** —
 * scrolled past, or in a backgrounded tab. It has no terminal state, so
 * without that it re-rendered a React component every 28–55ms for the entire
 * visit, and each of those renders mutated a text node and dirtied style and
 * layout on the next frame. Measured at 390x844 / 4x CPU: 17 React render
 * passes in a 3s window with the visitor doing nothing at all.
 *
 * Suspension resumes the sequence exactly where it stopped rather than
 * restarting the word — nothing about the visible animation changes, because
 * by definition nothing was visible while it was paused.
 *
 * Returns the ref to attach to the element whose visibility gates the chain.
 */
export function useTypewriterCycle(
  words: readonly string[],
): [string, RefObject<HTMLSpanElement | null>] {
  const [display, setDisplay] = useState(words[0] ?? "");
  const reduceMotion = useReducedMotion();
  const nodeRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (reduceMotion || words.length <= 1) {
      setDisplay(words[0] ?? "");
      return;
    }

    let cancelled = false;
    let timeoutId: number;
    // The next step, held rather than scheduled while off screen. Resuming is
    // just running it: the chain carries its own position in its arguments.
    let pending: (() => void) | null = null;
    let onScreen = true;

    function active() {
      return onScreen && !document.hidden;
    }

    function schedule(run: () => void, delay: number) {
      if (!active()) {
        pending = run;
        return;
      }
      timeoutId = window.setTimeout(run, delay);
    }

    function step(wordIndex: number, charIndex: number, phase: "type" | "delete") {
      if (cancelled) return;
      const word = words[wordIndex];
      const next = word.slice(0, charIndex);
      // The type→hold→delete boundary emits the same full string on both
      // sides, so an unguarded set asks React to render for a value it will
      // only bail out on.
      setDisplay((prev) => (prev === next ? prev : next));

      if (phase === "type") {
        if (charIndex < word.length) {
          schedule(() => step(wordIndex, charIndex + 1, "type"), TYPE_SPEED_MS + Math.random() * 40);
        } else {
          schedule(() => step(wordIndex, charIndex, "delete"), HOLD_MS);
        }
      } else {
        if (charIndex > 0) {
          schedule(() => step(wordIndex, charIndex - 1, "delete"), DELETE_SPEED_MS);
        } else {
          const nextIndex = (wordIndex + 1) % words.length;
          schedule(() => step(nextIndex, 1, "type"), GAP_MS);
        }
      }
    }

    function resume() {
      if (cancelled || !active() || !pending) return;
      const run = pending;
      pending = null;
      run();
    }

    const node = nodeRef.current;
    const visibility = node
      ? new IntersectionObserver(
          (entries) => {
            onScreen = entries.some((entry) => entry.isIntersecting);
            if (onScreen) resume();
          },
          { rootMargin: "120px" },
        )
      : null;
    visibility?.observe(node!);

    function handleVisibility() {
      if (!document.hidden) resume();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    timeoutId = window.setTimeout(() => step(0, 1, "type"), 400);
    return () => {
      cancelled = true;
      pending = null;
      window.clearTimeout(timeoutId);
      visibility?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [words, reduceMotion]);

  return [display, nodeRef];
}
