import { useEffect, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
  type Variants,
} from "framer-motion";
import type { CertificateItem } from "@/types";
import { useModalBehavior } from "@/hooks/useModalBehavior";
import { certificateLayoutId } from "@/utils/certificateLayoutId";
import { duration, ease, scaleTap, spring } from "@/utils/motion";

/** How far a card travels on the way in and on the way out, in px. Out is
 * further than in, so the outgoing card is properly gone before the incoming
 * one reaches centre rather than the two crossing in the middle. */
const ENTER_X = 240;
const EXIT_X = 360;
/** Drag distance, plus a quarter second of its own velocity, past which a
 * release commits to the next certificate instead of springing back. */
const COMMIT_DISTANCE = 110;

/**
 * `direction` is 1 for next and -1 for previous, and every offset below is
 * multiplied by it, so the two directions are genuine mirrors rather than the
 * same animation played twice.
 */
const slideVariants: Variants = {
  enter: (direction: number) => ({ x: direction * ENTER_X, opacity: 0, zIndex: 0 }),
  center: { x: 0, opacity: 1, zIndex: 1, transition: { ...spring.soft, opacity: { duration: 0.2 } } },
  exit: (direction: number) => ({
    x: direction * -EXIT_X,
    opacity: 0,
    // Above the incoming card while leaving: the one being dismissed should
    // pass in front of the one arriving, which is what makes the pair read as
    // two physical cards rather than a cross-fade.
    zIndex: 2,
    transition: { duration: 0.34, ease: ease.standard },
  }),
};

/**
 * One certificate in the deck.
 *
 * Its own component because each card needs its own `x` motion value: a single
 * shared value would drive the outgoing and incoming cards together, and they
 * have to move independently in opposite directions.
 *
 * Rotation and scale are derived from `x` rather than animated separately.
 * That means one source of truth for "how far is this card from centre", so a
 * dragged card tilts exactly the way a released one does, and the tilt during
 * an automatic transition matches the tilt under a finger. Both are capped
 * low (3.5 degrees, 10% scale) so the certificate stays comfortable to read
 * the whole way through.
 */
function CertificateSlide({
  item,
  direction,
  isActive,
  useSharedLayout,
  reduceMotion,
  onCommit,
  onDragOffset,
}: {
  item: CertificateItem;
  direction: number;
  isActive: boolean;
  useSharedLayout: boolean;
  reduceMotion: boolean;
  onCommit: (direction: number) => void;
  onDragOffset: (offset: number) => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-EXIT_X, 0, EXIT_X], [-3.5, 0, 3.5]);
  const scale = useTransform(x, [-EXIT_X, 0, EXIT_X], [0.9, 1, 0.9]);

  function handleDragEnd(_event: unknown, info: PanInfo) {
    onDragOffset(0);
    // Velocity is folded into the decision so a short, fast flick commits the
    // same way a long, slow drag does.
    const power = info.offset.x + info.velocity.x * 0.25;
    if (power < -COMMIT_DISTANCE) {
      onCommit(1);
      return;
    }
    if (power > COMMIT_DISTANCE) {
      onCommit(-1);
      return;
    }
    animate(x, 0, spring.soft);
  }

  return (
    <motion.div
      custom={direction}
      variants={reduceMotion ? undefined : slideVariants}
      initial={reduceMotion ? { opacity: 0 } : "enter"}
      animate={reduceMotion ? { opacity: 1 } : "center"}
      exit={reduceMotion ? { opacity: 0 } : "exit"}
      transition={reduceMotion ? { duration: 0.15 } : undefined}
      style={reduceMotion ? undefined : { x, rotate, scale }}
      drag={reduceMotion || !isActive ? false : "x"}
      dragElastic={0.16}
      dragMomentum={false}
      onDrag={(_event, info) => onDragOffset(info.offset.x)}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 flex touch-pan-y items-center justify-center"
    >
      <motion.div
        // Only the certificate the modal was opened on carries the shared
        // layout id. Every card in the collage behind the backdrop still owns
        // the same id, so keeping it on the active card would make each
        // navigation try to fly the new card in from its thumbnail while the
        // slide was already moving it. Two systems, one transform.
        layoutId={useSharedLayout ? certificateLayoutId(item.id) : undefined}
        transition={reduceMotion ? { duration: 0 } : spring.soft}
        className="overflow-hidden rounded-2xl bg-bg-elevated shadow-2xl"
      >
        <img
          src={item.image}
          alt={`${item.title} issued by ${item.issuer}`}
          width={item.width}
          height={item.height}
          draggable={false}
          style={{ aspectRatio: `${item.width} / ${item.height}` }}
          className="max-h-[68vh] w-auto max-w-full object-contain select-none"
        />
      </motion.div>
    </motion.div>
  );
}

