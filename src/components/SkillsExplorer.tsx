import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { skillCategories } from "@/data/skills";
import type { Skill, SkillCategory } from "@/types";
import { cn } from "@/utils/cn";
import { LiquidIndicator } from "@/components/LiquidIndicator";
import { useMagnetic } from "@/hooks/useMagnetic";
import { SkillCardStack, STACK_DEPTH, type StackCard } from "@/components/SkillCardStack";
import { spring, scaleTap, hoverLift } from "@/utils/motion";

/** Cards are built purely from existing skill data — no invented copy. */
function skillCard(category: SkillCategory, skill: Skill): StackCard {
  return {
    id: `skill:${category.id}:${skill.name}`,
    meta: category.title,
    title: skill.name,
    body: skill.description,
  };
}

/** The high-level card for a category, summarising what it contains. */
function categoryCard(category: SkillCategory): StackCard {
  return {
    id: `category:${category.id}`,
    meta: `${category.skills.length} skills`,
    title: category.title,
    body: category.skills.map((s) => s.name).join(" · "),
  };
}

function CategoryTab({
  category,
  isActive,
  onSelect,
  onPreview,
  registerRef,
}: {
  category: SkillCategory;
  isActive: boolean;
  onSelect: () => void;
  onPreview: () => void;
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
      onMouseMove={magnetic.onMouseMove}
      onMouseLeave={magnetic.onMouseLeave}
      onMouseEnter={onPreview}
      onFocus={onPreview}
      style={magnetic.style}
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
      {category.title}
    </motion.button>
  );
}


export function SkillsExplorer() {
  const [activeCategoryId, setActiveCategoryId] = useState(skillCategories[0].id);
  const [selectedSkill, setSelectedSkill] = useState<Skill>(skillCategories[0].skills[0]);
  const [hoveredSkill, setHoveredSkill] = useState<Skill | null>(null);
  const categoryBarRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const activeCategory = useMemo(
    () => skillCategories.find((category) => category.id === activeCategoryId) ?? skillCategories[0],
    [activeCategoryId],
  );

  const displayedSkill = hoveredSkill ?? selectedSkill;

  // The deck. Most recent first; whatever is at index 0 is the card on top.
  // Cards are only ever moved to the front, never rebuilt, so a skill you
  // return to keeps the very same element (and therefore its running springs)
  // instead of remounting and flickering.
  const [stack, setStack] = useState<StackCard[]>(() => [
    skillCard(skillCategories[0], skillCategories[0].skills[0]),
  ]);

  const pushCard = useCallback((card: StackCard) => {
    setStack((current) => {
      if (current[0]?.id === card.id) return current; // already on top
      return [card, ...current.filter((c) => c.id !== card.id)].slice(0, STACK_DEPTH);
    });
  }, []);

  function handleCategoryChange(id: string) {
    setActiveCategoryId(id);
    const category = skillCategories.find((c) => c.id === id);
    if (category) setSelectedSkill(category.skills[0]);
    setHoveredSkill(null);
    // Deck follows the selection, so the top card and the liquid blob agree
    // once the new tag set lands. Every push is explicit rather than derived
    // in an effect, so the order two pushes land in is never in question.
    if (category) pushCard(skillCard(category, category.skills[0]));
  }

  return (
    <div>
      <div
        ref={categoryBarRef}
        role="tablist"
        aria-label="Skill categories"
        className="relative flex flex-wrap gap-2"
      >
        <LiquidIndicator
          containerRef={categoryBarRef}
          getTarget={() => categoryRefs.current[activeCategoryId] ?? null}
          orientation="auto"
          dependency={activeCategoryId}
          className="rounded-full bg-accent-soft"
        />
        {skillCategories.map((category) => (
          <CategoryTab
            key={category.id}
            category={category}
            isActive={activeCategoryId === category.id}
            onSelect={() => handleCategoryChange(category.id)}
            // Hovering a category surfaces its high-level card — the level
            // above the individual skills, so the hierarchy stays legible.
            onPreview={() => pushCard(categoryCard(category))}
            registerRef={(el) => {
              categoryRefs.current[category.id] = el;
            }}
          />
        ))}
      </div>

      {/* Restored to the pre-animation structure: two columns, subskills
          left, description right. The subskills below carry no magnetic,
          liquid or deformation code — they are plain buttons again, and
          their layout is owned entirely by this grid and their own flex
          wrapping. */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div
          role="tabpanel"
          aria-label={`${activeCategory.title} skills`}
          className="flex flex-wrap content-start gap-2.5"
        >
          <AnimatePresence mode="popLayout">
            {activeCategory.skills.map((skill, index) => {
              const isActive = displayedSkill.name === skill.name;
              return (
                <motion.button
                  key={`${activeCategory.id}-${skill.name}`}
                  type="button"
                  layout
                  initial={{ opacity: 0, y: 8, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  whileHover={{ ...hoverLift, transition: spring.snappy }}
                  whileTap={scaleTap}
                  transition={{ duration: 0.25, delay: index * 0.02, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => {
                    setSelectedSkill(skill);
                    pushCard(skillCard(activeCategory, skill));
                  }}
                  onMouseEnter={() => {
                    setHoveredSkill(skill);
                    pushCard(skillCard(activeCategory, skill));
                  }}
                  onMouseLeave={() => {
                    setHoveredSkill(null);
                    pushCard(skillCard(activeCategory, selectedSkill));
                  }}
                  onFocus={() => {
                    setHoveredSkill(skill);
                    pushCard(skillCard(activeCategory, skill));
                  }}
                  onBlur={() => {
                    setHoveredSkill(null);
                    pushCard(skillCard(activeCategory, selectedSkill));
                  }}
                  aria-pressed={isActive}
                  className={cn(
                    "rounded-lg border px-3.5 py-2 font-mono text-sm transition-colors",
                    isActive
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-border bg-bg-elevated text-fg-muted hover:border-border-strong hover:text-fg",
                  )}
                >
                  {skill.name}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        <SkillCardStack cards={stack} />
      </div>
    </div>
  );
}
