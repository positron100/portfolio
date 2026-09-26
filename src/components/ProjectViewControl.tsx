import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { liveProjects } from "@/data/liveProjects";
import { LiquidIndicator } from "@/components/LiquidIndicator";
import { ProjectPreviewModal } from "@/components/ProjectPreviewModal";
import { useMagnetic } from "@/hooks/useMagnetic";
import { warmOrigin } from "@/utils/projectUrl";
import { duration, ease, scaleTap } from "@/utils/motion";
import { cn } from "@/utils/cn";

type Choice = "preview" | "full";
type Item = Choice | "close";
const ORDER: Item[] = ["preview", "full", "close"];

/** Card rows use the compact mono pill; the Experience row matches its own 40px links. */
const SIZES = {
  sm: {
    h: "h-8",
    label: "font-mono text-[11px]",
    pad: "px-3",
    seg: "px-2 text-xs font-medium",
    px: 32,
    close: "h-8 w-8",
  },
  md: {
    h: "h-10",
    label: "text-sm font-medium",
    pad: "px-4",
    seg: "px-4 text-sm font-medium",
    px: 40,
    close: "h-10 w-10",
  },
} as const;

/** Gap between the pill and its detached close button. */
const GAP = 4;
/** Same as the GitHub Repo pill beside it, plus a hint of blur. */
const SURFACE = "rounded-full border border-border bg-transparent backdrop-blur-[3px] transition-colors";

/**
 * One pill, two states. Collapsed it reads "View Project"; expanded the SAME
 * pill has widened into [ Preview | Full View | × ]. The surface never
 * changes — only its width, animated between two measured natural widths,
 * while the label hands over to the segments. Everything stays in normal flow
 * inside a wrapper that reserves the expanded width up front, so growing never
 * pushes, covers or reflows a neighbour (the source-code link included); if the
 * row can't hold that reserved width it wraps *before* anything animates.
 *
 * Preview morphs this pill into the preview window; the × collapses it back.
 * Renders nothing without a deployed URL.
 */
