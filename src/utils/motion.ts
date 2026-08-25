import type { Transition, Variants } from "framer-motion";

/** Durations, in seconds — one scale used everywhere. */
export const duration = {
  micro: 0.15,
  fast: 0.25,
  base: 0.4,
  section: 0.6,
  cinematic: 0.9,
} as const;

/** Cubic-bezier easing curves — premium, no linear/default easing anywhere. */
export const ease = {
  standard: [0.16, 1, 0.3, 1],
  entrance: [0.22, 1, 0.36, 1],
  exit: [0.4, 0, 1, 1],
} as const;

export const spring = {
  snappy: { type: "spring", stiffness: 500, damping: 32 } satisfies Transition,
  soft: { type: "spring", stiffness: 260, damping: 28 } satisfies Transition,
  indicator: { type: "spring", stiffness: 380, damping: 34 } satisfies Transition,
} as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.section, ease: ease.standard },
  },
};

export const staggerContainer = (stagger = 0.08, delayChildren = 0): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

export const scaleTap = { scale: 0.96 };
export const liftHover = { y: -4 };

/** Small springy hover lift for nav items, tags, and other inline controls. */
export const hoverLift = { y: -2 };

/**
 * Word-by-word reveal for a promoted statement (About's editorial rework):
 * built on the same `staggerContainer` + `fadeUp` primitives above, just a
 * tighter stagger/duration suited to short words rather than whole blocks.
 */
export const wordReveal = (stagger = 0.035): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger } },
});

export const wordItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.165, 0.84, 0.44, 1] },
  },
};

/**
 * Hover-fill row treatment (EngineeringPrinciples' row-list redesign): the
 * row's background and horizontal padding both animate on hover, giving the
 * "row fills and expands toward the reader" feel without touching layout
 * height (padding-inline only, never padding-block).
 */
export const rowFill: Variants = {
  rest: { backgroundColor: "transparent", paddingLeft: "0.5rem", paddingRight: "0.5rem" },
  hover: { backgroundColor: "var(--bg-subtle)", paddingLeft: "1.25rem", paddingRight: "1rem" },
};

/**
 * The site's "physical response" language — small, reason-driven reactions
 * to a click/focus/hover rather than decorative constant motion. Reused
 * anywhere an element should feel touched rather than just re-styled.
 */
export const jiggle = {
  /** A field/card settling once, the first time it's meaningfully focused. */
  settle: { x: [0, -1.5, 1.5, 0] },
  settleTransition: { duration: 0.28, ease: "easeInOut" } satisfies Transition,
  /** Validation-error shake — fast, small, never the full field height. */
  shake: { x: [0, -6, 6, -4, 4, 0] },
  shakeTransition: { duration: 0.4, ease: "easeInOut" } satisfies Transition,
};

/** Press-and-settle for buttons: compress on tap, slight overshoot back. */
export const press = {
  whileTap: { scale: 0.94 },
  transition: { type: "spring", stiffness: 500, damping: 15 } satisfies Transition,
};

/** Card hover: lift plus a barely-there tilt — used sparingly (major cards only). */
export const cardTilt = { y: -6, rotateX: 2, rotateY: -2, transition: spring.soft };

/**
 * The circular theme reveal runs on the Web Animations API directly
 * (pseudo-elements aren't reachable through Framer Motion), so its timing
 * lives here in WAAPI's own units (milliseconds) rather than the
 * seconds-based `duration`/`ease` tokens above.
 */
export const viewTransition = {
  durationMs: 800,
  easing: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;
