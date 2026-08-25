import { motion, useReducedMotion } from "framer-motion";
import { integrationDomains } from "@/data/platformArchitecture";
import { duration, ease } from "@/utils/motion";
import { cn } from "@/utils/cn";

interface IntegrationHubProps {
  /** True while the Third Party Service is the focused node. */
  expanded: boolean;
  hoveredDomainId: string | null;
  onHoverDomain: (id: string | null) => void;
  registerRef: (id: string) => (el: HTMLElement | null) => void;
}

/**
 * What sits behind the Third Party Service, drawn as a branch of it.
 *
 * This replaced a grid of vendor cards. Cards gave every provider its own
 * elevated surface, which put a third layer of boxes inside a box inside the
 * ecosystem panel and made the boundary service compete with its own
 * children. A rail with branch stubs carries the same hierarchy at a
 * fraction of the visual weight, and reads as part of the diagram rather
 * than as a second component parked underneath it.
 *
 * Every provider is rendered as soon as the tree opens rather than waiting
 * for its own category to be opened. Ten names is not enough content to
 * justify a second disclosure step, and revealing them per category would
 * change the panel's height on every hover - the one thing this layout must
 * not do. Hovering a category emphasises it instead: it brightens, its
 * branch lights up, and the others recede. Nothing moves.
 */
export function IntegrationHub({
  expanded,
  hoveredDomainId,
  onHoverDomain,
  registerRef,
}: IntegrationHubProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      // The tree is always in the layout, and only its opacity changes.
      //
      // Animating its height instead meant the ecosystem panel grew by 66px
      // the moment the pointer touched the boundary node, pushing the event
      // bus and everything below it down the page - on hover, which is far
      // too easy to trigger by accident. Holding the space costs a little
      // whitespace in the one cluster that had spare room, and buys a reveal
      // that cannot move anything: opacity and transform only, exactly the
      // budget the rest of this map runs on.
      aria-hidden={!expanded}
      className={expanded ? undefined : "pointer-events-none"}
      onMouseLeave={() => onHoverDomain(null)}
    >
      {/* Both states share one grid cell, so the taller of the two (the tree)
          sets the height and the cross-fade between them moves nothing. It
          also gives the reserved space something to say at rest instead of
          leaving a blank patch in the panel. */}
      <div className="grid [&>*]:[grid-area:1/1]">
        <motion.p
          animate={{ opacity: expanded ? 0 : 1 }}
          initial={false}
          transition={{ duration: reduceMotion ? 0 : duration.fast, ease: ease.standard }}
          className="mt-3 self-start text-[11px] leading-snug text-fg-faint"
        >
          {integrationDomains.length} integration domains sit behind this boundary.
        </motion.p>

        {/* No opacity on this wrapper: the branches carry their own, which is
            what lets them stagger in. Fading the parent as well would just
            multiply the two and flatten the sequence. */}
        <div>
          {/* Two columns, and vendor names only.
              A single-column tree with a note under every provider stood
              272px tall, which grew the ecosystem panel and shoved the event
              bus down the page every time the pointer touched the boundary
              node. Two columns of names roughly quarters that, so the
              expansion fits the headroom this cluster already has. The notes
              did not disappear: they move to the detail card below, which is
              outside the diagram and already resizes per node. */}
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
            {integrationDomains.map((domain, index) => {
              const isActive = hoveredDomainId === domain.id;
              const isDimmed = hoveredDomainId !== null && !isActive;
              return (
                <motion.li
                  key={domain.id}
                  ref={registerRef(`domain:${domain.id}`)}
                  initial={false}
                  // Driven by `expanded` rather than by mount, because the
                  // tree never unmounts now. Branches stagger in on open and
                  // back out on close, and the dim state rides the same
                  // opacity value.
                  animate={{
                    opacity: expanded ? (isDimmed ? 0.4 : 1) : 0,
                    x: expanded ? 0 : -6,
                  }}
                  transition={{
                    delay: reduceMotion || !expanded ? 0 : index * 0.05,
                    duration: reduceMotion ? 0 : duration.fast,
                    ease: ease.standard,
                  }}
                  onMouseEnter={() => onHoverDomain(domain.id)}
                  onFocus={() => onHoverDomain(domain.id)}
                  className={cn(
                    "relative border-l py-0.5 pl-2.5 transition-colors",
                    isActive ? "border-accent" : "border-border-strong",
                  )}
                >
                  {/* Branch stub. Widens and takes the accent while its
                      category is active, which is the "connection toward
                      that category" cue without another animated path. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-[0.6rem] left-0 h-px transition-all duration-300",
                      isActive ? "w-2.5 bg-accent" : "w-1.5 bg-border-strong",
                    )}
                  />
                  <button
                    type="button"
                    // Focusable so the tree is reachable by keyboard, where
                    // there is no hover to drive it.
                    onFocus={() => onHoverDomain(domain.id)}
                    className={cn(
                      "block text-left text-[11px] font-semibold transition-colors",
                      isActive ? "text-accent" : "text-fg",
                    )}
                  >
                    {domain.label}
                  </button>

                  <span className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                    {domain.vendors.map((vendor, vendorIndex) => (
                      <motion.span
                        key={vendor.name}
                        initial={false}
                        animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -4 }}
                        transition={{
                          delay:
                            reduceMotion || !expanded
                              ? 0
                              : index * 0.05 + 0.06 + vendorIndex * 0.035,
                          duration: reduceMotion ? 0 : duration.fast,
                          ease: ease.standard,
                        }}
                        className="inline-flex items-center gap-1"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "h-[3px] w-[3px] shrink-0 rounded-full transition-colors",
                            isActive ? "bg-accent" : "bg-fg-faint",
                          )}
                        />
                        <span className="font-mono text-[10.5px] leading-snug text-fg-muted">
                          {vendor.name}
                        </span>
                      </motion.span>
                    ))}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
