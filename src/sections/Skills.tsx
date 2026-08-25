import { motion } from "framer-motion";
import { SectionBigTitle } from "@/components/SectionBigTitle";
import { SkillsExplorer } from "@/components/SkillsExplorer";
import { useConnectedScroll } from "@/hooks/useConnectedScroll";

export function Skills() {
  const { sectionRef, style } = useConnectedScroll();

  return (
    <section ref={sectionRef} id="skills" className="border-b border-border bg-bg-subtle/40 py-20 sm:py-24">
      <motion.div style={style} className="container-px mx-auto max-w-6xl">
        <SectionBigTitle
          bigWord="Skills"
          subtitle="An interactive look at my toolkit."
          description="Browse by category and select a skill for context on how I actually use it."
        />
        <SkillsExplorer />
      </motion.div>
    </section>
  );
}
