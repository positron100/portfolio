import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

const TYPE_SPEED_MS = 55;
const DELETE_SPEED_MS = 28;
const HOLD_MS = 1500;
const GAP_MS = 450;

/** Types each word out, holds it, deletes it, then moves to the next —
 * a single self-contained timeout loop rather than a phase/reducer state
 * machine, since the whole sequence is linear. Collapses to the first word,
 * static, under reduced motion. */
export function useTypewriterCycle(words: readonly string[]): string {
  const [display, setDisplay] = useState(words[0] ?? "");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || words.length <= 1) {
      setDisplay(words[0] ?? "");
      return;
    }

    let cancelled = false;
    let timeoutId: number;

    function step(wordIndex: number, charIndex: number, phase: "type" | "delete") {
      if (cancelled) return;
      const word = words[wordIndex];

      if (phase === "type") {
        setDisplay(word.slice(0, charIndex));
        if (charIndex < word.length) {
          timeoutId = window.setTimeout(() => step(wordIndex, charIndex + 1, "type"), TYPE_SPEED_MS + Math.random() * 40);
        } else {
          timeoutId = window.setTimeout(() => step(wordIndex, charIndex, "delete"), HOLD_MS);
        }
      } else {
        setDisplay(word.slice(0, charIndex));
        if (charIndex > 0) {
          timeoutId = window.setTimeout(() => step(wordIndex, charIndex - 1, "delete"), DELETE_SPEED_MS);
        } else {
          const nextIndex = (wordIndex + 1) % words.length;
          timeoutId = window.setTimeout(() => step(nextIndex, 1, "type"), GAP_MS);
        }
      }
    }

    timeoutId = window.setTimeout(() => step(0, 1, "type"), 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [words, reduceMotion]);

  return display;
}
