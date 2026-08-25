import { useReducedMotion } from "framer-motion";
import type { Geometry, NodeBox } from "./useNodeGeometry";

export type EdgeKind = "spine" | "sync" | "async" | "infra";

export interface Edge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
}

interface ConnectionLayerProps {
  geometry: Geometry;
  edges: Edge[];
  /** Drawn faintly and without particles - the resting state of the map. */
  dim?: boolean;
}

/**
 * Builds the path between two boxes.
 *
 * Edges leave the bottom of one node and enter the top of the other when the
 * journey is mostly vertical, and leave/enter the sides when it is mostly
 * horizontal. Control points are pulled along the travel axis, which gives a
 * routed, cable-like curve instead of a straight diagonal cutting across
 * other nodes.
 */
function buildPath(from: NodeBox, to: NodeBox): string {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  const vertical = Math.abs(dy) >= Math.abs(dx);

  if (vertical) {
    const y1 = dy >= 0 ? from.y + from.h : from.y;
    const y2 = dy >= 0 ? to.y : to.y + to.h;
    const bend = Math.max(18, Math.abs(y2 - y1) * 0.45);
    const dir = dy >= 0 ? 1 : -1;
    return `M ${from.cx} ${y1} C ${from.cx} ${y1 + bend * dir}, ${to.cx} ${y2 - bend * dir}, ${to.cx} ${y2}`;
  }

  const x1 = dx >= 0 ? from.x + from.w : from.x;
  const x2 = dx >= 0 ? to.x : to.x + to.w;
  const bend = Math.max(18, Math.abs(x2 - x1) * 0.45);
  const dir = dx >= 0 ? 1 : -1;
  return `M ${x1} ${from.cy} C ${x1 + bend * dir} ${from.cy}, ${x2 - bend * dir} ${to.cy}, ${x2} ${to.cy}`;
}

/**
 * The connection overlay.
 *
 * Two link languages, readable at a glance without the legend:
 *
 *   synchronous  - a solid line with a single packet travelling along it.
 *                  One request, one response, one thing in flight.
 *   asynchronous - a dashed line with several particles spaced along it,
 *                  because an event bus carries a stream rather than a call.
 *
 * Particles ride the same path via CSS `offset-path`, which resolves to a
 * transform - so the motion is compositor-friendly and never touches layout.
 * They are simply not rendered under reduced motion; the lines still draw, so
 * the architecture stays fully readable without any movement.
 */
