import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { principles } from "@/data/architecture";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/utils/cn";
import { spring, rowFill } from "@/utils/motion";

export function EngineeringPrinciples() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul>
      {principles.map((principle, index) => {
        const isOpen = openId === principle.id;
        return (
          <Reveal
            key={principle.id}
            as="li"
            delay={(index % 3) * 0.05}
            className={cn("border-border", index > 0 && "border-t")}
          >
            <motion.button
              type="button"
              onClick={() => setOpenId(isOpen ? null : principle.id)}
              onMouseEnter={() => setOpenId(principle.id)}
              onMouseLeave={() => setOpenId((current) => (current === principle.id ? null : current))}
              initial="rest"
              animate={isOpen ? "hover" : "rest"}
              whileHover="hover"
              variants={rowFill}
              transition={spring.snappy}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-4 rounded-xl py-5 text-left sm:gap-6"
            >
              <span className="w-6 shrink-0 font-mono text-sm text-fg-faint sm:w-8">
                {String(index + 1).padStart(2, "0")}
              </span>

              <span className="min-w-0 flex-1">
                <h3 className="text-lg font-medium tracking-tight text-fg sm:text-xl">{principle.title}</h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.p
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 6 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden text-sm leading-relaxed text-fg-muted"
                    >
                      {principle.description}
                    </motion.p>
                  )}
                </AnimatePresence>
              </span>

              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-xs transition-all duration-200",
                  isOpen ? "rotate-45 border-accent text-accent" : "border-border text-fg-faint",
                )}
                aria-hidden="true"
              >
                +
              </span>
            </motion.button>
          </Reveal>
        );
      })}
    </ul>
  );
}