export function ProjectViewControl({
  projectId,
  size = "sm",
  align = "end",
  className,
}: {
  projectId: string;
  size?: keyof typeof SIZES;
  /** Which edge stays put while it widens. */
  align?: "start" | "end";
  className?: string;
}) {
  const project = liveProjects[projectId];
  const s = SIZES[size];
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Preview loads the app in the window; Full View unfolds the same window and then navigates.
  const [mode, setMode] = useState<"preview" | "redirect">("preview");
  // True from choosing Preview until the window has folded back into the pill.
  const [presented, setPresented] = useState(false);
  const [active, setActive] = useState<Choice>("preview");
  const [dims, setDims] = useState<{ c: number; e: number } | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const openBtnRef = useRef<HTMLButtonElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<Item, HTMLButtonElement | null>>({ preview: null, full: null, close: null });
  const focusOnCollapse = useRef(false);
  const wasPresented = useRef(false);
  const reduceMotion = useReducedMotion();
  // Same pull as the "View Source Code" link, on the whole pill in both states.
  const magnetic = useMagnetic({ strength: 8 });
  // The detached × is pushed away from the cursor, like the preview window's.
  const closeRepel = useMagnetic({ strength: -8, disabled: !open });

  // Natural widths of both states, measured while collapsed (the row is laid
  // out but invisible, so its width is its content width).
  useLayoutEffect(() => {
    if (open) return;
    function measure() {
      const c = openBtnRef.current?.offsetWidth;
      const e = rowRef.current?.offsetWidth;
      if (c && e) setDims((d) => (d && d.c === c && d.e === e ? d : { c, e }));
    }
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, size]);

  useEffect(() => {
    if (open) itemRefs.current[active]?.focus();
    else if (focusOnCollapse.current) {
      focusOnCollapse.current = false;
      openBtnRef.current?.focus();
    }
    // `active` only seeds the initial focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Stable identity: the preview re-reads this on open/close only.
  const getOrigin = useCallback(() => pillRef.current?.getBoundingClientRect() ?? null, []);
  const closePreview = useCallback(() => setPreviewOpen(false), []);
  const exited = useCallback(() => setPresented(false), []);
  // Coming back with the browser's Back button can restore this page (bfcache)
  // with the Full View window still open; fold it away.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setPreviewOpen(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  // The pill is `visibility: hidden` while the window is out, so focus can only
  // return to it once that has been committed.
  useEffect(() => {
    if (!presented && previewOpen === false && wasPresented.current) itemRefs.current.preview?.focus();
    wasPresented.current = presented;
  }, [presented, previewOpen]);

  if (!project) return null;

  function expand() {
    magnetic.onMouseLeave(); // drop the cached (collapsed) rect; re-measured on next move
    warmOrigin(project.url);
    setActive("preview");
    setOpen(true);
  }

  function collapse(restoreFocus: boolean) {
    magnetic.onMouseLeave();
    focusOnCollapse.current = restoreFocus;
    setOpen(false);
  }

  function choose(id: Choice) {
    setMode(id === "preview" ? "preview" : "redirect");
    setPresented(true);
    setPreviewOpen(true);
  }

  function onKey(e: KeyboardEvent) {
    // The preview window is portalled but still a React descendant, so its key
    // events bubble here; only handle keys pressed inside the control itself.
    if (!e.currentTarget.contains(e.target as Node)) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      collapse(true);
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = ORDER.findIndex((id) => itemRefs.current[id] === document.activeElement);
    const next = ORDER[(i + (e.key === "ArrowRight" ? 1 : -1) + ORDER.length) % ORDER.length];
    itemRefs.current[next]?.focus();
  }

  // Width is a symmetric ease-in-out (a touch longer on the way back) so the
  // shrink is as smooth as the growth; there is no ease-out lurch at the start.
  const widthT = reduceMotion ? { duration: 0 } : { duration: open ? 0.5 : 0.65, ease: [0.65, 0, 0.35, 1] as const };

  return (
    <div
      role="group"
      aria-label={`${project.name} project actions`}
      onKeyDown={open ? onKey : undefined}
      className={cn("flex shrink-0 items-center", align === "end" ? "justify-end" : "justify-start", className)}
      // Reserve the expanded width (pill + detached ×) from the start so
      // growth never reflows the row.
      style={dims ? { width: dims.e + GAP + s.px } : undefined}
    >
      <motion.div
        ref={(el: HTMLDivElement | null) => {
          pillRef.current = el;
          magnetic.attach(el);
        }}
        initial={false}
        animate={dims ? { width: open ? dims.e : dims.c } : undefined}
        transition={widthT}
        style={magnetic.style}
        onMouseMove={magnetic.onMouseMove}
        onMouseLeave={magnetic.onMouseLeave}
        // A plain translucent surface with a whisper of blur — deliberately not
        // the heavy frosted glass. Hidden while the preview window is out
        // (the window is grown from this rect).
        className={cn(
          "relative overflow-hidden",
          SURFACE,
          "cp-attn",
          !open && "hover:bg-bg-subtle",
          s.h,
          presented && "invisible",
        )}
      >
        <motion.button
          ref={openBtnRef}
          type="button"
          onClick={expand}
          whileTap={scaleTap}
          inert={open}
          aria-expanded={open}
          animate={{ opacity: open ? 0 : 1 }}
          transition={{ duration: duration.fast, ease: ease.standard, delay: open || reduceMotion ? 0 : 0.2 }}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-full whitespace-nowrap text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
            s.h,
            s.pad,
            s.label,
            open && "pointer-events-none",
          )}
          style={dims ? { width: dims.c } : undefined}
        >
          View Project
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </motion.button>

        <motion.div
          ref={rowRef}
          inert={!open}
          animate={{ opacity: open ? 1 : 0 }}
          transition={{ duration: open ? duration.fast : duration.micro, ease: ease.standard, delay: open && !reduceMotion ? 0.1 : 0 }}
          className={cn("absolute inset-y-0 left-0 flex w-max items-center gap-px p-0.5", !open && "pointer-events-none")}
        >
          <LiquidIndicator
            containerRef={rowRef}
            getTarget={() => itemRefs.current[active]}
            dependency={active}
            className="rounded-full border border-accent/25 bg-accent/10"
          />
          {(["preview", "full"] as const).map((id) => (
            <button
              key={id}
              ref={(el) => {
                itemRefs.current[id] = el;
              }}
              type="button"
              aria-label={id === "full" ? "Open Full View" : undefined}
              onMouseEnter={() => setActive(id)}
              onFocus={() => setActive(id)}
              onClick={() => choose(id)}
              className={cn(
                "relative h-full flex-none rounded-full whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                s.seg,
                active === id ? "text-fg" : "text-fg-muted",
              )}
            >
              {id === "preview" ? "Preview" : "Full View"}
            </button>
          ))}
        </motion.div>
      </motion.div>

      {/* Detached ×: its own small pill beside the main one. The slot grows
          from 0 with the pill so it never reflows the row; overflow stays
          visible so the repulsion can move the button freely. */}
      <motion.div
        initial={false}
        animate={{ width: open ? s.px + GAP : 0 }}
        transition={widthT}
        className={cn("relative flex-none", s.h, presented && "invisible")}
      >
        <motion.button
          ref={(el: HTMLButtonElement | null) => {
            itemRefs.current.close = el;
            closeRepel.attach(el);
          }}
          type="button"
          aria-label="Close project actions"
          inert={!open}
          onClick={() => collapse(true)}
          onMouseMove={closeRepel.onMouseMove}
          onMouseLeave={closeRepel.onMouseLeave}
          whileTap={scaleTap}
          initial={false}
          animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.6 }}
          transition={{ duration: open ? duration.fast : duration.micro, ease: ease.standard, delay: open && !reduceMotion ? 0.12 : 0 }}
          style={closeRepel.style}
          className={cn(
            "absolute top-0 right-0 grid place-items-center text-fg-muted hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            open && "cp-attn cp-attn--red",
            SURFACE,
            s.close,
            !open && "pointer-events-none",
          )}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </motion.button>
      </motion.div>

      <ProjectPreviewModal project={project} open={previewOpen} getOrigin={getOrigin} onClose={closePreview} onExited={exited} mode={mode} />
    </div>
  );
}
