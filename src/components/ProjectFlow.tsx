import { useState } from "react";
import { motion } from "framer-motion";
import type { ProjectFlowStep } from "@/types";
import { cn } from "@/utils/cn";
import { scaleTap } from "@/utils/motion";

interface ProjectFlowProps {
  steps: ProjectFlowStep[];
}

export function ProjectFlow({ steps }: ProjectFlowProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = steps[activeIndex];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-2">
            <motion.button
              type="button"
              onClick={() => setActiveIndex(index)}
              whileTap={scaleTap}
              aria-pressed={activeIndex === index}
              className={cn(
                "rounded-lg border px-3 py-2 text-left font-mono text-xs transition-colors sm:text-sm",
                activeIndex === index
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border bg-bg-subtle text-fg-muted hover:border-border-strong hover:text-fg",
              )}
            >
              {step.label}
            </motion.button>
            {index < steps.length - 1 && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="shrink-0 text-fg-faint"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            )}
          </div>
        ))}
      </div>

      <motion.div
        key={active.label}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mt-4 rounded-xl border border-border bg-bg-subtle p-4"
      >
        <p className="font-mono text-xs tracking-widest text-accent uppercase">{active.label}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{active.description}</p>
      </motion.div>
    </div>
  );
}
