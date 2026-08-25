import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * A calm, mostly-static backdrop for the closing section — deliberately
 * simpler than the Hero's canvas (fewer elements, no particle simulation)
 * so the page's energy visibly settles as the user arrives at the end.
 * The only "live" piece is a radial glow that follows the pointer, done via
 * a direct CSS custom-property write (no React state, no rAF loop).
 */
export function ContactBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const el = containerRef.current;
    if (!el) return;

    function handlePointerMove(event: PointerEvent) {
      const rect = el!.getBoundingClientRect();
      el!.style.setProperty("--px", `${event.clientX - rect.left}px`);
      el!.style.setProperty("--py", `${event.clientY - rect.top}px`);
    }

    el.addEventListener("pointermove", handlePointerMove);
    return () => el.removeEventListener("pointermove", handlePointerMove);
  }, [reduceMotion]);

  return (
    <div ref={containerRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(480px circle at var(--px, 50%) var(--py, 15%), color-mix(in srgb, var(--accent) 7%, transparent), transparent 70%)",
        }}
      />

      <svg
        className="absolute inset-0 h-full w-full text-border"
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <g stroke="currentColor" strokeWidth="1" opacity="0.5">
          <path d="M120 80 L420 260" />
          <path d="M1080 100 L780 270" />
          <path d="M180 520 L440 300" />
          <path d="M1040 500 L790 300" />
          <path d="M420 260 L600 320" />
          <path d="M780 270 L600 320" />
          <path d="M440 300 L600 320" />
          <path d="M790 300 L600 320" />
        </g>
        <g fill="currentColor" opacity="0.6">
          <circle cx="120" cy="80" r="2.5" />
          <circle cx="1080" cy="100" r="2.5" />
          <circle cx="180" cy="520" r="2.5" />
          <circle cx="1040" cy="500" r="2.5" />
          <circle cx="420" cy="260" r="2" />
          <circle cx="780" cy="270" r="2" />
          <circle cx="440" cy="300" r="2" />
          <circle cx="790" cy="300" r="2" />
        </g>
        <circle cx="600" cy="320" r="3" fill="var(--accent)" opacity="0.8" />
      </svg>
    </div>
  );
}
