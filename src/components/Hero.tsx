import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { siteConfig } from "@/data/site";
import { scrollToSection } from "@/utils/scroll";
import { HeroBackground } from "@/components/HeroBackground";
import { Typewriter } from "@/components/Typewriter";
import { Magnetic } from "@/components/Magnetic";
import { duration, ease } from "@/utils/motion";

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const bgOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.25]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);

  const contentStyle = reduceMotion ? undefined : { opacity: contentOpacity, y: contentY };
  const bgStyle = reduceMotion ? undefined : { opacity: bgOpacity, scale: bgScale };

  return (
    <section
      ref={heroRef}
      id="home"
      className="relative flex min-h-[100svh] items-center overflow-hidden border-b border-border"
    >
      <motion.div style={bgStyle} className="absolute inset-0">
        <HeroBackground />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 55% at 50% 40%, transparent 0%, var(--bg) 85%)",
          }}
        />
      </motion.div>

      <motion.div style={contentStyle} className="container-px relative mx-auto w-full max-w-6xl py-32">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-mono text-sm text-fg-muted"
        >
          Hi, I&apos;m {siteConfig.name}.
        </motion.p>

        <div className="mt-4 overflow-hidden">
          <motion.h1
            initial={reduceMotion ? undefined : { y: "100%" }}
            animate={reduceMotion ? undefined : { y: "0%" }}
            transition={{ duration: duration.cinematic, ease: ease.entrance, delay: 0.1 }}
            className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            {siteConfig.role}
          </motion.h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.32 }}
          className="mt-3 h-9 text-xl font-medium text-accent sm:text-2xl"
        >
          <Typewriter words={siteConfig.rotatingRoles} />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg"
        >
          {siteConfig.tagline}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.48 }}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <Magnetic>
            <motion.button
              type="button"
              onClick={() => scrollToSection("projects")}
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-fg shadow-sm"
            >
              View My Work
            </motion.button>
          </Magnetic>
          <Magnetic>
            <motion.button
              type="button"
              onClick={() => scrollToSection("contact")}
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-fg hover:border-border-strong hover:bg-bg-subtle"
            >
              Get In Touch
            </motion.button>
          </Magnetic>
        </motion.div>
      </motion.div>

      <motion.button
        type="button"
        onClick={() => scrollToSection("about")}
        aria-label="Scroll to About section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        style={reduceMotion ? undefined : { opacity: contentOpacity }}
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-fg-faint sm:flex"
      >
        <span className="font-mono text-[10px] tracking-widest uppercase">Scroll</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 4v16M6 14l6 6 6-6" />
        </svg>
      </motion.button>
    </section>
  );
}
