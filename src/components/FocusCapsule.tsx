import type { Ref } from "react";
import { motion } from "framer-motion";
import { useMagnetic } from "@/hooks/useMagnetic";

/**
 * A focus-area capsule carrying the site's shared magnetic pull — the same
 * `useMagnetic` primitive behind the nav items and Hero CTAs, just at a
 * smaller strength suited to a chip, with the liquid squash enabled.
 *
 * Only the capsule under the cursor ever moves: the maths runs off this
 * element's own `mousemove`, so its neighbours are never told the pointer
 * went past and cannot drift in sympathy.
 */
export function FocusCapsule({ label }: { label: string }) {
  const { ref, onMouseMove, onMouseLeave, style } = useMagnetic({ strength: 6, squash: true });

  return (
    <motion.span
      ref={ref as Ref<HTMLSpanElement>}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={style}
      // Deliberately no `whileHover` y-lift: it would animate the very same
      // `y` motion value the magnetic pull owns, and on mouse-leave the two
      // raced — the capsule settled back to x:0 but stayed stuck at y:-2.
      // The pull is the hover response.
      className="inline-block cursor-default rounded-full border border-border bg-bg-subtle px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-accent hover:text-accent"
    >
      {label}
    </motion.span>
  );
}
