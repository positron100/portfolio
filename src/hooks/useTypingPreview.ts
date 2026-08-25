import { useEffect, useState } from "react";

/**
 * Types `text` out one character at a time while `active` is true — used
 * for a ghost/example-text preview inside an empty field. Resets to empty
 * the instant `active` goes false, so real typing (which flips `active`
 * off via the "only when empty" check upstream) always wins immediately.
 */
export function useTypingPreview(text: string, active: boolean, speedMs = 45): string {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (!active) {
      setDisplay("");
      return;
    }

    let cancelled = false;
    let timeoutId: number;

    function typeNext(index: number) {
      if (cancelled) return;
      setDisplay(text.slice(0, index));
      if (index < text.length) {
        // Small random jitter so it reads as typed, not mechanically ticked.
        timeoutId = window.setTimeout(() => typeNext(index + 1), speedMs + Math.random() * 35);
      }
    }

    timeoutId = window.setTimeout(() => typeNext(1), 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [active, text, speedMs]);

  return display;
}
