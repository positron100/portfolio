import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/utils/cn";

export interface StackCard {
  /** Stable across shuffles — the same skill must reuse the same card. */
  id: string;
  /** Small accent line above the title (the category, or the skill count). */
  meta: string;
  title: string;
  body: string;
}

/** How many cards stay on screen behind the active one. */
export const STACK_DEPTH = 4;

/** Resting pose per depth. Index 0 is the card on top. */
const DEPTH_POSE = [
  { y: 0, x: 0, rotate: 0, scale: 1, opacity: 1 },
  { y: 14, x: 7, rotate: -1.6, scale: 0.962, opacity: 0.72 },
  { y: 26, x: 12, rotate: -2.8, scale: 0.93, opacity: 0.46 },
  { y: 36, x: 16, rotate: -3.7, scale: 0.902, opacity: 0.24 },
];

/** Where a card that has never been seen before rises from. */
const ENTER_POSE = { y: 46, x: 20, rotate: -4.6, scale: 0.88, opacity: 0 };

const SHUFFLE_SPRING = { type: "spring", stiffness: 340, damping: 30, mass: 0.85 } as const;

/**
 * A physical deck of skill descriptions. `cards[0]` is the active skill and
 * sits on top; everything behind it is what was looked at before, fanned out
 * just enough to read as depth.
 *
 * Rapid hovering is safe by construction. A card's target pose is a pure
 * function of its index in `cards`, and every card stays mounted for as long
 * as it is in the deck, so changing skills only re-aims springs that are
 * already running — framer retargets them from wherever they currently are.
 * Nothing waits for a previous animation to land, nothing unmounts mid-flight,
 * and because `zIndex` is read from that same index it can never disagree with
 * the pose. Skimming across ten skills just means ten retargets.
 */
export function SkillCardStack({ cards, className }: { cards: StackCard[]; className?: string }) {
  const reduceMotion = useReducedMotion();
  const visible = cards.slice(0, STACK_DEPTH);

  const top = visible[0];

  return (
    // Outer box reserves the room the fan needs below the deck, so the
    // offset cards behind the active one sit *inside* the component's own
    // footprint instead of bleeding out over whatever follows it.
    // `overflow-hidden` bounds the deck to its own footprint. The fan's y
    // offsets fit inside the padding, but the rotated corner of the deepest
    // card sticks out by half the card's width times sin(its angle) — which
    // grows with the card, so no fixed padding can cover every layout (10px
    // at 320px wide, 23px at full width). Clipping trims only those corners,
    // which sit behind the front card anyway.
    <div className={cn("relative h-fit overflow-hidden pb-9", className)}>
      {/* The deck had every card absolutely positioned, which left this
          container with no content at all — it collapsed to a hard-coded
          `min-h`, and any card taller than that guess simply hung out of the
          bottom (measured: 45px past its own box on mobile). This invisible
          copy of the active card puts one card's worth of real content back
          into normal flow, so the box is always exactly as tall as what it
          is showing, at every width, with no magic number. */}
      <div className="relative">
        <div aria-hidden="true" className="invisible rounded-2xl border p-6">
          <span className="block font-mono text-xs tracking-widest uppercase">{top?.meta}</span>
          <h3 className="mt-2 text-lg font-semibold">{top?.title}</h3>
          <p className="mt-2 text-sm leading-relaxed">{top?.body}</p>
        </div>

        {visible.map((card, depth) => {
        const pose = DEPTH_POSE[Math.min(depth, DEPTH_POSE.length - 1)];
        const isTop = depth === 0;
        return (
          <motion.article
            key={card.id}
            initial={reduceMotion ? false : ENTER_POSE}
            animate={
              reduceMotion
                ? { ...pose, rotate: 0, x: 0, y: Math.min(pose.y, 8) }
                : pose
            }
            transition={reduceMotion ? { duration: 0.15 } : SHUFFLE_SPRING}
            // Straight from the depth index, so the paint order can never
            // drift out of step with the animated pose.
            style={{ zIndex: STACK_DEPTH - depth, transformOrigin: "50% 100%" }}
            // Only the front card is real content for assistive tech; the
            // ones behind it are decoration left over from earlier hovers.
            aria-hidden={!isTop}
            // `inset-0`, not `top-0`: every card is exactly the sizer's box,
            // so a card behind with longer copy can never grow taller than
            // the one in front and poke out from under it. Its own overflow
            // is clipped by the rounded corner — the cards behind are
            // decoration, and only the front one is ever read.
            className={
              "absolute inset-0 overflow-hidden rounded-2xl border border-border bg-bg-elevated p-6 " +
              (isTop ? "shadow-[0_10px_30px_-18px_rgb(0_0_0/0.45)]" : "")
            }
          >
            {/* Only the front card shows its words. The cards behind are
                offset downward, so their lower portion sits below the front
                one — with their text rendered that strip read as a jumble of
                half-sentences rather than as a deck. Depth is carried by the
                card surfaces alone, and the copy fades in exactly as a card
                arrives on top. */}
            <motion.div
              animate={{ opacity: isTop ? 1 : 0 }}
              transition={reduceMotion ? { duration: 0.15 } : SHUFFLE_SPRING}
            >
              <span className="font-mono text-xs tracking-widest text-accent uppercase">{card.meta}</span>
              <h3 className="mt-2 text-lg font-semibold">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{card.body}</p>
            </motion.div>
          </motion.article>
          );
        })}
      </div>
    </div>
  );
}
