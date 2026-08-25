import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  allServices,
  findService,
  integrationDomains,
  serviceClusters,
  spineNodes,
} from "@/data/platformArchitecture";
import { ConnectionLayer, type Edge } from "./ConnectionLayer";
import { ServiceNode } from "./ServiceNode";
import { IntegrationHub } from "./IntegrationHub";
import { useNodeGeometry } from "./useNodeGeometry";
import { duration, ease } from "@/utils/motion";
import { cn } from "@/utils/cn";

const BUS_ID = "bus";
const BOUNDARY_ID = "third-party";

/**
 * Service discovery. Always drawn, never as part of the request path: the
 * registry supports the ecosystem rather than sitting in front of it.
 */
const infraEdge: Edge = { id: "infra-registry", from: "registry", to: "ecosystem", kind: "infra" };

/** The resting view: how a request gets in, and what the platform is made of. */
const spineEdges: Edge[] = [
  { id: "spine-client-gateway", from: "client", to: "gateway", kind: "spine" },
  { id: "spine-gateway-eco", from: "gateway", to: "ecosystem", kind: "spine" },
  { id: "spine-eco-bus", from: "ecosystem", to: BUS_ID, kind: "spine" },
  infraEdge,
];

/**
 * Every edge the focused node takes part in.
 *
 * Connections are computed per focus rather than drawn all at once. The full
 * graph across fourteen services is an unreadable web, and the point of the
 * map is the *shape* of the system, not its every edge. Focus a node and you
 * see exactly what it talks to, and how.
 */
function edgesForFocus(focusId: string | null): Edge[] {
  if (!focusId) return spineEdges;

  if (focusId === BUS_ID) {
    // The bus in full: everything that publishes, and everything that reacts.
    return allServices.flatMap((service) => [
      ...(service.publishes?.length
        ? [{ id: `pub-${service.id}`, from: service.id, to: BUS_ID, kind: "async" as const }]
        : []),
      ...(service.consumes?.length
        ? [{ id: `sub-${service.id}`, from: BUS_ID, to: service.id, kind: "async" as const }]
        : []),
    ]);
  }

  const service = findService(focusId);
  if (!service) return spineEdges;

  const edges: Edge[] = [];
  for (const target of service.sync ?? []) {
    edges.push({ id: `sync-${service.id}-${target}`, from: service.id, to: target, kind: "sync" });
  }
  // Anything that calls this service, so focusing a downstream node shows
  // its callers rather than looking like a dead end.
  for (const other of allServices) {
    if (other.sync?.includes(service.id)) {
      edges.push({ id: `sync-${other.id}-${service.id}`, from: other.id, to: service.id, kind: "sync" });
    }
  }
  if (service.publishes?.length) {
    edges.push({ id: `pub-${service.id}`, from: service.id, to: BUS_ID, kind: "async" });
  }
  if (service.consumes?.length) {
    edges.push({ id: `sub-${service.id}`, from: BUS_ID, to: service.id, kind: "async" });
  }
  // The registry link persists through every focus state: discovery is
  // always there, whatever else is being looked at.
  edges.push(infraEdge);
  return edges;
}