export function ConnectionLayer({ geometry, edges, dim = false }: ConnectionLayerProps) {
  const reduceMotion = useReducedMotion();
  const { boxes, width, height } = geometry;
  if (!width || !height) return null;

  const drawable = edges
    .map((edge) => {
      const from = boxes[edge.from];
      const to = boxes[edge.to];
      if (!from || !to) return null;
      return { ...edge, d: buildPath(from, to) };
    })
    .filter((edge): edge is Edge & { d: string } => edge !== null);

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute inset-0"
      style={{ overflow: "visible" }}
    >
      <defs>
        <marker id="arch-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 1 L6 4 L0 7 Z" className="fill-accent" />
        </marker>
        {/* The glow. A blur applied to a wider copy of the same path, drawn
            under the sharp one - so the line keeps a crisp edge and only the
            halo is soft. Two strengths: the resting spine gets barely any,
            an active connection gets enough to lift it off the background
            without going neon. */}
        <filter id="arch-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <filter id="arch-glow-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      {drawable.map((edge) => {
        const isAsync = edge.kind === "async";
        const isSpine = edge.kind === "spine";
        // Service discovery is a lookup, not a request hop, so it gets its
        // own quiet language: a long-dashed neutral line with no arrowhead
        // and nothing travelling along it.
        const isInfra = edge.kind === "infra";
        // The resting spine is drawn in the accent rather than a neutral
        // border colour now. It was legible in isolation but disappeared
        // against the elevated panels behind it; at 45% it reads as a quiet
        // structural line without competing with the nodes.
        const strokeClass = isInfra
          ? "stroke-border-strong"
          : dim
            ? "stroke-accent"
            : isAsync
              ? "stroke-accent-secondary"
              : "stroke-accent";
        const strokeOpacity = isInfra ? 0.55 : dim ? 0.45 : isAsync ? 0.95 : 1;
        const width = isSpine ? 1.5 : 1.25;

        return (
          <g key={edge.id}>
            {/* Service discovery stays flat: a glow would give a lookup the
                same presence as live traffic. */}
            {!isInfra && (
              <path
                d={edge.d}
                fill="none"
                strokeLinecap="round"
                strokeWidth={dim ? width * 2.5 : width * 3.5}
                // The async glow is a *continuous* soft line, not a dashed
                // one. Its dashes used to sit still under the moving ones,
                // which read as two separate lines; a smooth halo with the
                // dots streaming over it is the intended hierarchy — glow
                // underneath, movement on top — and it is cheaper, because
                // the blurred copy no longer has a dash pattern to rasterise.
                filter={dim ? "url(#arch-glow-soft)" : "url(#arch-glow)"}
                opacity={dim ? 0.16 : 0.34}
                className={strokeClass}
              />
            )}
            <path
              d={edge.d}
              fill="none"
              strokeLinecap="round"
              strokeWidth={width}
              strokeDasharray={isAsync ? "1 7" : isInfra ? "4 5" : undefined}
              markerEnd={isAsync || isInfra ? undefined : "url(#arch-arrow)"}
              opacity={strokeOpacity}
              className={strokeClass}
              // The dashes themselves stream toward the destination. The path
              // is always built `from` → `to`, so a dash offset winding
              // negative always travels the edge's real direction — there is
              // no per-edge direction flag to get wrong, and a reversed edge
              // reverses automatically because its path is drawn the other
              // way round. One dash period is 8 (`1 7`), so animating exactly
              // -8 lands the pattern back on itself: seamless, no reset.
              // 8 user units per 0.5s — roughly 16px/s, the marching-ants
              // cadence. At the 1.1s it started on, a dot advanced about 7px
              // a second, which is technically moving and visually static.
              style={
                isAsync && !reduceMotion
                  ? { animation: "arch-dash-flow 0.5s linear infinite" }
                  : undefined
              }
            />
            {/* The resting spine flows too, and that is the whole point of
                this not being gated on `dim`.

                It used to be. `dim` is `!focusId`, and `focusId` on a desktop
                comes from *hover* — so simply moving the mouse across the map
                kept something focused and the flow was always on screen. A
                phone has no hover: nothing is focused until a node is tapped,
                so the diagram sat in its resting state and every line was
                static. The animation was never mobile-specific or disabled by
                a media query, breakpoint or reduced-motion check — the
                resting state was static on desktop too, and only hovering hid
                that. Animating it fixes the phone and makes the desktop
                resting state honest at the same time.

                The resting flow is deliberately quieter (see `restFactor`)
                so the spine still reads as structure rather than competing
                with a focused connection. */}
            {!reduceMotion &&
              !isInfra &&
              // A synchronous call carries **two** chevrons, half a cycle
              // apart, not one. With a single one the line stood empty for
              // the whole interval between it arriving and the next
              // departing; at 50% offset the second is already halfway down
              // the path as the first lands, so the flow never runs dry and
              // nothing is ever seen to reset.
              //
              // An event path keeps its spaced stream, thinned once the whole
              // bus is lit: fifteen paths times three particles is visual
              // noise, and forty-five simultaneous animations for a
              // decorative layer is not a trade worth making. Those lines
              // carry their own flowing dashes, so they still read as a
              // stream at one particle.
              Array.from({ length: isAsync ? (drawable.length > 6 ? 1 : 3) : 2 }, (_, i) => {
                const cycle = isAsync ? 2.6 : 1.8;
                const spacing = isAsync ? 0.85 : cycle / 2;
                const style = {
                  offsetPath: `path("${edge.d}")`,
                  animation: `arch-travel ${cycle}s linear infinite`,
                  animationDelay: `${i * spacing}s`,
                };
                const fill = isAsync ? "fill-accent-secondary" : "fill-accent";
                // Halo plus core, rather than a blur filter: a filtered
                // element per particle is real GPU work for a decorative
                // dot, and a larger translucent circle under a solid one
                // reads the same at this size. The halo stays a circle in
                // both cases — it is the glow, and it should not have an
                // orientation of its own.
                // Smaller and fainter while nothing is focused, so the resting
                // spine keeps its quiet structural character and a focused
                // connection is still clearly the louder one.
                const restFactor = dim ? 0.75 : 1;
                return (
                  <g key={i} opacity={dim ? 0.6 : 1}>
                    <circle
                      r={(isAsync ? 5 : 5.5) * restFactor}
                      opacity={0.22}
                      className={fill}
                      style={{ ...style, offsetRotate: "0deg" }}
                    />
                    {isAsync ? (
                      <circle r={2 * restFactor} className={fill} style={{ ...style, offsetRotate: "0deg" }} />
                    ) : (
                      // A chevron, not a dot: a request has a direction and
                      // the thing travelling should show it. `offsetRotate:
                      // auto` turns it along the tangent, so it stays pointed
                      // the right way around every curve, corner and vertical
                      // run without any angle being computed here.
                      <path
                        d="M -2 -2.6 L 2.7 0 L -2 2.6 Z"
                        className={fill}
                        style={{ ...style, offsetRotate: "auto" }}
                      />
                    )}
                  </g>
                );
              })}
          </g>
        );
      })}
    </svg>
  );
}
