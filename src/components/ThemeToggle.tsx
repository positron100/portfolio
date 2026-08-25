import { useRef } from "react";
import { motion, useTransform } from "framer-motion";
import type { Theme } from "@/hooks/useTheme";
import { useThemeToggleController } from "@/hooks/useThemeToggleController";

interface ThemeToggleProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const KNOB_TRAVEL_PX = 22;

export function ThemeToggle({ theme, setTheme }: ThemeToggleProps) {
  // The reveal opens from the thumb, not from the middle of the track. On a
  // phone the thumb is what the finger is on, and the two are up to 11px
  // apart — enough to read as starting from the wrong place on a small
  // screen. Measured live at each gesture, so it is correct at any scroll
  // position and part-way through a drag.
  const knobRef = useRef<HTMLSpanElement>(null);
  const { darkness, handleClick, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel } =
    useThemeToggleController(theme, setTheme, knobRef);

  const knobX = useTransform(darkness, [0, 1], [0, KNOB_TRAVEL_PX]);

  const sunOpacity = useTransform(darkness, [0, 0.5, 1], [1, 0, 0]);
  const sunRotate = useTransform(darkness, [0, 1], [0, 80]);
  const sunScale = useTransform(darkness, [0, 1], [1, 0.4]);

  const moonOpacity = useTransform(darkness, [0, 0.5, 1], [0, 0, 1]);
  const moonRotate = useTransform(darkness, [0, 1], [-80, 0]);
  const moonScale = useTransform(darkness, [0, 1], [0.4, 1]);

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={theme === "dark"}
      // Plain: a neutral track and a neutral border, with a normal
      // border-colour hover the same as every other bordered control on the
      // site. No glow of any kind — no box-shadow ring, no accent-tinted
      // border, no blur, no filter, no pseudo-element — and no accent fill in
      // the track either. Nothing is drawn outside the control's own shape.
      className="relative flex h-8 w-14 shrink-0 touch-none items-center rounded-full border border-border bg-bg-subtle px-1 transition-colors select-none hover:border-border-strong"
    >
      <motion.span
        ref={knobRef}
        style={{ x: knobX }}
        className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-bg-elevated text-fg shadow-sm"
      >
        <motion.span
          style={{ opacity: sunOpacity, rotate: sunRotate, scale: sunScale }}
          className="absolute flex items-center justify-center"
        >
          <SunIcon />
        </motion.span>
        <motion.span
          style={{ opacity: moonOpacity, rotate: moonRotate, scale: moonScale }}
          className="absolute flex items-center justify-center"
        >
          <MoonIcon />
        </motion.span>
      </motion.span>
    </button>
  );
}

function SunIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
