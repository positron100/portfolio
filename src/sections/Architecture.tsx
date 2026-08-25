import { motion } from "framer-motion";
import { SectionBigTitle } from "@/components/SectionBigTitle";
import { SystemMap } from "@/components/architecture/SystemMap";
import { EngineeringPrinciples } from "@/components/EngineeringPrinciples";
import { Reveal } from "@/components/Reveal";
import { useConnectedScroll } from "@/hooks/useConnectedScroll";

export function Architecture() {
  const { sectionRef, style } = useConnectedScroll();

  return (
    <section ref={sectionRef} id="architecture" className="border-b border-border py-20 sm:py-24">
      <motion.div style={style} className="container-px mx-auto max-w-6xl">
        <SectionBigTitle
          bigWord="Architecture"
          subtitle="How the pieces fit together."
          description="A conceptual view of the microservices platform I work on. Point at any service to see what it calls, and what it reaches through events."
        />
        <div className="relative overflow-hidden">
          <SystemMap />
        </div>

        <div id="principles" className="mt-24 scroll-mt-24">
          <Reveal className="mb-10 max-w-2xl">
            <span className="font-mono text-xs font-medium tracking-widest text-accent uppercase">
              Engineering Principles
            </span>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight">How I approach the work.</h3>
          </Reveal>
          <EngineeringPrinciples />
        </div>
      </motion.div>
    </section>
  );
}
