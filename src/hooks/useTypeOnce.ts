import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

const TYPE_SPEED_MS = 46;
/** Added at random per character. Enough that the rhythm isn't metronomic,
 * small enough that it never reads as hesitation. */
const TYPE_JITTER_MS = 34;
/** A short beat before the first character, so the caret is visibly waiting
 * rather than typing the instant it appears. */
const LEAD_IN_MS = 180;

/**
 * Types a single string out once, character by character, starting only when
 * `start` turns true — the opening sequence gates it on the avatar being
 * fully formed and settled.
 *
 * A sibling to `useTypewriterCycle` rather than a reworking of it: that one
 * cycles a list, deleting and moving on, and drives itself from mount. This
 * types one string, once, on an external cue, and leaves it standing. Same
 * approach though — one self-contained timeout chain slicing the string,
 * since the sequence is linear, and the whole thing collapses to the
 * finished text under reduced motion.
 */
export function useTypeOnce(text: string, start: boolean): { display: string; done: boolean } {
  const reduceMotion = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;
    if (reduceMotion) {
      setCount(text.length);
      return;
    }

    let cancelled = false;
    let timeoutId: number;

    function step(index: number) {
      if (cancelled) return;
      setCount(index);
      if (index >= text.length) return;
      timeoutId = window.setTimeout(() => step(index + 1), TYPE_SPEED_MS + Math.random() * TYPE_JITTER_MS);
    }

    timeoutId = window.setTimeout(() => step(1), LEAD_IN_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [text, start, reduceMotion]);

  return { display: text.slice(0, count), done: count >= text.length };
}
