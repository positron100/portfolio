import { useEffect, useRef } from "react";
import type { MotionValue } from "framer-motion";
import { INTRO_TIMELINE } from "@/hooks/useIntroSequence";
import { avatarSize, introComposition } from "@/utils/avatarLayout";
import { icosahedronWireframe, projectVertex } from "@/utils/introGeometry";

/**
 * The opening sequence's construction stage, on a plain canvas.
 *
 * Every dot here is one *actual vertex* of the avatar's icosahedral
 * wireframe, projected through the avatar's own camera at the avatar's own
 * size and centre (see `utils/introGeometry.ts` and `introComposition`), and
 * every line is one of its real edges. So this isn't a decorative cloud that
 * later gets swapped for an unrelated avatar — the dots converge into the
 * avatar's exact silhouette, the edges draw its exact wireframe, and the 3D
 * avatar resolving in on top is that identical shape becoming solid. There
 * is no geometric discontinuity anywhere in the handoff for the eye to
 * catch as a "pop".
 *
 * Driven by the sequence's shared `elapsed` clock rather than an internal
 * one, so it cannot drift from the avatar's own timing, and it naturally
 * stops repainting when the clock parks (see `useIntroSequence`).
 */

/**
 * Opacity levels the edges and dots are rounded into before drawing.
 * Eight is enough that the depth shading is indistinguishable from
 * per-shape alpha, and few enough that one frame is at most sixteen draw
 * calls instead of a hundred and sixty two.
 */
const ALPHA_BUCKETS = 8;

function bucketOf(alpha: number) {
  const b = Math.round(alpha * (ALPHA_BUCKETS - 1));
  return b < 0 ? 0 : b > ALPHA_BUCKETS - 1 ? ALPHA_BUCKETS - 1 : b;
}

function bucketAlpha(bucket: number) {
  return bucket / (ALPHA_BUCKETS - 1);
}

const SCATTER_FACTOR = 3.4;
const DOT_STAGGER_MS = 340;
const EDGE_DRAW_MS = 260;
/**
 * How a dot comes into existence, before and during its flight inward.
 *
 * Every dot used to be drawn at 30% opacity the instant its turn arrived
 * (`0.3 + arrived * 0.6`), so a group of them appeared at a visible strength
 * out of nothing and only then started moving. Fading each one up from zero
 * over its own window removes that pop. The lead is what keeps it one
 * continuous event rather than two: a dot starts fading in slightly before
 * it starts travelling, so by the time the field is moving it is already
 * half-visible, and there is no moment where everything is present and
 * still.
 */
const APPEAR_MS = 300;
const APPEAR_LEAD_MS = 170;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}

/** Stable per-index jitter — deterministic, so the formation looks the same
 * considered every reload (intentional) rather than randomly chaotic. */
function hash01(i: number) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

interface Dot {
  /** Settled position, px offset from the composition centre. */
  tx: number;
  ty: number;
  /** Launch position — same bearing, further out, so it flies straight in. */
  sx: number;
  sy: number;
  depth: number;
  delay: number;
}

