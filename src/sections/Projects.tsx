import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SectionBigTitle } from "@/components/SectionBigTitle";
import { ProjectCard } from "@/components/ProjectCard";
import { LiquidIndicator } from "@/components/LiquidIndicator";
import { useMagnetic } from "@/hooks/useMagnetic";
import { ProjectDetailsModal } from "@/components/ProjectDetailsModal";
import { projects } from "@/data/projects";
import type { Project, ProjectFilter } from "@/types";
import { cn } from "@/utils/cn";
import { scaleTap } from "@/utils/motion";
import { useConnectedScroll } from "@/hooks/useConnectedScroll";

const filters: { id: ProjectFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "microservices", label: "Microservices" },
  { id: "payments", label: "Payments" },
  { id: "integrations", label: "Integrations" },
  { id: "backend", label: "Backend" },
  { id: "full-stack", label: "Full Stack" },
];


/** A project filter chip carrying the site's shared magnetic pull, at the
 * same strength as the skill tags so the two selectors feel identical. */
function FilterChip({
  label,
  isActive,
  onSelect,
  registerRef,
}: {
  label: string;
  isActive: boolean;
  onSelect: () => void;
  registerRef: (el: HTMLButtonElement | null) => void;
}) {
  const magnetic = useMagnetic({ strength: 5, squash: true });
  return (
    <motion.button
      ref={(el: HTMLButtonElement | null) => {
        magnetic.attach(el);
        registerRef(el);
      }}
      type="button"
      role="tab"
      style={magnetic.style}
      onMouseMove={magnetic.onMouseMove}
      onMouseLeave={magnetic.onMouseLeave}
      whileTap={scaleTap}
      aria-selected={isActive}
      onClick={onSelect}
      className={cn(
        "relative rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        isActive
          ? "border-accent text-accent"
          : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
      )}
    >
      {label}
    </motion.button>
  );
}

export function Projects() {
  const [activeFilter, setActiveFilter] = useState<ProjectFilter>("all");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const { sectionRef, style } = useConnectedScroll();
  const filterBarRef = useRef<HTMLDivElement>(null);
  const filterRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const filteredProjects = useMemo(() => {
    if (activeFilter === "all") return projects;
    return projects.filter((project) => project.categories.includes(activeFilter));
  }, [activeFilter]);

  return (
    <section ref={sectionRef} id="projects" className="border-b border-border bg-bg-subtle/40 py-20 sm:py-24">
      <motion.div style={style} className="container-px mx-auto max-w-6xl">
        <SectionBigTitle
          bigWord="Projects"
          subtitle="Case studies and builds."
          description="A mix of professional engineering work and personal full-stack projects."
        />

        <div
          ref={filterBarRef}
          role="tablist"
          aria-label="Project filters"
          className="relative mb-10 flex flex-wrap gap-2"
        >
          {/* Same travelling blob as the navbar. `auto` because these chips
              wrap: on a narrow viewport the selection can move down a line,
              and it should elongate along that path, not sideways. */}
          <LiquidIndicator
            containerRef={filterBarRef}
            getTarget={() => filterRefs.current[activeFilter] ?? null}
            orientation="auto"
            dependency={activeFilter}
            className="rounded-full bg-accent-soft"
          />
          {filters.map((filter) => (
            <FilterChip
              key={filter.id}
              label={filter.label}
              isActive={activeFilter === filter.id}
              onSelect={() => setActiveFilter(filter.id)}
              registerRef={(el) => {
                filterRefs.current[filter.id] = el;
              }}
            />
          ))}
        </div>

        <motion.div layout className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.3, delay: (index % 3) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <ProjectCard project={project} onOpen={setSelectedProject} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      <ProjectDetailsModal project={selectedProject} onClose={() => setSelectedProject(null)} />
    </section>
  );
}
