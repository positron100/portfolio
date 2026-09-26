import { useCallback, useEffect, useLayoutEffect, useRef, useState, type UIEvent } from "react";
import { createPortal } from "react-dom";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import type { LiveProject } from "@/data/liveProjects";
import { useModalBehavior } from "@/hooks/useModalBehavior";
import { useMagnetic } from "@/hooks/useMagnetic";
import { randomLoader } from "@/utils/loaderMarkup";
import { portfolioMode, withMode } from "@/utils/projectUrl";
import { duration, ease, scaleTap } from "@/utils/motion";

/**
 * The pill <-> window morph is a tween, not a spring: a long ease-in-out
 * reads as glass unfolding, where the earlier stiff spring finished in
 * ~0.5s and felt abrupt. Closing is a touch quicker than opening.
 */
const MORPH_OPEN = { duration: 0.9, ease: [0.65, 0, 0.35, 1] } as const;
const MORPH_CLOSE = { duration: 0.75, ease: [0.65, 0, 0.35, 1] } as const;

const SLOW_LOAD_MS = 15000;
const SLOW_HINT_MS = 4000;
/** Cap on the origin corner radius; a pill takes its own half-height. */
const START_RADIUS = 32;
const END_RADIUS = 28;
const CHROME_H = 56;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Geo {
  origin: Box;
  final: Box;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function finalBox(redirect = false): Box {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Full View unfolds to the whole screen, edge to edge.
  if (redirect) return { x: 0, y: 0, w: vw, h: vh };
  const phone = vw < 640;
  const pad = phone ? 12 : 24;
  // Desktop/tablet: ~86vw x 80vh, capped; the portfolio stays visible around it.
  // Phones keep it large instead.
  const w = Math.min(phone ? vw : vw * 0.86, 1440, vw - 2 * pad);
  const h = Math.min(vh * (phone ? 0.88 : 0.8), vh - 2 * pad);
  return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
}

let sbw: number | undefined;
/** Width of this platform's classic scrollbar (0 for overlay scrollbars). */
function scrollbarWidth() {
  if (sbw === undefined) {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll";
    document.body.appendChild(probe);
    sbw = probe.offsetWidth - probe.clientWidth;
    probe.remove();
  }
  return sbw;
}

function toBox(r: DOMRect | null, fallback: Box): Box {
  return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : fallback;
}

interface Props {
  project: LiveProject;
  open: boolean;
  /** Live rect of the element the window grows out of (and returns to). */
  getOrigin: () => DOMRect | null;
  onClose: () => void;
  /**
   * `redirect` runs the same morph but loads no iframe: once the window has
   * unfolded it navigates this tab to the app (Full View).
   */
  mode?: "preview" | "redirect";
  /** Fired once the window has fully returned to its origin. */
  onExited?: () => void;
}

/**
 * The preview is one glass surface whose box, radius, blur and shadow are
 * driven by a single progress value from the origin pill's rect to the
 * window's rect. Its contents are laid out at the FINAL size from the first
 * frame and merely revealed, so the iframe starts loading at t=0 and the
 * morph never re-lays it out.
 */
export function ProjectPreviewModal({ project, open, getOrigin, onClose, onExited, mode = "preview" }: Props) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [closing, setClosing] = useState(false);

  useLayoutEffect(() => {
    if (open) {
      const final = finalBox(mode === "redirect");
      setClosing(false);
      setGeo({
        final,
        origin: toBox(getOrigin(), { x: final.x + final.w / 2 - 80, y: final.y + final.h / 2 - 20, w: 160, h: 40 }),
      });
    } else {
      setClosing(true);
    }
  }, [open, getOrigin, mode]);

  const exited = useCallback(() => {
    setGeo(null);
    onExited?.();
  }, [onExited]);

  if (!geo) return null;
  return createPortal(
    <Window project={project} geo={geo} closing={closing} getOrigin={getOrigin} onClose={onClose} onExited={exited} mode={mode} />,
    document.body,
  );
}

