import { useEffect, useState } from "react";

/** Distance from the bottom (px) inside which "there is more below" stops being true. */
const END_SLACK = 40;

/**
 * Replaces the page scrollbar: a small round button with a down arrow, wearing
 * the site's orbit + breathing glow and a periodic nudge. It shows only while
 * there is more page below the fold, and pages down on click. Scrolling itself
 * stays fully native (the bar is just hidden in CSS).
 */
export function ScrollDownHint({ enabled }: { enabled: boolean }) {
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const check = () => {
      const el = document.documentElement;
      const next = el.scrollHeight - el.clientHeight > 2 && window.scrollY + window.innerHeight < el.scrollHeight - END_SLACK;
      setMore((prev) => (prev === next ? prev : next));
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    // Content height changes (fonts, images, lazy sections) without any scroll event.
    const ro = new ResizeObserver(check);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      ro.disconnect();
    };
  }, [enabled]);

  const show = enabled && more;

  return (
    <button
      type="button"
      aria-label="Scroll down"
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      onClick={() =>
        window.scrollBy({
          top: window.innerHeight * 0.85,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        })
      }
      className={`cp-attn fixed bottom-6 left-1/2 z-30 grid h-11 w-11 -translate-x-1/2 place-items-center rounded-full border bg-bg/60 text-fg backdrop-blur-[3px] transition-opacity duration-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        show ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <svg
        className="cp-nudge-down"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 5v14M6 13l6 6 6-6" />
      </svg>
    </button>
  );
}
