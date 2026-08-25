import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { navLinks, siteConfig } from "@/data/site";
import { useActiveSection } from "@/hooks/useActiveSection";
import { useTheme } from "@/hooks/useTheme";
import { scrollToSection } from "@/utils/scroll";
import { cn } from "@/utils/cn";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LiquidIndicator } from "@/components/LiquidIndicator";
import { Magnetic } from "@/components/Magnetic";
import { duration, ease, spring, hoverLift } from "@/utils/motion";

const sectionIds = navLinks.map((link) => link.id);

/** Small enough that a nav label drifts rather than wanders — the Hero CTAs
 * use the component's default 14, which is far too much for a 72px item. */
const NAV_MAGNET_STRENGTH = 5;

/** Movement below this stays a click — same threshold the arrow button and
 * the theme toggle both use. */
const DRAG_THRESHOLD_PX = 6;

/**
 * The mobile menu opens as one gesture rather than as a panel that fades in
 * with a list inside it: the panel unfolds from the hamburger's own corner
 * (`transformOrigin: top right`) and the items follow it out on a stagger,
 * so the button, the panel and the list read as one movement. Closing runs
 * the stagger backwards — the items retreat first, then the panel folds up
 * after them (`staggerDirection: -1`).
 *
 * Transform and opacity only. Nothing here animates height or any other
 * layout property, so opening the menu cannot reflow the page behind it.
 */
const menuPanel: Variants = {
  hidden: { opacity: 0, scaleY: 0.7, scaleX: 0.9, y: -10 },
  visible: {
    opacity: 1,
    scaleY: 1,
    scaleX: 1,
    y: 0,
    // Elasticity comes from an under-damped spring rather than hand-authored
    // keyframes: the overshoot, the compression back and the small secondary
    // wobble all fall out of the physics, which is what stops it reading as a
    // cartoon bounce. The axes are deliberately tuned apart — height is the
    // dimension actually growing, so it carries most of the bounce (damping
    // 15) while width only breathes (damping 20). That difference across the
    // two axes is the "liquid" part; a uniform scale just looks springy.
    //
    // Opacity is fast and separate so the panel is fully present while the
    // bounce happens, instead of fading in through it.
    transition: {
      opacity: { duration: 0.15, ease: ease.standard },
      scaleY: { type: "spring", stiffness: 520, damping: 15, mass: 0.9 },
      scaleX: { type: "spring", stiffness: 460, damping: 20, mass: 0.9 },
      y: { type: "spring", stiffness: 520, damping: 20, mass: 0.9 },
      staggerChildren: 0.038,
      delayChildren: 0.05,
    },
  },
  exit: {
    // A spring, matching the open — NOT keyframes. This is the fix for a real
    // stutter and the cause was a velocity discontinuity, not dropped frames.
    //
    // The close used to be `scaleY: [1, 0.94, 1.04, 0.42]` on
    // `times: [0, 0.22, 0.44, 1]`. Framer eases **each segment separately**,
    // so the second segment decelerated to a standstill at 1.04 and the third
    // — carrying almost all of the travel — restarted under `ease.standard`
    // ([0.16, 1, 0.3, 1]), which launches fast and decelerates. The panel was
    // therefore momentarily still and then leapt: measured 1.040 → 0.651 in a
    // single 35ms step, against 0.04 in the step after. That jump *is* the
    // stutter.
    //
    // A spring cannot do that. It integrates from wherever the value and its
    // velocity currently are, so there is no segment boundary to jump at, the
    // first closing frame continues exactly from the open state (including
    // mid-open, if the menu is closed while still bouncing), and the mild
    // undershoot past the target on the way down is the reverse jiggle —
    // falling out of the physics rather than being drawn in by hand.
    opacity: 0,
    scaleY: 0.55,
    scaleX: 0.9,
    y: -6,
    // Dropped for the collapse only, and this is the mobile fix rather than a
    // cosmetic one. A `backdrop-filter` re-samples and re-blurs everything
    // behind it on **every frame the element transforms** — unlike the box
    // shadow, which a promoted layer rasterises once and then just scales.
    // Leaving it live meant the most expensive paint on the page was running
    // for every frame of the collapse. `when: "afterChildren"` means this
    // lands only once the items are already gone, so the boundary is not
    // visible: by then the panel is a plain translucent box that does nothing
    // but transform.
    // Written as an explicit no-op filter, not `"none"`. Framer resolves
    // `"none"` against the previous value component-wise, which turns
    // `saturate(1.5)` into `saturate(0)` — a fully greyscaled backdrop for the
    // whole collapse. Naming both components with neutral values removes the
    // blur without touching colour.
    backdropFilter: "blur(0px) saturate(1)",
    transition: {
      // Children lead by a beat rather than being fully sequenced. An earlier
      // version used `when: "afterChildren"`, which is correct about the
      // competing work but left ~280ms where nothing moved but the item
      // opacity — a dead pause that broke the sense of one connected motion.
      // A tight stagger plus a small delay on the container keeps the items
      // clear of the expensive part of the collapse without the wait.
      staggerChildren: 0.008,
      staggerDirection: -1,
      scaleY: { type: "spring", stiffness: 360, damping: 21, mass: 0.9, delay: 0.07, restDelta: 0.004 },
      scaleX: { type: "spring", stiffness: 360, damping: 26, mass: 0.9, delay: 0.07, restDelta: 0.004 },
      y: { type: "spring", stiffness: 360, damping: 26, mass: 0.9, delay: 0.07 },
      // Fades over the back half of the contraction, so the collapse is
      // watched rather than faded through, and the spring's undershoot has
      // gone before it could be seen rebounding.
      opacity: { duration: 0.26, delay: 0.1, ease: ease.exit },
      backdropFilter: { duration: 0 },
    },
  },
};

