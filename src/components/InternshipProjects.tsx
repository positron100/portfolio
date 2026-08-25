import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { InternshipProject } from "@/types";
import { LiquidIndicator } from "@/components/LiquidIndicator";
import { ClockPreview } from "@/components/ClockPreview";
import { useMagnetic } from "@/hooks/useMagnetic";
import { spring, scaleTap, duration, ease } from "@/utils/motion";
import { cn } from "@/utils/cn";

interface InternshipProjectsProps {
  projects: InternshipProject[];
}

/**
 * One selectable project. A real `<button>` in normal grid flow — the card is
 * never absolutely positioned and never has a fixed height, so adding a
 * fourth project or a longer name only ever reflows the grid.
 *
 * Selection is shown by the card itself (accent border, raised surface) and
 * by the shared liquid indicator sliding behind it; unselected cards sit
 * slightly back with reduced opacity, which is the "others move into the
 * background" part of the brief without any of them moving at idle.
 */
function ProjectTab({
  project,
  isActive,
  onSelect,
  registerRef,
}: {
  project: InternshipProject;
  isActive: boolean;
  onSelect: () => void;
  registerRef: (el: HTMLButtonElement | null) => void;
}) {
  const reduceMotion = useReducedMotion();
  // Same pull the skill category tabs use, at the same strength — this is
  // the site's one magnetic implementation, not a second one.
  const magnetic = useMagnetic({ strength: 5, squash: true });

  return (
    <motion.button
      ref={(el: HTMLButtonElement | null) => {
        magnetic.attach(el);
        registerRef(el);
      }}
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onSelect}
      onMouseMove={magnetic.onMouseMove}
      onMouseLeave={magnetic.onMouseLeave}
      style={magnetic.style}
      whileHover={reduceMotion ? undefined : { y: -3, transition: spring.snappy }}
      whileTap={scaleTap}
      animate={reduceMotion ? undefined : { opacity: isActive ? 1 : 0.72 }}
      transition={spring.soft}
      className={cn(
        "relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
        isActive
          ? "border-accent bg-bg-elevated"
          : "border-border bg-bg-elevated/60 hover:border-border-strong",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg font-mono text-sm transition-colors",
          isActive ? "bg-accent-soft text-accent" : "bg-bg-subtle text-fg-faint",
        )}
      >
        {project.glyph}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-fg">{project.name}</span>
        <span className="mt-0.5 block font-mono text-[11px] tracking-wide text-fg-faint uppercase">
          {project.tagline}
        </span>
      </span>
    </motion.button>
  );
}

export function InternshipProjects({ projects }: InternshipProjectsProps) {
  const [activeId, setActiveId] = useState(projects[0]?.id ?? "");
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const reduceMotion = useReducedMotion();

  const active = projects.find((project) => project.id === activeId) ?? projects[0];
  // The source-code link gets the same pull as the Hero's CTAs. Held here
  // rather than inside the panel so it survives the panel's swap.
  const linkMagnetic = useMagnetic({ strength: 8 });

  if (!active) return null;

  return (
    <div className="mt-6">
      <p className="font-mono text-xs tracking-widest text-accent uppercase">
        {projects.length} Projects Contributed
      </p>

      <div
        ref={tabsRef}
        role="tablist"
        aria-label="DevTown internship projects"
        className="relative mt-4 grid gap-3 sm:grid-cols-3"
      >
        <LiquidIndicator
          containerRef={tabsRef}
          getTarget={() => tabRefs.current[activeId] ?? null}
          // The cards wrap to one column on mobile, so a move between them
          // is a vertical journey there and a horizontal one on desktop —
          // exactly the case `auto` exists for.
          orientation="auto"
          dependency={activeId}
          className="rounded-2xl bg-accent-soft"
        />
        {projects.map((project) => (
          <ProjectTab
            key={project.id}
            project={project}
            isActive={project.id === activeId}
            onSelect={() => setActiveId(project.id)}
            registerRef={(el) => {
              tabRefs.current[project.id] = el;
            }}
          />
        ))}
      </div>

      {/* The detail panel sits in normal flow and is sized by its content —
          no fixed height, so a longer description or an extra bullet simply
          makes it taller.

          Deliberately not wrapped in `AnimatePresence`: an exit animation
          keeps the outgoing panel mounted while the incoming one is not, so
          the container collapses toward zero height for the length of the
          exit and everything below the section jumps down and back. Keying a
          plain `motion.div` instead means React swaps the two panels in a
          single commit — the new content is measured immediately, and the
          only height change is the genuine difference between the two
          panels. The incoming panel still fades and rises into place. */}
      <div className="mt-4">
          <motion.div
            key={active.id}
            initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
            className="rounded-2xl border border-border bg-bg-elevated p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h5 className="text-base font-semibold text-fg">{active.name}</h5>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
                  {active.description}
                </p>
              </div>
              {active.preview === "clock" && <ClockPreview />}
            </div>

            <div className="mt-5">
              <p className="font-mono text-[11px] tracking-widest text-fg-faint uppercase">
                Tech Stack
              </p>
              <motion.div
                className="mt-2 flex flex-wrap gap-1.5"
                initial={reduceMotion ? undefined : "hidden"}
                animate={reduceMotion ? undefined : "visible"}
                variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
              >
                {active.technologies.map((tech) => (
                  <motion.span
                    key={tech}
                    variants={{
                      hidden: { opacity: 0, y: 6 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    className="rounded-md bg-bg-subtle px-2 py-1 font-mono text-[11px] text-fg-muted"
                  >
                    {tech}
                  </motion.span>
                ))}
              </motion.div>
            </div>

            <div className="mt-5">
              <p className="font-mono text-[11px] tracking-widest text-fg-faint uppercase">
                Key Contributions
              </p>
              <ul className="mt-2 space-y-2">
                {active.contributions.map((point) => (
                  <li key={point} className="flex gap-2 text-sm leading-relaxed text-fg-muted">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-fg-faint" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <motion.a
              ref={linkMagnetic.ref as React.Ref<HTMLAnchorElement>}
              href={active.repoUrl}
              target="_blank"
              rel="noreferrer noopener"
              onMouseMove={linkMagnetic.onMouseMove}
              onMouseLeave={linkMagnetic.onMouseLeave}
              style={linkMagnetic.style}
              whileTap={scaleTap}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-fg transition-colors hover:border-accent hover:text-accent"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              View Source Code
            </motion.a>
          </motion.div>
      </div>
    </div>
  );
}
