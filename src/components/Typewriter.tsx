import { useTypewriterCycle } from "@/hooks/useTypewriterCycle";

interface TypewriterProps {
  words: readonly string[];
  className?: string;
}

export function Typewriter({ words, className }: TypewriterProps) {
  const [display, ref] = useTypewriterCycle(words);

  return (
    <span ref={ref} className={className} aria-live="polite">
      {display}
      <span className="ml-0.5 inline-block h-[0.85em] w-[2px] translate-y-[0.1em] animate-pulse bg-accent-secondary" aria-hidden="true" />
    </span>
  );
}