const menuItem: Variants = {
  hidden: { opacity: 0, y: -12, scale: 0.94 },
  // The items settle *inside* the container rather than arriving with it:
  // their own spring is stiffer and better damped than the panel's, so they
  // come to rest while the panel is still finding its last few percent. That
  // lag is what makes them read as contents of a liquid object instead of a
  // second animation running alongside it.
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 560, damping: 24, mass: 0.7 },
  },
  // Out ahead of the container, so the items are never seen squashing on the
  // way down and are gone before the expensive part of the collapse. Opacity
  // and `y` only: dropping `scale` is one less transform component to
  // interpolate on nine elements at once, and at this speed it is invisible.
  exit: { opacity: 0, y: -6, transition: { duration: 0.1, ease: ease.standard } },
};

/** How much closer a neighbouring item must be before it takes the drag from
 * the one currently held. A dead zone on the boundary, so a pointer resting
 * there cannot oscillate between two targets. */
const TARGET_HYSTERESIS_PX = 14;

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const activeId = useActiveSection(sectionIds);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  /** Set the moment an item is clicked so the indicator commits immediately
   * instead of sweeping through every section the smooth scroll passes on
   * the way. Handed back to the observer once it agrees. */
  const [pendingId, setPendingId] = useState<string | null>(null);
  /** The item a live drag is currently holding, and whether one is running.
   * Declared here because the observer effect below has to read `isDragging`. */
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const currentId = pendingId ?? activeId;

  const desktopNavRef = useRef<HTMLElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const desktopItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mobileItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    // While a drag is live the drag owns the navbar; handing control back to
    // the scroll observer mid-gesture would let it overwrite the target the
    // page is still travelling toward.
    if (isDragging) return;
    if (pendingId && activeId === pendingId) setPendingId(null);
  }, [activeId, pendingId, isDragging]);

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMenuOpen]);

  // --- drag-to-navigate ------------------------------------------------
  // Same gesture model as the opening sequence's arrow button: refs for the
  // high-frequency values, a movement threshold before anything counts as a
  // drag, and a short click-suppression window afterwards so the release
  // cannot also fire the button's own click.
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const pointerXRef = useRef(0);
  const suppressClickRef = useRef(false);
  /** Item geometry relative to the nav, cached once per gesture rather than
   * re-read on every frame. */
  const geometryRef = useRef<{ id: string; left: number; width: number; centre: number }[]>([]);
  const dragTargetRef = useRef<string | null>(null);

  function cacheGeometry() {
    const nav = desktopNavRef.current;
    if (!nav) return;
    geometryRef.current = navLinks.flatMap((link) => {
      const el = desktopItemRefs.current[link.id];
      if (!el) return [];
      // Offsets, not rects: the items carry a live magnetic transform and a
      // rect would bake it into the cached geometry.
      const left = el.offsetLeft;
      return [{ id: link.id, left, width: el.offsetWidth, centre: left + el.offsetWidth / 2 }];
    });
  }

  /**
   * The item the drag currently belongs to, by nearest centre — but a
   * candidate has to be clearly closer than the one already held before it
   * takes over. Without that margin, a pointer resting on a boundary sits
   * where two centres are equidistant and the target flickers between them
   * every frame, firing a navigation each time.
   */
  function resolveTarget(localX: number) {
    const items = geometryRef.current;
    if (!items.length) return null;

    let best = items[0];
    for (const item of items) {
      if (Math.abs(item.centre - localX) < Math.abs(best.centre - localX)) best = item;
    }

    const held = items.find((item) => item.id === dragTargetRef.current);
    if (!held || held.id === best.id) return best;
    const gain = Math.abs(held.centre - localX) - Math.abs(best.centre - localX);
    return gain > TARGET_HYSTERESIS_PX ? best : held;
  }

  /**
   * Called the instant the drag crosses into a different item — while the
   * pointer is still down. The page starts moving immediately rather than
   * waiting for release, which is the whole point of the gesture.
   *
   * `scrollToSection` cancels whatever run is in flight before starting its
   * own, so sweeping across four items does not queue four scrolls: each new
   * target replaces the last and the newest always wins.
   */
  function activateTarget(id: string) {
    dragTargetRef.current = id;
    setDragTargetId(id);
    // Holding `pendingId` is what stops the scroll-position observer from
    // overwriting the navbar while the page is still travelling toward the
    // section the drag just chose.
    setPendingId(id);
    scrollToSection(id);
  }

  /** Read every frame by the indicator while dragging. Returns a free
   * position that interpolates continuously between items rather than
   * snapping, plus the width of whichever item is currently targeted. */
  function dragOverride() {
    if (!draggingRef.current) return null;
    const nav = desktopNavRef.current;
    const items = geometryRef.current;
    if (!nav || !items.length) return null;

    const localX = pointerXRef.current - nav.getBoundingClientRect().left;
    const target = resolveTarget(localX);
    if (!target) return null;
    // Fires only on an actual crossing, not every frame.
    if (dragTargetRef.current !== target.id) activateTarget(target.id);

    const first = items[0];
    const last = items[items.length - 1];
    const x = Math.min(
      Math.max(localX - target.width / 2, first.left),
      last.left + last.width - target.width,
    );
    return { x, width: target.width };
  }

  function handleNavPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (phaseBlocksDrag(event)) return;
    draggingRef.current = false;
    startRef.current = { x: event.clientX, y: event.clientY };
    pointerXRef.current = event.clientX;
    cacheGeometry();
  }

  function phaseBlocksDrag(event: ReactPointerEvent<HTMLElement>) {
    return event.pointerType === "mouse" && event.button !== 0;
  }

  function handleNavPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (event.buttons === 0) return;
    pointerXRef.current = event.clientX;
    if (draggingRef.current) return;

    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
    // A gesture that is mostly vertical belongs to the page, not the navbar —
    // bailing out here is what keeps touch scrolling untouched.
    if (Math.abs(dy) > Math.abs(dx)) return;

    draggingRef.current = true;
    setIsDragging(true);
    // Seed the held target with whatever is active, so the first crossing is
    // measured against a real starting point rather than nothing.
    dragTargetRef.current = currentId;
    setDragTargetId(currentId);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nice-to-have; the gesture still tracks without it.
    }
  }

  function handleNavPointerUp(event: ReactPointerEvent<HTMLElement>) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released or never captured.
    }
    if (!draggingRef.current) return; // a plain click — leave it to onClick

    draggingRef.current = false;
    setIsDragging(false);
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 300);

    // Navigation already happened, the moment the drag entered this item.
    // Release only ends the gesture and settles the indicator.
    const landed = dragTargetRef.current;
    dragTargetRef.current = null;
    setDragTargetId(null);
    // The indicator can never be left stranded between two items: with the
    // gesture over, `live` goes false and it measures a real element again,
    // and `pendingId` guarantees that element is the item the drag held —
    // including when the pointer is released exactly on a boundary.
    if (landed) setPendingId(landed);
  }

  // --- mobile drag-to-navigate ----------------------------------------
  // The same gesture as the desktop navbar, turned on its side: geometry
  // cached once per gesture, refs for the live coordinate, activation the
  // instant the finger crosses into a new item rather than on release.
  //
  // Two things differ from the desktop version, both forced by touch:
  //
  //  1. The open menu locks `body` to `overflow: hidden`, and a locked body
  //     drops `window.scrollTo` — so real-time scrolling would silently do
  //     nothing. The lock is released the moment a drag actually starts (not
  //     on open, so a stationary menu still can't be scrolled behind).
  //  2. The list carries `touch-action: none`, so the browser never claims
  //     the vertical movement as a page scroll mid-drag. Scoped to this
  //     element only — nothing else on the page loses native scrolling.
  const mobileDraggingRef = useRef(false);
  const mobileStartRef = useRef({ x: 0, y: 0 });
  const mobilePointerYRef = useRef(0);
  const mobileGeometryRef = useRef<{ id: string; top: number; height: number; centre: number }[]>([]);
  /**
   * The panel's own vertical scale at the moment the gesture started.
   *
   * Load-bearing, and the cause of a genuinely confusing bug. Item geometry is
   * cached from `offsetTop`/`offsetHeight` — layout values, which transforms
   * cannot reach — but the finger touches the panel where it is *drawn*, and
   * the panel is scaled by its own open/close spring. Comparing a visual
   * pointer position against layout centres therefore mis-resolves every
   * target while the menu is still springing open (measured at `scaleY 0.9`,
   * which put every centre ~14% too low). Dividing the pointer's offset by
   * this scale converts it into the same space the centres live in, so the
   * two agree whether the panel is settled or still moving.
   */
  const mobileScaleRef = useRef(1);

  function cacheMobileGeometry() {
    const nav = mobileNavRef.current;
    if (!nav) return;
    const rect = nav.getBoundingClientRect();
    mobileScaleRef.current = nav.offsetHeight > 0 ? rect.height / nav.offsetHeight : 1;
    mobileGeometryRef.current = navLinks.flatMap((link) => {
      const el = mobileItemRefs.current[link.id];
      if (!el) return [];
      const top = el.offsetTop;
      return [{ id: link.id, top, height: el.offsetHeight, centre: top + el.offsetHeight / 2 }];
    });
  }

  /** Pointer position in the list's own layout space. */
  function mobileLocalY() {
    const nav = mobileNavRef.current;
    if (!nav) return 0;
    const scale = mobileScaleRef.current || 1;
    return (mobilePointerYRef.current - nav.getBoundingClientRect().top) / scale;
  }

  /** Nearest item centre, with the same dead zone the desktop uses so a
   * finger resting on a boundary cannot oscillate between two targets. */
  function resolveMobileTarget(localY: number) {
    const items = mobileGeometryRef.current;
    if (!items.length) return null;

    let best = items[0];
    for (const item of items) {
      if (Math.abs(item.centre - localY) < Math.abs(best.centre - localY)) best = item;
    }

    const held = items.find((item) => item.id === dragTargetRef.current);
    if (!held || held.id === best.id) return best;
    const gain = Math.abs(held.centre - localY) - Math.abs(best.centre - localY);
    return gain > TARGET_HYSTERESIS_PX ? best : held;
  }

  /**
   * Crossing detection, run from the pointer handler rather than from the
   * indicator's render loop.
   *
   * This is deliberate and is the difference between reliable and erratic:
   * the desktop version resolves its target inside `getOverride`, which the
   * indicator calls once per rendered frame, so navigation only happens as
   * often as that element re-renders. Doing it here means a crossing is
   * detected on the pointer event that actually caused it — at input rate,
   * guaranteed, whatever the renderer is doing — and `activateTarget` still
   * fires only on a real change of item, so it cannot restart the scroll on
   * every sample.
   */
  function updateMobileTarget() {
    const nav = mobileNavRef.current;
    const items = mobileGeometryRef.current;
    if (!nav || !items.length) return;
    const target = resolveMobileTarget(mobileLocalY());
    if (target && dragTargetRef.current !== target.id) activateTarget(target.id);
  }

  /** Free vertical position for the indicator, clamped to the list so it can
   * never be dragged off either end. Pure — read once per frame by the
   * indicator, with no side effects of its own. */
  function mobileDragOverride() {
    if (!mobileDraggingRef.current) return null;
    const nav = mobileNavRef.current;
    const items = mobileGeometryRef.current;
    if (!nav || !items.length) return null;

    const localY = mobileLocalY();
    const held = items.find((item) => item.id === dragTargetRef.current) ?? items[0];
    const first = items[0];
    const last = items[items.length - 1];
    const y = Math.min(
      Math.max(localY - held.height / 2, first.top),
      last.top + last.height - held.height,
    );
    return { y, height: held.height };
  }

  function handleMobilePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    mobileDraggingRef.current = false;
    mobileStartRef.current = { x: event.clientX, y: event.clientY };
    mobilePointerYRef.current = event.clientY;
    cacheMobileGeometry();
  }

  function handleMobilePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    mobilePointerYRef.current = event.clientY;
    if (mobileDraggingRef.current) {
      // Already dragging: this sample may have crossed into a new item.
      updateMobileTarget();
      return;
    }

    const dx = event.clientX - mobileStartRef.current.x;
    const dy = event.clientY - mobileStartRef.current.y;
    if (Math.abs(dy) < DRAG_THRESHOLD_PX) return;
    // Mostly-horizontal movement is not this gesture; leave it alone.
    if (Math.abs(dx) > Math.abs(dy)) return;

    mobileDraggingRef.current = true;
    setIsDragging(true);
    dragTargetRef.current = currentId;
    setDragTargetId(currentId);
    // Hand the page back its scroll so `scrollToSection` can actually move
    // it while the finger is still down.
    document.body.style.overflow = "";
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nice-to-have; the gesture still tracks without it.
    }
    // Resolve immediately on the sample that started the drag, so a fast
    // flick that crosses several items in one move still lands correctly.
    updateMobileTarget();
  }

  function endMobileDrag(event: ReactPointerEvent<HTMLDivElement>) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released or never captured.
    }
    if (!mobileDraggingRef.current) return; // a plain tap — onClick owns it

    mobileDraggingRef.current = false;
    setIsDragging(false);
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 300);

    // Navigation already happened on each crossing. Release only ends the
    // gesture; `pendingId` guarantees the indicator settles onto a real item
    // rather than wherever the finger happened to stop.
    const landed = dragTargetRef.current;
    dragTargetRef.current = null;
    setDragTargetId(null);
    if (landed) setPendingId(landed);
    setIsMenuOpen(false);
  }

  function handleNavClick(id: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setIsMenuOpen(false);
    setPendingId(id);
    // Release the scroll lock synchronously: a smooth scroll started while
    // body is `overflow: hidden` is dropped, and the effect above only clears
    // it after the next commit — too late for scrollToSection.
    document.body.style.overflow = "";
    scrollToSection(id);
  }

  return (
    <header className="fixed inset-x-0 top-3 z-50 sm:top-4">
      <div className="container-px mx-auto max-w-6xl">
        {/* The floating shell. Detached from the top edge, translucent over
            whatever it passes, and only picking up its border/shadow once
            the page has actually scrolled beneath it — at rest over the Hero
            it stays almost weightless. */}
        <div
          className={cn(
            "relative flex h-14 items-center justify-between rounded-full pr-2 pl-4 transition-[background-color,border-color,box-shadow] duration-300 sm:pl-5",
            // `blur(24px)` over the full-width bar measured as the largest
            // backdrop-filter on a phone (21,011px², fixed, on screen the
            // whole time — including for every frame of the theme reveal).
            // Halved on mobile, full strength from `sm:` up, the same trade
            // already made for the project modal.
            isScrolled
              ? "border border-border/70 bg-bg/65 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.25)] backdrop-blur-md backdrop-saturate-150 sm:backdrop-blur-xl"
              : "border border-transparent bg-bg/25 backdrop-blur-sm",
          )}
        >
          {/* A single hairline of light along the top edge — the one
              "glass" cue, instead of a heavy frosted panel. */}
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-6 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-fg/15 to-transparent transition-opacity duration-300",
              isScrolled ? "opacity-100" : "opacity-0",
            )}
          />

          <motion.button
            type="button"
            onClick={() => handleNavClick("home")}
            whileTap={{ scale: 0.94 }}
            className="relative font-mono text-sm font-semibold tracking-tight"
          >
            {siteConfig.name}
          </motion.button>

          <nav
            ref={desktopNavRef}
            aria-label="Primary"
            // `touch-action: pan-y` lets the browser keep vertical scrolling
            // for itself while leaving horizontal movement to this gesture.
            className="relative hidden touch-pan-y items-center gap-1 md:flex"
            onMouseLeave={() => setHoveredId(null)}
            onPointerDown={handleNavPointerDown}
            onPointerMove={handleNavPointerMove}
            onPointerUp={handleNavPointerUp}
            onPointerCancel={handleNavPointerUp}
          >
            {/* Hover halo sits *under* the active blob and is deliberately
                fainter — it previews where a click would land without ever
                claiming to be the active state. */}
            <AnimatePresence>
              {hoveredId && hoveredId !== currentId && (
                <motion.span
                  key="hover-halo"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: duration.micro }}
                  className="pointer-events-none absolute inset-0"
                >
                  <LiquidIndicator
                    containerRef={desktopNavRef}
                    getTarget={() => (hoveredId ? (desktopItemRefs.current[hoveredId] ?? null) : null)}
                    dependency={hoveredId}
                    className="rounded-full bg-fg/[0.06]"
                  />
                </motion.span>
              )}
            </AnimatePresence>

            <LiquidIndicator
              containerRef={desktopNavRef}
              // While dragging it points at whatever the pointer is over, so
              // the width morphs to the item being targeted; `getOverride`
              // supplies the continuous position in between.
              getTarget={() => desktopItemRefs.current[dragTargetId ?? currentId] ?? null}
              // `isDragging` is part of the key on purpose. The drag already
              // sets `pendingId` to the item it activated, so on release the
              // id alone is unchanged — the indicator would never re-measure
              // and would keep the free position the gesture left it at,
              // stranded between two items. Ending the drag changes the key,
              // which forces one measurement of the real element and lets the
              // springs settle onto it.
              dependency={`${isDragging}:${dragTargetId ?? currentId}`}
              live={isDragging}
              getOverride={dragOverride}
              className="rounded-full border border-accent/25 bg-accent/10"
            />

            {navLinks.map((link) => (
              <Magnetic key={link.id} strength={NAV_MAGNET_STRENGTH} disabled={isDragging} className="inline-block">
                <motion.button
                  ref={(el) => {
                    desktopItemRefs.current[link.id] = el;
                  }}
                  type="button"
                  onClick={() => handleNavClick(link.id)}
                  onMouseEnter={() => setHoveredId(link.id)}
                  onFocus={() => setHoveredId(link.id)}
                  onBlur={() => setHoveredId(null)}
                  whileHover={{ ...hoverLift, transition: spring.snappy }}
                  whileTap={{ scale: 0.95 }}
                  aria-current={currentId === link.id ? "true" : undefined}
                  data-drag-target={dragTargetId === link.id ? "true" : undefined}
                  className={cn(
                    "relative rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    currentId === link.id || dragTargetId === link.id ? "text-fg" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {link.label}
                </motion.button>
              </Magnetic>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <ThemeToggle theme={theme} setTheme={setTheme} />
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border md:hidden"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-nav"
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <MenuIcon isOpen={isMenuOpen} />
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.nav
              id="mobile-nav"
              aria-label="Mobile"
              variants={menuPanel}
              initial="hidden"
              animate="visible"
              exit="exit"
              // Unfolds from the hamburger's own corner rather than from its
              // own centre, which is what ties the panel to the button that
              // opened it.
              style={{ transformOrigin: "top right" }}
              // Glass, but cheap glass. `bg-bg/70` lets the page read through
              // it properly; the blur stays at `md` on a phone (`xl` only
              // from `sm:` up) because a full-width backdrop-filter is the
              // most expensive thing on screen while this panel is springing,
              // and the same reduction was already made for the project
              // modal. Saturation does most of the "frosted" work here at a
              // fraction of the cost of a larger blur radius.
              className="relative mt-2 overflow-hidden rounded-3xl border border-border/70 bg-bg/70 shadow-[0_12px_40px_-16px_rgb(0_0_0/0.35)] backdrop-blur-md backdrop-saturate-150 sm:backdrop-blur-xl md:hidden"
            >
              {/* The one glass cue: a hairline of light along the top edge,
                  the same treatment the navbar shell uses, so the panel reads
                  as the same material rather than as a second surface. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-8 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-fg/20 to-transparent"
              />

              {/* Same measured indicator, running vertically — the mobile
                  list speaks the identical liquid language, not a different
                  one. */}
              <div
                ref={mobileNavRef}
                // `touch-action: none` is scoped to this list and nothing
                // else: inside it a vertical drag belongs to the navigation,
                // everywhere else on the page native scrolling is untouched.
                className="relative flex touch-none flex-col gap-1 p-3"
                onPointerDown={handleMobilePointerDown}
                onPointerMove={handleMobilePointerMove}
                onPointerUp={endMobileDrag}
                onPointerCancel={endMobileDrag}
              >
                <LiquidIndicator
                  containerRef={mobileNavRef}
                  // Points at whatever the finger is over while dragging, so
                  // the pill's height morphs to the item being targeted;
                  // `getOverride` supplies the continuous position between.
                  getTarget={() => mobileItemRefs.current[dragTargetId ?? currentId] ?? null}
                  orientation="vertical"
                  // `isDragging` is part of the key for the same reason as on
                  // desktop: the drag has already set `pendingId` to the item
                  // it activated, so on release the id alone is unchanged and
                  // the indicator would keep the free position the gesture
                  // left it at, stranded between two items. Ending the drag
                  // changes the key, forcing one measurement of the real
                  // element so the springs settle onto it.
                  dependency={`${isDragging}:${dragTargetId ?? currentId}`}
                  live={isDragging}
                  getOverride={mobileDragOverride}
                  className="rounded-2xl border border-accent/25 bg-accent/10"
                />
                {navLinks.map((link) => (
                  <motion.button
                    key={link.id}
                    variants={menuItem}
                    ref={(el) => {
                      mobileItemRefs.current[link.id] = el;
                    }}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleNavClick(link.id)}
                    aria-current={currentId === link.id ? "true" : undefined}
                    className={cn(
                      "relative rounded-2xl px-3 py-2.5 text-left text-base font-medium transition-colors",
                      currentId === link.id ? "text-fg" : "text-fg-muted",
                    )}
                  >
                    {link.label}
                  </motion.button>
                ))}
                <motion.div variants={menuItem} className="mt-2 flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-fg-muted">Theme</span>
                  <ThemeToggle theme={theme} setTheme={setTheme} />
                </motion.div>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

/**
 * Three bars that *become* the close mark, rather than one icon being
 * swapped for another. The outer two travel to the middle and cross; the
 * middle one thins out from its centre as they arrive. Transform and opacity
 * only — three 2px spans, no SVG path morphing, nothing that repaints.
 *
 * Because each bar animates independently to its own resting state, an
 * open/close/open in quick succession is just three interrupted springs:
 * they re-target from wherever they are and settle correctly, so the icon
 * cannot be left stuck in a half-formed state.
 */
function MenuIcon({ isOpen }: { isOpen: boolean }) {
  const bar = "absolute left-0 h-[2px] w-4 rounded-full bg-current";
  return (
    <span aria-hidden="true" className="relative block h-4 w-4">
      <motion.span
        className={bar}
        style={{ top: 3 }}
        initial={false}
        animate={isOpen ? { y: 5, rotate: 45 } : { y: 0, rotate: 0 }}
        transition={spring.snappy}
      />
      <motion.span
        className={bar}
        style={{ top: 8 }}
        initial={false}
        animate={isOpen ? { opacity: 0, scaleX: 0.3 } : { opacity: 1, scaleX: 1 }}
        transition={{ duration: duration.fast, ease: ease.standard }}
      />
      <motion.span
        className={bar}
        style={{ top: 13 }}
        initial={false}
        animate={isOpen ? { y: -5, rotate: -45 } : { y: 0, rotate: 0 }}
        transition={spring.snappy}
      />
    </span>
  );
}
