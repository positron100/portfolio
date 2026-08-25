import type { ReactNode, Ref } from "react";
import { motion } from "framer-motion";
import { useMagnetic } from "@/hooks/useMagnetic";

interface MagneticProps {
  children: ReactNode;
  strength?: number;
  className?: string;
  /** Neutralizes the pull and springs back to rest while true. Used when
   * another gesture owns the element's movement — the opening sequence's
   * arrow button hands its transform over to the drag-to-reveal scrub, and
   * two systems must never write conflicting offsets at once. */
  disabled?: boolean;
  /** Adds the liquid squash-and-stretch. Off by default so the Hero CTAs
   * keep exactly the motion they had. */
  squash?: boolean;
}

/**
 * Wraps a control so it drifts subtly toward the cursor.
 *
 * A thin shell over `useMagnetic` — use the hook directly on any element that
 * already is a motion element with its own animations, and this wrapper for
 * plain children that just need the pull.
 */
export function Magnetic({ children, strength = 14, className, disabled = false, squash = false }: MagneticProps) {
  const { ref, onMouseMove, onMouseLeave, style } = useMagnetic({ strength, disabled, squash });

  return (
    <motion.div
      ref={ref as Ref<HTMLDivElement>}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={style}
      className={className ?? "inline-block"}
    >
      {children}
    </motion.div>
  );
}
