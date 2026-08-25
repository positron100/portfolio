import { motion, useReducedMotion } from "framer-motion";
import { wordItem, wordReveal } from "@/utils/motion";

interface SplitRevealProps {
  text: string;
  className?: string;
}

/**
 * Word-by-word reveal for a single promoted statement (About's editorial
 * rework). Splits on spaces and staggers each word up on first scroll into
 * view — built on the same stagger/fadeUp primitives every other reveal in
 * the codebase uses, just tuned per-word instead of per-block.
 */
export function SplitReveal({ text, className }: SplitRevealProps) {
  const reduceMotion = useReducedMotion();
  const words = text.split(" ");

  if (reduceMotion) {
    return <p className={className}>{text}</p>;
  }

  return (
    <motion.p
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
      variants={wordReveal()}
    >
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className="inline-block overflow-hidden pb-1 align-top">
          <motion.span variants={wordItem} className="inline-block">
            {word}
            {index < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </motion.p>
  );
}
