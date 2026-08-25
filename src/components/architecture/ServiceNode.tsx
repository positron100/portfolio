import { motion, useReducedMotion } from "framer-motion";
import { useMagnetic } from "@/hooks/useMagnetic";
import { spring, scaleTap } from "@/utils/motion";
import { cn } from "@/utils/cn";

export type NodeTone = "spine" | "service" | "bus" | "infra" | "boundary" | "scheduled";

interface ServiceNodeProps {
  id: string;
  label: string;
  tone?: NodeTone;
  isFocused: boolean;
  /** True when something else has focus and this node is not part of it. */
  isMuted: boolean;
  /** True when this node is on the other end of a connection from the
   * focused one. It picks up a tint of the accent, so the answer to "what
   * does this talk to" is legible from the nodes alone, without tracing
   * every line back. */
  isRelated?: boolean;
  onFocus: (id: string | null) => void;
  onSelect: (id: string) => void;
  registerRef: (el: HTMLElement | null) => void;
  className?: string;
}

const toneClass: Record<NodeTone, string> = {
  // The spine carries the request path, so it reads heaviest.
  spine: "border-border-strong bg-bg-elevated text-fg font-semibold",
  service: "border-border bg-bg-elevated text-fg-muted",
  // The bus is the one node that is a *mechanism*, not a service - the
  // secondary accent is what separates event flow from request flow
  // everywhere in this map, including its connection lines.
  bus: "border-accent-secondary/40 bg-accent-secondary-soft text-accent-secondary font-semibold",
  // Supporting infrastructure: dashed, so it never reads as a request hop.
  infra: "border-dashed border-border-strong bg-transparent text-fg-faint",
  boundary: "border-accent/50 bg-accent-soft text-accent font-semibold",
  // The scheduled worker. Dashed for the same reason the registry is - it
  // never sits in a request - but at full text weight, because unlike the
  // registry it is a service doing real work. That one borrowed cue is what
  // separates it from the business services beside it at a glance.
  scheduled: "border-dashed border-border-strong bg-bg-elevated text-fg-muted",
};

/**
 * A single addressable box in the system map.
 *
 * Every node is a real `<button>`: the map is navigable by keyboard and
 * works on touch, where hover does not exist. Focus follows the pointer on
 * desktop and the tap on mobile, through the same one-node-at-a-time model.
 */
export function ServiceNode({
  id,
  label,
  tone = "service",
  isFocused,
  isMuted,
  isRelated = false,
  onFocus,
  onSelect,
  registerRef,
  className,
}: ServiceNodeProps) {
  const reduceMotion = useReducedMotion();
  // The same pull every other selector on the site uses, at the gentlest
  // strength - these sit close together and a strong pull would read as drift.
  const magnetic = useMagnetic({ strength: 4, squash: true });

  return (
    <motion.button
      ref={(el: HTMLButtonElement | null) => {
        magnetic.attach(el);
        registerRef(el);
      }}
      type="button"
      onMouseMove={magnetic.onMouseMove}
      onMouseEnter={() => onFocus(id)}
      onMouseLeave={() => {
        magnetic.onMouseLeave();
        onFocus(null);
      }}
      onFocus={() => onFocus(id)}
      onBlur={() => onFocus(null)}
      onClick={() => onSelect(id)}
      style={magnetic.style}
      animate={reduceMotion ? undefined : { opacity: isMuted ? 0.35 : 1 }}
      whileHover={reduceMotion ? undefined : { y: -2, transition: spring.snappy }}
      whileTap={scaleTap}
      transition={spring.soft}
      aria-pressed={isFocused}
      className={cn(
        // `touch-manipulation` because these are tapped in sequence on a
        // phone, and the double-tap-zoom delay would make every one of them
        // feel a beat late.
        "relative touch-manipulation rounded-xl border px-3 py-2 text-center text-xs transition-colors sm:text-[13px]",
        toneClass[tone],
        isRelated && !isFocused && "border-accent/45",
        isFocused && "border-accent text-accent",
        className,
      )}
    >
      {label}
    </motion.button>
  );
}
