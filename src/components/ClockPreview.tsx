import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/** Digits per strip, in strip order: h-tens, h-ones, m-tens, m-ones, s-tens, s-ones. */
const STRIP_LENGTHS = [3, 10, 6, 10, 6, 10] as const;
/** Height of one digit cell, in px. The strip travels in multiples of this. */
const CELL = 22;

function digitsForNow(now: Date) {
  const parts = [now.getHours(), now.getMinutes(), now.getSeconds()];
  return parts.flatMap((value) => [Math.floor(value / 10), value % 10]);
}

/**
 * A miniature of the actual Clock project.
 *
 * The repository is not an analog clock — it has no hands. It is a digital
 * clock built from six vertical strips of digits: each second, every strip is
 * translated so the correct digit sits in the window, and that digit is
 * highlighted for most of the second before being cleared, which is what
 * produces the ticking beat. This reproduces that mechanism rather than
 * inventing a different kind of clock, so the preview reads as a teaser of
 * the real thing.
 *
 * The palette is deliberately *not* the original's blue-grey neumorphism —
 * that would import a second design language into the page. The mechanism is
 * the recognisable part, so it is rendered in the portfolio's own accent and
 * surface tokens and stays correct in both themes.
 *
 * Only ever mounted while the Clock project is the selected one, so its
 * interval exists only while it is on screen — nothing ticks in the
 * background. Under reduced motion the strips are placed without transitions,
 * so it still shows the right time but never animates.
 */
export function ClockPreview() {
  const reduceMotion = useReducedMotion();
  const [digits, setDigits] = useState(() => digitsForNow(new Date()));

  useEffect(() => {
    const id = window.setInterval(() => setDigits(digitsForNow(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      aria-label="Preview of the Clock project"
      role="img"
      className="flex items-center gap-2 rounded-xl border border-border bg-bg-subtle px-4 py-3"
    >
      {STRIP_LENGTHS.map((length, stripIndex) => (
        <div key={stripIndex} className="contents">
          <div
            // The window: one cell tall, with the strip sliding behind it.
            // A fixed height is correct here — a digit cell is a fixed size
            // by definition, and nothing variable-length lives inside.
            className="overflow-hidden rounded-md bg-bg-elevated"
            style={{ height: CELL, width: CELL }}
          >
            <div
              className={reduceMotion ? undefined : "transition-transform duration-500 ease-in-out"}
              style={{ transform: `translateY(${-digits[stripIndex] * CELL}px)` }}
            >
              {Array.from({ length }, (_, digit) => (
                <div
                  key={digit}
                  style={{ height: CELL, width: CELL }}
                  className={
                    digit === digits[stripIndex]
                      ? "grid place-items-center font-mono text-xs font-semibold text-accent"
                      : "grid place-items-center font-mono text-xs text-fg-faint"
                  }
                >
                  {digit}
                </div>
              ))}
            </div>
          </div>
          {/* Separators after the hour and minute pairs, matching the
              original's three grouped columns. */}
          {(stripIndex === 1 || stripIndex === 3) && (
            <span className="font-mono text-xs text-fg-faint">:</span>
          )}
        </div>
      ))}
    </div>
  );
}