export function SystemMap() {
  const reduceMotion = useReducedMotion();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredDomainId, setHoveredDomainId] = useState<string | null>(null);
  const [hubHovered, setHubHovered] = useState(false);

  // Pointer wins while it is over a node; the tapped selection is what
  // remains once it leaves. One model serves hover and touch.
  const focusId = hoveredId ?? selectedId;
  // The integration tree opens on focus, so pointing at the boundary is
  // enough - no click needed. Safe to drive from hover because the tree
  // holds its space whether it is showing or not (see IntegrationHub), so
  // opening it cannot move the diagram. `focusId` covers hover, keyboard
  // focus, and tap through the same path; `hubHovered` keeps it open once
  // the pointer has travelled past the node into the tree itself.
  const boundaryExpanded = focusId === BOUNDARY_ID || hubHovered;

  const edges = useMemo(() => edgesForFocus(focusId), [focusId]);
  // Re-measure whenever anything that moves a node changes.
  const { containerRef, register, geometry } = useNodeGeometry(
    `${boundaryExpanded}:${hoveredDomainId}:${focusId === BUS_ID}`,
  );

  const related = useMemo(() => {
    const ids = new Set<string>();
    for (const edge of edges) {
      ids.add(edge.from);
      ids.add(edge.to);
    }
    return ids;
  }, [edges]);

  // The card keeps showing the boundary while the pointer is down in the
  // tree, which is past the node that opened it. Without this the card falls
  // back to its resting copy exactly when the provider notes for the hovered
  // category need to appear in it.
  const cardId = focusId ?? (boundaryExpanded ? BOUNDARY_ID : null);

  const detail = cardId
    ? cardId === BUS_ID
      ? spineNodes.bus
      : cardId in spineNodes
        ? spineNodes[cardId as keyof typeof spineNodes]
        : findService(cardId)
    : null;

  const focusedService = cardId ? findService(cardId) : undefined;
  const hoveredDomain = hoveredDomainId
    ? integrationDomains.find((domain) => domain.id === hoveredDomainId)
    : undefined;

  function handleSelect(id: string) {
    setSelectedId((current) => (current === id ? null : id));
  }

  const isMuted = (id: string) => Boolean(focusId) && !related.has(id) && id !== focusId;

  return (
    <div>
      <FlowLegend />

      <div ref={containerRef} className="relative mt-6" onMouseLeave={() => setHoveredId(null)}>
        {/* Decorative only, and absolutely positioned: the map lays itself
            out entirely in normal flow, so the connection overlay can never
            change a size or push anything around.

            This used to be `hidden lg:block`, on the reasoning that curves
            between stacked columns would cross the content rather than
            explain it. That is why the flow animation was invisible on a
            phone: not a reduced-motion check, not clipping, not a viewBox
            problem - the whole layer was `display: none` below 1024px. It is
            drawn at every size now. The geometry needed no work: paths are
            built from live measured boxes, so on a stacked layout they are
            already vertical runs down the spine rather than desktop curves. */}
        <div className="pointer-events-none absolute inset-0">
          <ConnectionLayer geometry={geometry} edges={edges} dim={!focusId} />
        </div>

        <div className="relative flex flex-col items-center gap-4">
          <ServiceNode
            id="client"
            label={spineNodes.client.label}
            tone="spine"
            isFocused={focusId === "client"}
            isMuted={isMuted("client")}
            onFocus={setHoveredId}
            onSelect={handleSelect}
            registerRef={register("client")}
            className="min-w-[160px]"
          />

          {/* Three columns rather than a centred flex row: the gateway has to
              stay on the vertical spine under the client, and a flex row
              shares the space with the registry, pushing the gateway off
              centre. That offset is enough to make the client connection
              route sideways instead of straight down. */}
          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
            <ServiceNode
              id="gateway"
              label={spineNodes.gateway.label}
              tone="spine"
              isFocused={focusId === "gateway"}
              isMuted={isMuted("gateway")}
              onFocus={setHoveredId}
              onSelect={handleSelect}
              registerRef={register("gateway")}
              className="col-start-2 min-w-[160px]"
            />
            <ServiceNode
              id="registry"
              label={spineNodes.registry.label}
              tone="infra"
              isFocused={focusId === "registry"}
              isMuted={isMuted("registry")}
              onFocus={setHoveredId}
              onSelect={handleSelect}
              registerRef={register("registry")}
              className="col-start-3 justify-self-start"
            />
          </div>

          <div
            ref={register("ecosystem")}
            className="w-full rounded-2xl border border-border bg-bg-subtle/50 p-3 sm:p-4"
          >
            <p className="mb-3 text-center font-mono text-[11px] tracking-widest text-fg-faint uppercase">
              Microservices Ecosystem
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {serviceClusters.map((cluster) => (
                <div
                  key={cluster.id}
                  className="rounded-xl border border-border bg-bg-elevated/40 p-3"
                >
                  <p className="text-xs font-semibold text-fg">{cluster.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-fg-faint">{cluster.note}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {cluster.services.map((service) => (
                      <ServiceNode
                        key={service.id}
                        id={service.id}
                        label={service.label}
                        tone={
                          service.id === BOUNDARY_ID
                            ? "boundary"
                            : service.offRequestPath
                              ? "scheduled"
                              : "service"
                        }
                        isFocused={focusId === service.id}
                        isMuted={isMuted(service.id)}
                        isRelated={related.has(service.id)}
                        onFocus={setHoveredId}
                        onSelect={handleSelect}
                        registerRef={register(service.id)}
                      />
                    ))}
                  </div>

                  {cluster.id === "integration" && (
                    // The tree has to survive the pointer leaving the node
                    // that opened it: the node's own mouseleave clears the
                    // focus, and without this the tree would collapse in the
                    // gap between the node and the first branch, making it
                    // impossible to reach. This region keeps it open for as
                    // long as the pointer is anywhere over the tree.
                    <div
                      onMouseEnter={() => setHubHovered(true)}
                      onMouseLeave={() => {
                        setHubHovered(false);
                        setHoveredDomainId(null);
                      }}
                    >
                      <IntegrationHub
                        expanded={boundaryExpanded}
                        hoveredDomainId={hoveredDomainId}
                        onHoverDomain={setHoveredDomainId}
                        registerRef={register}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <ServiceNode
            id={BUS_ID}
            label={`${spineNodes.bus.label} · Event Bus`}
            tone="bus"
            isFocused={focusId === BUS_ID}
            isMuted={isMuted(BUS_ID)}
            onFocus={setHoveredId}
            onSelect={handleSelect}
            registerRef={register(BUS_ID)}
            className="min-w-[220px]"
          />
        </div>
      </div>

      {/* Sized by its content and always present, so focusing a node never
          resizes the map above it.
          `aria-live` because this card is the text equivalent of the diagram:
          a keyboard user tabbing through the nodes changes it without moving
          focus into it, and the update has to be announced. */}
      <motion.div
        key={cardId ?? "resting"}
        aria-live="polite"
        initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: duration.fast, ease: ease.standard }}
        className="mt-6 rounded-2xl border border-border bg-bg-elevated p-5"
      >
        {detail ? (
          <>
            <h3 className="text-sm font-semibold text-fg">
              {focusedService?.title ?? detail.label}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{detail.responsibility}</p>

            {/* The scheduled worker's actual workload. A list, because
                "what does it run" is four concrete answers rather than a
                sentence, and naming them is what stops this reading as one
                more business service. */}
            {/* The provider notes the compact tree cannot carry. They surface
                here, where a height change costs nothing, for whichever
                integration domain the pointer is on. */}
            {hoveredDomain && (
              <div className="mt-3">
                <span className="font-mono text-[11px] tracking-wide text-accent uppercase">
                  {hoveredDomain.label}
                </span>
                <ul className="mt-1.5 space-y-1">
                  {hoveredDomain.vendors.map((vendor) => (
                    <li key={vendor.name} className="text-[11px] leading-snug">
                      <span className="font-mono text-fg">{vendor.name}</span>
                      {vendor.note && <span className="text-fg-muted"> {vendor.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {focusedService?.jobs && (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {focusedService.jobs.map((job) => (
                  <li key={job} className="flex items-center gap-1.5 text-[11px] text-fg-muted">
                    <span aria-hidden="true" className="h-[3px] w-[3px] rounded-full bg-accent" />
                    {job}
                  </li>
                ))}
              </ul>
            )}

            {focusedService && (
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[11px]">
                {focusedService.sync?.length ? (
                  <Relation
                    label="Calls"
                    tone="sync"
                    items={focusedService.sync.map((id) => findService(id)?.label ?? id)}
                  />
                ) : null}
                {focusedService.publishes?.length ? (
                  <Relation label="Publishes" tone="async" items={focusedService.publishes} />
                ) : null}
                {focusedService.consumes?.length ? (
                  <Relation label="Consumes" tone="async" items={focusedService.consumes} />
                ) : null}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm leading-relaxed text-fg-muted">
            Requests enter through the gateway and fan out across the ecosystem. Point at any
            service to see what it calls directly, and what it reaches through events instead.
          </p>
        )}
      </motion.div>
    </div>
  );
}

function Relation({
  label,
  tone,
  items,
}: {
  label: string;
  tone: "sync" | "async";
  items: string[];
}) {
  return (
    <div>
      <span
        className={cn(
          "font-mono tracking-wide uppercase",
          tone === "sync" ? "text-accent" : "text-accent-secondary",
        )}
      >
        {label}
      </span>
      <span className="mt-1 block text-fg-muted">{items.join(", ")}</span>
    </div>
  );
}

/**
 * The key to the two link languages. Small, and next to the map rather than
 * buried under it, because the whole diagram depends on the reader knowing
 * which line means what.
 */
function FlowLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-fg-muted">
      <span className="inline-flex items-center gap-2">
        <svg width="34" height="8" viewBox="0 0 34 8" aria-hidden="true">
          <path d="M0 4 H26" className="stroke-accent" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M26 1.5 L31 4 L26 6.5 Z" className="fill-accent" />
        </svg>
        Synchronous request over REST
      </span>
      <span className="inline-flex items-center gap-2">
        <svg width="34" height="8" viewBox="0 0 34 8" aria-hidden="true">
          <path
            d="M0 4 H32"
            className="stroke-accent-secondary"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="1 6"
          />
        </svg>
        Asynchronous event over Kafka
      </span>
    </div>
  );
}
