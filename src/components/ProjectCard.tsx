import { AnimatePresence, motion } from "framer-motion";
import { useState, type MouseEvent } from "react";
import type { Project } from "@/types";
import { projectLayoutId } from "@/utils/projectLayoutId";

interface ProjectCardProps {
  project: Project;
  onOpen: (project: Project) => void;
}

export function ProjectCard({ project, onOpen }: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  function handlePointerMove(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }

  return (
    // The card used to be a single `<button>` wrapping everything. A repo
    // link can't live inside that: `<a>` nested in `<button>` is invalid, and
    // browsers resolve the nesting unpredictably. So the card is now a plain
    // element with a full-bleed "stretched" button behind the content — the
    // whole surface still opens the modal, while the repo link sits above it
    // as a real sibling anchor.
    //
    // Two elements, one job each.
    //
    // The outer one owns the shared layout id and nothing else. The inner one
    // owns the hover lift, the tilt and the tap press. They used to be the
    // same element, and that was the cause of the opening and closing
    // glitches: `whileTap` writes `scale` and `whileHover` writes `y` and
    // `rotate` to the very element whose transform Framer's shared-layout
    // projection is also driving toward the modal. Tapping a card sets a
    // manual transform in the same frame the projection starts, the two
    // fight for one matrix, and the result is the card appearing briefly in
    // the wrong place and losing its connection to the expanded view.
    //
    // Split like this the projection has sole ownership of the outer
    // transform, the press and lift still read exactly as before on the
    // inner, and hover still resolves on the outer because `group` and the
    // pointer handlers stay together.
    <motion.div layoutId={projectLayoutId(project.id)} className="relative h-full w-full">
    <motion.div
      onMouseMove={handlePointerMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      whileHover={{ y: -6, rotateX: 1.5, rotateY: -1.5 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      style={{ transformPerspective: 800 }}
      className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated p-6 text-left shadow-sm hover:border-border-strong hover:shadow-lg"
    >
      {/* Behind the content (no `relative`, and first in DOM), so every
          positioned sibling below paints over it. Carries the card's
          accessible name — the visible "View case study" text is decorative
          as far as this control is concerned. */}
      <button
        type="button"
        aria-label={`View ${project.name} details`}
        onClick={() => onOpen(project)}
        className="absolute inset-0 z-0 cursor-pointer rounded-2xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(220px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--accent) 10%, transparent), transparent 70%)",
        }}
      />

      {/* `pointer-events-none` on the content wrappers so text and tags don't
          swallow clicks meant for the stretched button underneath; the repo
          link re-enables them for itself. */}
      <div className="pointer-events-none relative flex items-center justify-between gap-3">
        <span className="font-mono text-xs font-medium tracking-widest text-accent uppercase">
          {project.categoryLabel}
        </span>
        {project.kind === "personal" && (
          <span className="rounded-full bg-accent-secondary-soft px-2.5 py-0.5 text-[11px] font-medium text-accent-secondary">
            Personal
          </span>
        )}
      </div>

      <h3 className="pointer-events-none relative mt-4 text-lg font-semibold text-fg">{project.name}</h3>
      <p className="pointer-events-none relative mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-fg-muted">
        {project.summary}
      </p>

      <div className="pointer-events-none relative mt-5 flex flex-wrap gap-1.5">
        {project.technologies.slice(0, 4).map((tech) => (
          <span
            key={tech}
            className="rounded-md bg-bg-subtle px-2 py-1 font-mono text-[11px] text-fg-muted"
          >
            {tech}
          </span>
        ))}
        {project.technologies.length > 4 && (
          <span className="rounded-md bg-bg-subtle px-2 py-1 font-mono text-[11px] text-fg-faint">
            +{project.technologies.length - 4}
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isHovered && project.highlights[0] && (
          <motion.p
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 10 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none relative overflow-hidden text-xs leading-relaxed text-fg-faint"
          >
            {project.highlights[0]}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="relative z-10 mt-5 flex items-center justify-between gap-3">
        <span className="pointer-events-none inline-flex items-center gap-1.5 text-sm font-medium text-fg transition-transform group-hover:translate-x-1">
          View case study
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>

        {project.repoUrl && (
          <a
            href={project.repoUrl}
            target="_blank"
            rel="noreferrer noopener"
            // Stops the click reaching the card underneath — without this the
            // repo would open *and* the modal would expand behind it.
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-fg-muted transition-colors hover:border-border-strong hover:bg-bg-subtle hover:text-fg"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            GitHub Repo
          </a>
        )}
      </div>
    </motion.div>
    </motion.div>
  );
}