function Window({
  project,
  geo,
  closing,
  getOrigin,
  onClose,
  onExited,
  mode,
}: {
  project: LiveProject;
  geo: Geo;
  closing: boolean;
  getOrigin: () => DOMRect | null;
  onClose: () => void;
  onExited: () => void;
  mode: "preview" | "redirect";
}) {
  const reduceMotion = useReducedMotion();
  const redirect = mode === "redirect";
  const containerRef = useModalBehavior(!closing, onClose);
  // Full View is drawn toward the cursor (same pull as the site's links);
  // Close is pushed away from it — the hook's offset simply flips sign.
  const fullMagnet = useMagnetic({ strength: 8 });
  const closeRepel = useMagnetic({ strength: -8 });
  const p = useMotionValue(reduceMotion ? 1 : 0);
  const tick = useMotionValue(0);
  const originRef = useRef(geo.origin);
  const finalRef = useRef(geo.final);

  const src = useRef(project.bare ? project.url : withMode(project.url)).current;
  const [loader] = useState(randomLoader);
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(
    project.embeddable === false ? "failed" : "loading",
  );
  const [slow, setSlow] = useState(false);
  // Full View: cover the content with the loading layer, then leave this tab.
  const [leaving, setLeaving] = useState(false);
  const navTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const go = useCallback(() => {
    setLeaving(true);
    navTimer.current = setTimeout(() => window.location.assign(src), reduceMotion ? 0 : mode === "redirect" ? 180 : 320);
  }, [src, reduceMotion, mode]);
  // Seeded from the final geometry (padding + border + chrome) so the iframe
  // mounts in the very first commit instead of waiting for a ResizeObserver frame.
  const [size, setSize] = useState({ w: geo.final.w - 18, h: geo.final.h - CHROME_H - 10 });
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (closing) return;
    originRef.current = geo.origin;
    finalRef.current = geo.final;
    let cancelled = false;
    const controls = animate(p, 1, reduceMotion ? { duration: 0 } : MORPH_OPEN);
    // Full View leaves as soon as the window has finished unfolding.
    controls.then(() => {
      if (!cancelled && mode === "redirect") go();
    });
    return () => {
      cancelled = true;
      controls.stop();
    };
  }, [closing, geo, p, reduceMotion, mode, go]);

  useEffect(() => {
    if (!closing) return;
    clearTimeout(navTimer.current);
    setLeaving(false);
    const o = getOrigin();
    if (o) originRef.current = { x: o.x, y: o.y, w: o.width, h: o.height };
    tick.set(tick.get() + 1);
    const controls = animate(p, 0, reduceMotion ? { duration: 0 } : MORPH_CLOSE);
    controls.then(onExited);
    return () => controls.stop();
  }, [closing, getOrigin, onExited, p, tick, reduceMotion]);

  useEffect(() => {
    const onResize = () => {
      finalRef.current = finalBox(mode === "redirect");
      tick.set(tick.get() + 1);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [tick, mode]);

  const box = useCallback((t: number): Box => {
    const o = originRef.current;
    const f = finalRef.current;
    return { x: lerp(o.x, f.x, t), y: lerp(o.y, f.y, t), w: lerp(o.w, f.w, t), h: lerp(o.h, f.h, t) };
  }, []);
  const left = useTransform([p, tick], ([t]: number[]) => box(t).x);
  const top = useTransform([p, tick], ([t]: number[]) => box(t).y);
  const width = useTransform([p, tick], ([t]: number[]) => box(t).w);
  const height = useTransform([p, tick], ([t]: number[]) => box(t).h);
  const radius = useTransform([p, tick], ([t]: number[]) => lerp(Math.min(originRef.current.h / 2, START_RADIUS), redirect ? 0 : END_RADIUS, clamp01(t)));
  // The glass is only "on" once the window is well open: `g` ramps 0 -> 1 over
  // the first half of the morph, so near the pill everything (fill, blur,
  // shadow, highlights, tint) has converged to the pill's plain material —
  // no reflective sheen is left to flash as the window lands on it.
  const glass = useTransform(p, (t) => clamp01(t / 0.5));
  const blur = useTransform(glass, (g) => `blur(${lerp(3, 28, g)}px) saturate(${lerp(1, 1.5, g)})`);
  // Full View: the surface turns into the destination app's own page ground, so
  // when the new page loads there is no colour change to blink at.
  const groundColor = project.ground?.[portfolioMode()] ?? "var(--bg)";
  const fill = useTransform(p, (t) =>
    redirect
      ? `color-mix(in srgb, ${groundColor} ${Math.round(clamp01(t / 0.7) * 100)}%, transparent)`
      : `color-mix(in srgb, var(--bg) ${Math.round(clamp01(t / 0.5) * 60)}%, transparent)`,
  );
  const edge = useTransform(p, (t) =>
    redirect ? `color-mix(in srgb, var(--border) ${Math.round((1 - clamp01(t / 0.7)) * 100)}%, transparent)` : "var(--border)",
  );
  const shadow = useTransform(p, (t) => {
    const k = clamp01(t);
    const g = clamp01(t / 0.5);
    return `0 ${lerp(0, 40, k)}px ${lerp(0, 100, k)}px -${lerp(0, 24, k)}px rgb(0 0 0 / ${lerp(0, 0.5, k)}), inset 0 1px 0 rgb(255 255 255 / ${0.07 * g}), inset 0 0 0 1px rgb(255 255 255 / ${0.025 * g})`;
  });
  // Content is anchored at the FINAL rect; as the shell's own origin moves,
  // shift the content the opposite way so it never travels with the shell.
  const innerLeft = useTransform([p, tick], ([t]: number[]) => finalRef.current.x - box(t).x);
  const innerTop = useTransform([p, tick], ([t]: number[]) => finalRef.current.y - box(t).y);
  const chromeOpacity = useTransform(p, [0.3, 0.7], [0, 1]);
  const viewportOpacity = useTransform(p, [0.2, 0.6], [0, 1]);
  const scrimOpacity = useTransform(p, [0, 1], [0, 1]);

  useEffect(() => {
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);

  useEffect(() => {
    if (status !== "loading" || mode === "redirect") return;
    const hint = setTimeout(() => setSlow(true), SLOW_HINT_MS);
    const fail = setTimeout(() => setStatus("failed"), SLOW_LOAD_MS);
    return () => {
      clearTimeout(hint);
      clearTimeout(fail);
    };
  }, [status]);

  const onLoad = useCallback(() => setStatus("loaded"), []);

  // Scroll affordances. The iframe is cross-origin, so its scroll state can't
  // be read from here; an app that opts in (framed + ?cp-mode) posts
  // `{ type: "cp-scroll", down, right }` — booleans "more content below /
  // to the right" — and we accept it only from that iframe's window and origin.
  // The pan container (only relevant if content ever overflows it) is ours, so it is measured
  // directly. Apps that don't post simply show no arrow.
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [hint, setHint] = useState({ down: false, right: false });
  const [panRight, setPanRight] = useState(false);
  // Apps that have not adopted the contract still draw their own scrollbar, which
  // can't be styled from here. Until an app opts in, the iframe is made one
  // scrollbar-width wider than its clipping box, so that strip (where the bar
  // draws) falls outside it. Purely our own layout; the framed page still lays
  // out at the box's width while it scrolls, and scrolling is untouched.
  const [optedIn, setOptedIn] = useState(false);
  const clip = optedIn ? 0 : scrollbarWidth();

  useEffect(() => {
    const origin = new URL(project.url).origin;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data as { type?: string; down?: unknown; right?: unknown } | null;
      if (d?.type !== "cp-scroll") return;
      setOptedIn(true);
      const next = { down: d.down === true, right: d.right === true };
      setHint((h) => (h.down === next.down && h.right === next.right ? h : next));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [project.url]);

  const measurePan = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    // 2px tolerance so sub-pixel rounding never flickers the arrow.
    setPanRight(el.scrollWidth - el.clientWidth > 2 && el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);
  const onPan = useCallback((e: UIEvent<HTMLDivElement>) => measurePan(e.currentTarget), [measurePan]);
  useEffect(() => measurePan(node), [node, size, measurePan]);

  const host = project.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const f = geo.final;

  return (
    <div className="fixed inset-0 z-[70]">
      <motion.button
        type="button"
        tabIndex={-1}
        aria-label="Close preview"
        onClick={onClose}
        style={{ opacity: scrimOpacity }}
        className="absolute inset-0 bg-black/15 sm:backdrop-blur-sm [[data-theme=dark]_&]:bg-black/55"
      />
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name} preview`}
        style={{
          left,
          top,
          width,
          height,
          borderRadius: radius,
          backdropFilter: blur,
          WebkitBackdropFilter: blur,
          boxShadow: shadow,
          backgroundColor: fill,
          borderColor: edge,
        }}
        // Border matches the GitHub-style pill it grows from and returns to.
        className="absolute overflow-hidden border"
      >
        <motion.span
          aria-hidden="true"
          style={{ opacity: redirect ? 0 : glass }}
          className="pointer-events-none absolute inset-x-10 top-0 z-10 h-px bg-gradient-to-r from-transparent via-fg/25 to-transparent"
        />
        {/* Theme atmosphere: the active accent pair, very faintly, so the
            glass takes on the portfolio's palette in every mode. */}
        <motion.span
          aria-hidden="true"
          style={{ opacity: redirect ? 0 : glass }}
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.07] via-transparent to-accent-secondary/[0.06]"
        />
        <motion.div style={{ left: innerLeft, top: innerTop, width: f.w, height: f.h }} className="absolute flex flex-col">
          {redirect ? (
            <motion.div style={{ opacity: viewportOpacity }} className="grid h-full place-items-center">
              <div className="flex flex-col items-center gap-3 text-center">
                <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: loader }} />
                <span className="text-sm font-semibold text-fg">{project.name}</span>
                <span className="font-mono text-[11px] text-fg-faint">Opening {host}</span>
              </div>
            </motion.div>
          ) : (
          <>
          <motion.div
            style={{ opacity: chromeOpacity, height: CHROME_H }}
            className="flex shrink-0 items-center gap-3 px-3 sm:px-4"
          >
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-border/70 bg-accent/10 font-mono text-sm font-semibold text-accent"
            >
              {project.name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">
                {project.name}
                {project.tagline && <span className="hidden font-normal text-fg-muted sm:inline"> — {project.tagline}</span>}
              </p>
              <p className="truncate font-mono text-[11px] text-fg-faint">{host}</p>
            </div>
            <span
              role="status"
              className="hidden items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 font-mono text-[11px] text-fg-muted sm:inline-flex"
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${status === "loaded" ? "bg-accent" : "bg-fg-faint"}`}
              />
              {leaving ? "Opening" : status === "loaded" ? "Live" : status === "failed" ? "Offline" : "Connecting"}
            </span>
            <motion.button
              ref={(el: HTMLButtonElement | null) => fullMagnet.attach(el)}
              onMouseMove={fullMagnet.onMouseMove}
              onMouseLeave={fullMagnet.onMouseLeave}
              style={fullMagnet.style}
              whileTap={scaleTap}
              type="button"
              onClick={go}
              className="cp-attn relative inline-flex min-h-9 items-center rounded-full border bg-fg/[0.04] px-3.5 text-xs font-medium text-fg transition-colors hover:bg-accent/10 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Open Full View
            </motion.button>
            <motion.button
              ref={(el: HTMLButtonElement | null) => closeRepel.attach(el)}
              onMouseMove={closeRepel.onMouseMove}
              onMouseLeave={closeRepel.onMouseLeave}
              style={closeRepel.style}
              whileTap={scaleTap}
              type="button"
              onClick={onClose}
              aria-label="Close Preview"
              className="cp-attn cp-attn--red relative grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-fg/[0.04] text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </motion.button>
          </motion.div>

          <motion.div style={{ opacity: viewportOpacity }} className="relative min-h-0 flex-1 px-2 pb-2">
            <div
              ref={setNode}
              onScroll={onPan}
              // Native scrolling stays; only the bar is hidden (the arrows below
              // are the affordance).
              className="relative h-full overflow-x-auto overflow-y-hidden rounded-2xl border border-border/70 bg-bg-subtle/60 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {status !== "failed" && size.w > 0 && (
                // The iframe is exactly the viewport's size: no fixed desktop canvas, no
                // scaling. The app therefore sees a real window of this width and its own
                // responsive breakpoints decide the layout (mobile on a phone).
                <div style={{ width: size.w, height: size.h }}>
                  <div style={{ width: size.w, height: size.h, overflow: "hidden" }}>
                    <iframe
                      ref={iframeRef}
                      title={`${project.name} live preview`}
                      src={src}
                      onLoad={onLoad}
                      referrerPolicy="no-referrer"
                      className="h-full max-w-none border-0 bg-white transition-opacity duration-300"
                      style={{ opacity: status === "loaded" ? 1 : 0, width: `calc(100% + ${clip}px)` }}
                    />
                  </div>
                </div>
              )}

              <AnimatePresence>
                {(status === "loading" || leaving) && (
                  <motion.div
                    key="loading"
                    exit={{ opacity: 0 }}
                    transition={{ duration: duration.base, ease: ease.standard }}
                    className="absolute inset-0 grid place-items-center overflow-hidden bg-bg/40 backdrop-blur-xl backdrop-saturate-150"
                  >
                    <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-fg/5">
                      <span className="cp-activity block h-full w-2/5 rounded-full bg-accent/70" />
                    </span>
                    <div className="flex flex-col items-center gap-3 text-center">
                      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: loader }} />
                      <span className="text-sm font-semibold text-fg">{project.name}</span>
                      {project.tagline && <span className="-mt-2 text-xs text-fg-muted">{project.tagline}</span>}
                      <span className="font-mono text-[11px] text-fg-faint">
                        {leaving ? `Opening ${host}` : slow ? `Still waiting on ${host}…` : `Loading ${host}`}
                      </span>
                    </div>
                  </motion.div>
                )}
                {status === "failed" && (
                  <motion.div
                    key="failed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 grid place-items-center bg-bg/40 p-6 text-center backdrop-blur-xl"
                  >
                    <div className="max-w-sm">
                      <p className="text-base font-semibold text-fg">Preview unavailable</p>
                      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                        {project.name} couldn’t be loaded inside this page. It may block embedding or be slow to
                        respond. It works normally in its own tab.
                      </p>
                      <button
                        type="button"
                        onClick={go}
                        className="mt-5 inline-flex min-h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        Open Full View
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Scroll affordances: clipped to the viewport, never blocking input. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-2 top-0 bottom-2 overflow-hidden rounded-2xl"
            >
              <ScrollHint axis="y" show={status === "loaded" && hint.down} className="bottom-4 left-1/2 -translate-x-1/2" />
              <ScrollHint axis="x" show={status === "loaded" && (hint.right || panRight)} className="right-4 bottom-4" />
            </div>
          </motion.div>
          </>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

/**
 * A tiny chip with an arrow that travels through it in the scroll direction
 * and fades at both ends, so the loop has no visible reset. Pure CSS
 * (transform + opacity) — no JS animation, no per-frame state. Static under
 * reduced motion. Fades in/out with `show`; never intercepts pointers.
 */
function ScrollHint({ axis, show, className }: { axis: "x" | "y"; show: boolean; className: string }) {
  return (
    <span
      className={`absolute grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-border bg-bg/50 text-fg backdrop-blur-[3px] transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0"
      } ${className}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={axis === "y" ? "cp-hint-y" : "cp-hint-x"}
      >
        {axis === "y" ? <path d="M12 5v14M6 13l6 6 6-6" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
      </svg>
    </span>
  );
}