export function IntroParticles({
  elapsed,
  absorb,
}: {
  elapsed: MotionValue<number>;
  /** Whether a solid avatar arrives to take this wireframe's place. */
  absorb: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { vertices, edges } = icosahedronWireframe();

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let centre = { x: 0, y: 0 };
    let dots: Dot[] = [];
    let edgeDelays: number[] = [];
    let color = "#4f46e5";
    // True while the canvas is already cleared, so repeated no-op frames
    // during the reveal cost nothing.
    let blank = false;
    // Per-frame scratch, allocated once at layout rather than per frame.
    let posX = new Float32Array(0);
    let posY = new Float32Array(0);
    let posArrived = new Float32Array(0);
    let posAppear = new Float32Array(0);
    const edgeBuckets: number[][] = Array.from({ length: ALPHA_BUCKETS }, () => []);
    const dotBuckets: number[][] = Array.from({ length: ALPHA_BUCKETS }, () => []);

    function readColor() {
      color = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || color;
    }

    function layout() {
      const size = avatarSize();
      centre = introComposition(size).avatarCenter;

      dots = vertices.map((v, i) => {
        const p = projectVertex(v, size);
        // Back-most vertices settle first, so the form builds in depth
        // rather than all at once; the small hashed offset keeps it from
        // reading as a mechanical sweep.
        const depthOrder = (1 - (p.depth + 1) / 2) * 0.75 + hash01(i) * 0.25;
        return {
          tx: p.x,
          ty: p.y,
          sx: p.x * SCATTER_FACTOR + (hash01(i + 7) - 0.5) * size * 0.5,
          sy: p.y * SCATTER_FACTOR + (hash01(i + 13) - 0.5) * size * 0.5,
          depth: p.depth,
          delay: depthOrder * DOT_STAGGER_MS,
        };
      });

      posX = new Float32Array(dots.length);
      posY = new Float32Array(dots.length);
      posArrived = new Float32Array(dots.length);
      posAppear = new Float32Array(dots.length);

      // An edge can only draw once both its endpoints have arrived.
      edgeDelays = edges.map(([a, b]) => Math.max(dots[a].delay, dots[b].delay));
      const maxDelay = Math.max(...edgeDelays, 1);
      edgeDelays = edgeDelays.map((d) => d / maxDelay);
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      blank = false; // resizing the backing store clears it
      layout();
      draw(elapsed.get());
    }

    function draw(now: number) {
      const [dotsFrom, dotsTo] = INTRO_TIMELINE.dotsIn;
      const [edgeFrom, edgeTo] = INTRO_TIMELINE.edgesDraw;
      const edgeSpan = edgeTo - edgeFrom - EDGE_DRAW_MS;

      // Lines recede before dots. The dots sit exactly where the avatar's
      // vertices are, so holding them longest makes them read as being
      // absorbed into the solid form, while the scaffolding between them
      // quietly withdraws first. Where no avatar arrives to take over
      // (narrow viewports) neither ever fades — the wireframe *is* the
      // avatar there.
      const lineFade = absorb
        ? 1 - clamp01((now - INTRO_TIMELINE.linesFadeOut[0]) / (INTRO_TIMELINE.linesFadeOut[1] - INTRO_TIMELINE.linesFadeOut[0]))
        : 1;
      const dotFade = absorb
        ? 1 - clamp01((now - INTRO_TIMELINE.dotsFadeOut[0]) / (INTRO_TIMELINE.dotsFadeOut[1] - INTRO_TIMELINE.dotsFadeOut[0]))
        : 1;

      // Once both have faded there is nothing left to paint, and the clock
      // keeps running for the whole reveal afterwards. Without this the
      // canvas re-ran 42 point projections and 120 edge iterations to
      // produce an identical blank frame on every single scrub update.
      if (lineFade <= 0 && dotFade <= 0) {
        if (blank) return;
        ctx!.clearRect(0, 0, width, height);
        blank = true;
        return;
      }
      blank = false;
      ctx!.clearRect(0, 0, width, height);

      // Written in place into arrays allocated once at layout time. The
      // previous version built 42 fresh objects on every frame, which on a
      // phone is 42 allocations 60 times a second for the whole formation.
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const local = clamp01((now - dotsFrom - d.delay) / (dotsTo - dotsFrom - DOT_STAGGER_MS));
        const eased = easeOutCubic(local);
        posX[i] = centre.x + d.sx + (d.tx - d.sx) * eased;
        posY[i] = centre.y + d.sy + (d.ty - d.sy) * eased;
        posArrived[i] = eased;
        // Fades in on its own clock, starting a little ahead of its flight.
        posAppear[i] = easeOutCubic(
          clamp01((now - dotsFrom - d.delay + APPEAR_LEAD_MS) / APPEAR_MS),
        );
      }

      // Style is set once per frame, not once per shape.
      ctx!.strokeStyle = color;
      ctx!.fillStyle = color;
      ctx!.lineWidth = 1;

      // Edges and dots are bucketed by opacity and each bucket drawn as a
      // single path.
      //
      // This is the whole reason the formation stuttered on a phone. Every
      // edge and every dot used to be its own `beginPath`/`stroke` pair
      // because each carries a slightly different depth alpha - 162 separate
      // draw calls per frame, measured at 39.6 on average across the
      // sequence. `globalAlpha` cannot vary inside one path, but the eye
      // cannot separate 62 levels of it either, so rounding alpha to eight
      // buckets collapses those 162 calls into at most 16 while looking the
      // same.
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        edgeBuckets[b].length = 0;
        dotBuckets[b].length = 0;
      }

      if (lineFade > 0) {
        // Edges first, so dots always read as sitting on top of the
        // structure they anchor.
        for (let i = 0; i < edges.length; i++) {
          const start = edgeFrom + edgeDelays[i] * Math.max(edgeSpan, 0);
          const progress = clamp01((now - start) / EDGE_DRAW_MS);
          if (progress <= 0) continue;
          const ai = edges[i][0];
          const bi = edges[i][1];
          // Depth-faded like the wireframe material it's standing in for.
          const depthAlpha = 0.32 + ((dots[ai].depth + dots[bi].depth) / 2 + 1) / 2 * 0.42;
          const alpha = depthAlpha * Math.min(1, progress * 1.4) * lineFade;
          edgeBuckets[bucketOf(alpha)].push(i, easeOutCubic(progress));
        }

        for (let b = 0; b < ALPHA_BUCKETS; b++) {
          const bucket = edgeBuckets[b];
          if (bucket.length === 0) continue;
          ctx!.globalAlpha = bucketAlpha(b);
          ctx!.beginPath();
          for (let k = 0; k < bucket.length; k += 2) {
            const i = bucket[k];
            const eased = bucket[k + 1];
            const ai = edges[i][0];
            const bi = edges[i][1];
            ctx!.moveTo(posX[ai], posY[ai]);
            // The line grows from one vertex toward the other rather than
            // appearing whole — progressive drawing, not a fade-in.
            ctx!.lineTo(
              posX[ai] + (posX[bi] - posX[ai]) * eased,
              posY[ai] + (posY[bi] - posY[ai]) * eased,
            );
          }
          ctx!.stroke();
        }
      }

      if (dotFade > 0) {
        for (let i = 0; i < dots.length; i++) {
          // Multiplied by the emergence ramp, so a dot rises from nothing
          // instead of switching on at a third of full strength.
          const alpha =
            posAppear[i] *
            (0.35 + posArrived[i] * 0.55) *
            (0.55 + ((dots[i].depth + 1) / 2) * 0.45) *
            dotFade;
          dotBuckets[bucketOf(alpha)].push(i);
        }
        for (let b = 0; b < ALPHA_BUCKETS; b++) {
          const bucket = dotBuckets[b];
          if (bucket.length === 0) continue;
          ctx!.globalAlpha = bucketAlpha(b);
          ctx!.beginPath();
          for (let k = 0; k < bucket.length; k++) {
            const i = bucket[k];
            // Grows in as it appears, then tightens as it settles: a dot
            // arrives as a soft point and resolves into a crisp vertex.
            const r = (2.4 - posArrived[i] * 0.7) * (0.45 + posAppear[i] * 0.55);
            ctx!.moveTo(posX[i] + r, posY[i]);
            ctx!.arc(posX[i], posY[i], r, 0, Math.PI * 2);
          }
          ctx!.fill();
        }
      }

      ctx!.globalAlpha = 1;
    }

    readColor();
    resize();

    // One repaint per clock tick. When the clock parks (waiting for the
    // visitor) this simply stops firing and the finished wireframe stays on
    // the canvas — no rAF spinning on a static image.
    const unsubscribe = elapsed.on("change", draw);
    const themeObserver = new MutationObserver(() => {
      readColor();
      draw(elapsed.get());
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("resize", resize);

    return () => {
      unsubscribe();
      themeObserver.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [elapsed, absorb]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