interface CertificateLightboxProps {
  items: CertificateItem[];
  activeId: string | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={direction === "left" ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/**
 * The full-size certificate viewer.
 *
 * The document is shown as its rendered image at whatever size the viewport
 * allows, capped by `max-h`/`max-w` and its own aspect ratio, so it is never
 * stretched or cropped. That is deliberately not a `<embed>` or `<iframe>`
 * of the PDF: the browser's built-in PDF plugin brings its own toolbar,
 * scrollbars and background, which cannot be styled and looks nothing like
 * the rest of the site. The original PDF stays one click away for anyone who
 * wants the real document.
 *
 * Moving between certificates swaps the image inside the open modal rather
 * than closing and reopening it. Only the image and the metadata are keyed,
 * so the frame, the backdrop and the controls all stay put.
 */
export function CertificateLightbox({
  items,
  activeId,
  onClose,
  onNavigate,
}: CertificateLightboxProps) {
  const reduceMotion = useReducedMotion();
  const isOpen = activeId !== null;
  const containerRef = useModalBehavior(isOpen, onClose);

  const index = items.findIndex((item) => item.id === activeId);
  const item = index >= 0 ? items[index] : null;
  // Wraps, so the gallery can be walked end to end without dead ends.
  const previous = items[(index - 1 + items.length) % items.length];
  const next = items[(index + 1) % items.length];

  // Which way the deck is moving. Held in state rather than derived from the
  // index, because wrapping from the last certificate to the first is a step
  // forward even though the index goes down.
  const [direction, setDirection] = useState(1);
  // The certificate the modal was opened on. Only this one animates out of
  // its thumbnail; see the note on `useSharedLayout`.
  //
  // Adjusted during render rather than in an effect: an effect runs after the
  // first paint, so the opening frame would go out with this still unset and
  // the shared-layout expansion would be skipped. Setting state during render
  // in response to a changed prop is the supported pattern for exactly this,
  // and React re-runs the component immediately without painting in between.
  const [openState, setOpenState] = useState<{ open: boolean; openedId: string | null }>({
    open: false,
    openedId: null,
  });
  if (isOpen !== openState.open) {
    setOpenState({ open: isOpen, openedId: isOpen ? activeId : null });
  }

  // Drag offset of the active card, mirrored here so the backdrop can react
  // to it. Written only while a drag is in progress.
  const dragOffset = useMotionValue(0);
  const backdropOpacity = useTransform(dragOffset, [-EXIT_X, 0, EXIT_X], [0.55, 0.7, 0.55]);

  function go(towards: number) {
    setDirection(towards);
    onNavigate(towards === 1 ? next.id : previous.id);
  }

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        setDirection(-1);
        onNavigate(previous.id);
      }
      if (event.key === "ArrowRight") {
        setDirection(1);
        onNavigate(next.id);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onNavigate, previous, next]);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.fast }}
        >
          <motion.button
            type="button"
            aria-label="Close certificate viewer"
            onClick={onClose}
            // Opacity comes from the drag offset alone: the backdrop lifts
            // very slightly as a card is pulled aside, which is the only way
            // the surroundings can visibly respond while they sit behind an
            // opaque scrim. No `animate` here on purpose, because `animate`
            // cannot write to a derived motion value; the wrapper above
            // already fades the whole layer in and out.
            style={reduceMotion ? { opacity: 0.7 } : { opacity: backdropOpacity }}
            className="absolute inset-0 bg-black backdrop-blur-sm"
          />

          <div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${item.title}, ${item.issuer}`}
            className="relative flex max-h-full w-full max-w-5xl flex-col"
          >
            {/* A fixed-height stage the cards move inside.
                The frame used to hug the image, which meant switching between
                a portrait and a landscape certificate resized it and pushed
                the metadata bar below up or down. With a stage of its own
                height, each card sizes itself to its document inside it: the
                cards can slide past each other, nothing around them moves,
                and every certificate keeps its exact aspect ratio. */}
            <div className="relative h-[68vh] min-h-0">
              <AnimatePresence initial={false} custom={direction}>
                <CertificateSlide
                  key={item.id}
                  item={item}
                  direction={direction}
                  isActive
                  useSharedLayout={openState.openedId === item.id}
                  reduceMotion={Boolean(reduceMotion)}
                  onCommit={go}
                  onDragOffset={(offset) => dragOffset.set(offset)}
                />
              </AnimatePresence>
            </div>

            <motion.div
              initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: duration.fast, delay: 0.05 }}
              className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-2xl border border-border bg-bg-elevated/95 px-4 py-3 backdrop-blur-sm sm:px-5"
            >
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-fg">{item.title}</h3>
                <p className="mt-0.5 font-mono text-[11px] text-accent">{item.issuer}</p>
                {item.detail && (
                  <p className="mt-1 text-[11px] leading-snug text-fg-muted">{item.detail}</p>
                )}
                <p className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-fg-faint">
                  {item.issued && <span>Issued {item.issued}</span>}
                  {item.credentialId && (
                    <span className="font-mono">ID {item.credentialId}</span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {item.documentUrl && (
                  <a
                    href={item.documentUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-full border border-border px-3 py-1.5 text-[11px] font-medium text-fg-muted transition-colors hover:border-accent hover:text-accent"
                  >
                    Original PDF
                  </a>
                )}
                {item.verifyUrl && (
                  <a
                    href={item.verifyUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-full border border-border px-3 py-1.5 text-[11px] font-medium text-fg-muted transition-colors hover:border-accent hover:text-accent"
                  >
                    Verify
                  </a>
                )}
              </div>
            </motion.div>

            {/* Counter plus the two controls in one row, so the position in
                the set is always visible while stepping through it. */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <motion.button
                type="button"
                onClick={() => go(-1)}
                whileTap={scaleTap}
                aria-label={`Previous certificate: ${previous.title}`}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-elevated px-3.5 py-2 text-xs font-medium text-fg transition-colors hover:border-accent hover:text-accent"
              >
                <ArrowIcon direction="left" />
                Previous
              </motion.button>

              <span className="font-mono text-[11px] text-fg-faint">
                {index + 1} / {items.length}
              </span>

              <motion.button
                type="button"
                onClick={() => go(1)}
                whileTap={scaleTap}
                aria-label={`Next certificate: ${next.title}`}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-elevated px-3.5 py-2 text-xs font-medium text-fg transition-colors hover:border-accent hover:text-accent"
              >
                Next
                <ArrowIcon direction="right" />
              </motion.button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close certificate viewer"
              className="absolute -top-3 -right-1 grid h-9 w-9 place-items-center rounded-full border border-border bg-bg-elevated text-fg-muted transition-colors hover:border-accent hover:text-accent sm:-top-4 sm:-right-4"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
