import { useRef } from "react";
import { motion, useReducedMotion, useScroll } from "framer-motion";
import { experience } from "@/data/experience";
import { Reveal } from "@/components/Reveal";
import { InternshipProjects } from "@/components/InternshipProjects";

export function ExperienceTimeline() {
  const listRef = useRef<HTMLOListElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start 0.8", "end 0.6"],
  });

  return (
    <ol ref={listRef} className="relative pl-8">
      <div className="absolute top-0 bottom-0 left-0 w-px bg-border" />
      <motion.div
        className="absolute top-0 left-0 w-px origin-top bg-accent"
        style={reduceMotion ? { height: "100%" } : { height: "100%", scaleY: scrollYProgress }}
      />

      {experience.map((entry) => (
        <li key={`${entry.company}-${entry.role}`} className="relative pb-4">
          <span className="absolute top-1.5 -left-[calc(2rem+5px)] h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent-soft" />

          <Reveal>
            <h3 className="text-xl font-semibold">{entry.role}</h3>
            <p className="mt-1 font-mono text-sm text-accent">{entry.company}</p>
            <p className="mt-1 text-sm text-fg-faint">{entry.period}</p>
            {entry.summary && (
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-fg-muted">{entry.summary}</p>
            )}
          </Reveal>

          {entry.groups && (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {entry.groups.map((group, index) => (
                <Reveal
                  key={group.title}
                  delay={index * 0.08}
                  className="rounded-2xl border border-border bg-bg-elevated p-5"
                >
                  <h4 className="text-sm font-semibold text-fg">{group.title}</h4>
                  <ul className="mt-3 space-y-2">
                    {group.points.map((point) => (
                      <li key={point} className="flex gap-2 text-sm leading-relaxed text-fg-muted">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-fg-faint" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </div>
          )}

          {/* Rendered inside the same `<li>` as the role it belongs to, so
              the projects sit under the DevTown dot on the shared rail and
              read as part of that entry rather than as a separate block. */}
          {entry.projects && (
            <Reveal>
              <InternshipProjects projects={entry.projects} />
            </Reveal>
          )}
        </li>
      ))}
    </ol>
  );
}
