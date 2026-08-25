import { motion } from "framer-motion";
import { SectionBigTitle } from "@/components/SectionBigTitle";
import { Reveal } from "@/components/Reveal";
import { SplitReveal } from "@/components/SplitReveal";
import { FocusCapsule } from "@/components/FocusCapsule";
import { snapshotItems, education, certifications, leetcodeNote } from "@/data/site";
import { useConnectedScroll } from "@/hooks/useConnectedScroll";

const focusAreas = [
  "Java and Spring Boot",
  ".NET Core",
  "REST APIs",
  "Microservices",
  "SQL and database optimization",
  "Payment integrations",
  "KYC workflows",
  "Third-party APIs",
  "Webhooks",
  "Financial systems",
  "Legacy modernization",
];

export function About() {
  const { sectionRef, style } = useConnectedScroll();

  return (
    <section ref={sectionRef} id="about" className="border-b border-border py-20 sm:py-24">
      <motion.div style={style} className="container-px mx-auto max-w-6xl">
        <SectionBigTitle bigWord="About" subtitle="Backend-focused, systems-minded." />

        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <SplitReveal
              text="I'm a backend-focused software developer interested in solving complex engineering problems and building systems that hold up under real-world load."
              className="text-2xl leading-tight font-medium tracking-tight text-balance text-fg sm:text-3xl"
            />

            <Reveal delay={0.2}>
              <p className="mt-6 text-sm leading-relaxed text-fg-muted sm:text-base">
                My work centers on designing reliable services rather than just shipping features —
                thinking through failure modes, data consistency, and how a system will behave once
                it's no longer new. I currently work as a{" "}
                <span className="font-medium text-fg">Software Developer (Junior SDE)</span> at{" "}
                <span className="font-medium text-fg">Fincart Financial Planners</span>, where my
                experience spans payment gateway integrations, KYC lifecycle automation, health
                insurance purchase flows, referral systems, and backend performance work across
                Java/Spring Boot and .NET services.
              </p>
            </Reveal>

            <Reveal delay={0.28} className="mt-6 flex flex-wrap gap-2">
              {focusAreas.map((area) => (
                <FocusCapsule key={area} label={area} />
              ))}
            </Reveal>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {snapshotItems.map((item, index) => (
              <Reveal
                key={item.label}
                delay={index * 0.06}
                className="rounded-2xl border border-border bg-bg-elevated p-5"
              >
                <p className="font-mono text-sm font-semibold text-accent">{item.label}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{item.detail}</p>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="mt-16 grid gap-8 border-t border-border pt-12 sm:grid-cols-2">
          <Reveal>
            <h3 className="text-sm font-semibold tracking-widest text-fg-muted uppercase">Education</h3>
            <div className="mt-4 space-y-4">
              {education.map((entry) => (
                <div key={entry.degree}>
                  <p className="font-medium text-fg">{entry.degree}</p>
                  <p className="mt-1 text-sm text-fg-muted">{entry.institution}</p>
                  <p className="mt-0.5 font-mono text-xs text-fg-faint">{entry.period}</p>
                </div>
              ))}
              <p className="text-sm text-fg-muted">{leetcodeNote}</p>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <h3 className="text-sm font-semibold tracking-widest text-fg-muted uppercase">Certifications</h3>
            <ul className="mt-4 space-y-3">
              {certifications.map((cert) => (
                <li key={cert.name} className="text-sm text-fg-muted">
                  <span className="font-medium text-fg">{cert.name}</span> — {cert.issuer}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </motion.div>
    </section>
  );
}
