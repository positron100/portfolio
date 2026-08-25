import { useEffect, useRef, useState, type UIEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Project } from "@/types";
import { useModalBehavior } from "@/hooks/useModalBehavior";
import { ProjectFlow } from "@/components/ProjectFlow";
import { projectLayoutId } from "@/utils/projectLayoutId";
import { spring } from "@/utils/motion";
import { cn } from "@/utils/cn";

interface ProjectDetailsModalProps {
  project: Project | null;
  onClose: () => void;
}

const BOTTOM_FADE_THRESHOLD = 24;

export function ProjectDetailsModal({ project, onClose }: ProjectDetailsModalProps) {
  const containerRef = useModalBehavior(project !== null, onClose);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !project) return;
    setHasMoreBelow(el.scrollHeight - el.clientHeight > BOTTOM_FADE_THRESHOLD);
  }, [project]);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    setHasMoreBelow(remaining > BOTTOM_FADE_THRESHOLD);
  }

  function handleScrollDownClick() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ top: el.clientHeight * 0.8, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <AnimatePresence>
      {project && (
        <motion.div
          // Centred with real side margins on every size, not a full-bleed
          // bottom sheet on phones. `p-4` is the breathing room; the safe-area
          // insets keep it clear of a notch or a home indicator in landscape.
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
          style={{
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            // No blur below `sm`. A backdrop-filter is recomputed over the
            // whole viewport on every frame the card is animating, which is
            // the single most expensive thing in this interaction on a
            // phone. A slightly deeper scrim reads almost identically and
            // costs nothing; larger screens keep the blur.
            className="absolute inset-0 bg-black/65 sm:bg-black/50 sm:backdrop-blur-sm"
          />

          <motion.div
            ref={containerRef}
            layoutId={projectLayoutId(project.id)}
            // `layout` removed: `layoutId` already runs a layout animation,
            // and the extra prop added a second measurement pass per render
            // for no additional movement.
            transition={spring.soft}
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-modal-title"
            // No shadow below `sm`. This element's box is what the shared
            // layout animation is scaling, and a large-blur `box-shadow` has
            // to be re-rasterised at every intermediate size — paint work on
            // the main thread for the whole expansion, on the one element
            // that must not drop frames. Over a 65% black scrim the shadow is
            // doing nothing visible on a phone anyway; larger screens keep it.
            className="relative max-h-[86svh] w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-bg-elevated sm:shadow-xl"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-5 right-5 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-elevated text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="modal-scroll max-h-[inherit] overflow-y-auto overscroll-contain p-6 sm:p-8"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                // Tightened from 0.12 so the content is arriving while the
                // card is still settling, rather than reading as a second,
                // separate step after it lands.
                transition={{ delay: 0.06, duration: 0.22 }}
              >
                <span className="font-mono text-xs font-medium tracking-widest text-accent uppercase">
                  {project.categoryLabel}
                </span>
                <h3 id="project-modal-title" className="mt-2 pr-10 text-2xl font-semibold text-balance">
                  {project.name}
                </h3>

                <div className="mt-5 space-y-3">
                  {project.details.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-relaxed text-fg-muted">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {project.flow && (
                  <div className="mt-7">
                    <h4 className="text-sm font-semibold text-fg">Engineering Flow</h4>
                    <div className="mt-3">
                      <ProjectFlow steps={project.flow} />
                    </div>
                  </div>
                )}

                <div className="mt-7">
                  <h4 className="text-sm font-semibold text-fg">Engineering Highlights</h4>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {project.highlights.map((highlight) => (
                      <li key={highlight} className="flex gap-2 text-sm leading-relaxed text-fg-muted">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-7">
                  <h4 className="text-sm font-semibold text-fg">Technologies</h4>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {project.technologies.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-md bg-bg-subtle px-2.5 py-1 font-mono text-xs text-fg-muted"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                {(project.repoUrl || project.liveUrl) && (
                  <div className="mt-7 flex flex-wrap gap-3 border-t border-border pt-6">
                    {project.repoUrl && (
                      <a
                        href={project.repoUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="rounded-full border border-border px-4 py-2 text-sm font-medium text-fg transition-colors hover:border-border-strong hover:bg-bg-subtle"
                      >
                        View Repository
                      </a>
                    )}
                    {project.liveUrl && (
                      <a
                        href={project.liveUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
                      >
                        Live Demo
                      </a>
                    )}
                  </div>
                )}
              </motion.div>
            </div>

            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 rounded-b-3xl bg-gradient-to-t from-bg-elevated to-transparent transition-opacity duration-300",
                hasMoreBelow ? "opacity-100" : "opacity-0",
              )}
            />

            <AnimatePresence>
              {hasMoreBelow && (
                <motion.button
                  type="button"
                  onClick={handleScrollDownClick}
                  aria-label="Scroll down for more content"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="absolute bottom-4 left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-bg-elevated/90 text-fg-muted shadow-sm backdrop-blur-sm transition-colors hover:border-border-strong hover:text-fg"
                >
                  <motion.svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    animate={reduceMotion ? undefined : { y: [0, 3, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <path d="M12 5v14M6 13l6 6 6-6" />
                  </motion.svg>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
