import { motion } from "framer-motion";
import { SectionBigTitle } from "@/components/SectionBigTitle";
import { ExperienceTimeline } from "@/components/ExperienceTimeline";
import { useConnectedScroll } from "@/hooks/useConnectedScroll";

export function Experience() {
  const { sectionRef, style } = useConnectedScroll();

  return (
    <section ref={sectionRef} id="experience" className="border-b border-border py-20 sm:py-24">
      <motion.div style={style} className="container-px mx-auto max-w-6xl">
        <SectionBigTitle bigWord="Experience" subtitle="Where I've put this to work." />
        <ExperienceTimeline />
      </motion.div>
    </section>
  );
}
