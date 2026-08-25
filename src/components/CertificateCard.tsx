import { motion, useReducedMotion } from "framer-motion";
import type { CertificateItem } from "@/types";
import { useMagnetic } from "@/hooks/useMagnetic";
import { certificateLayoutId } from "@/utils/certificateLayoutId";
import { spring, scaleTap } from "@/utils/motion";
import { cn } from "@/utils/cn";

interface CertificateCardProps {
  item: CertificateItem;
  onOpen: (item: CertificateItem) => void;
}

/**
 * One credential in the gallery.
 *
 * The preview is the card. Metadata sits under it at a deliberately quiet
 * weight and only lifts to full strength on hover, so a wall of eight cards
 * reads as documents first and text second.
 *
 * The preview box carries the document's own aspect ratio rather than a
 * uniform one. Certificates here run from 4:3 landscape to A4 portrait, and
 * forcing them into identical rectangles would either crop signatures and
 * credential IDs off the edge or letterbox every card. Letting the ratio
 * vary is also what gives the grid its rhythm.
 */
export function CertificateCard({ item, onOpen }: CertificateCardProps) {
  const reduceMotion = useReducedMotion();
  // The site's one magnetic implementation, at the strength the project
  // cards use. No squash: these hold a photographic image, and deforming it
  // would read as a rendering fault rather than as a flourish.
  const magnetic = useMagnetic({ strength: 8 });

  return (
    <motion.button
      ref={magnetic.ref as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={() => onOpen(item)}
      onMouseMove={magnetic.onMouseMove}
      onMouseLeave={magnetic.onMouseLeave}
      style={magnetic.style}
      whileHover={reduceMotion ? undefined : { y: -6, transition: spring.soft }}
      whileTap={scaleTap}
      aria-label={`View ${item.title} from ${item.issuer}`}
      className="group block w-full text-left"
    >
      <motion.div
        layoutId={certificateLayoutId(item.id)}
        // `overflow-hidden` on the frame plus a scaling image inside is what
        // makes the preview push against its edges on hover without the
        // card itself changing size.
        className="relative overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-sm transition-colors group-hover:border-accent/50"
      >
        <img
          src={item.image}
          alt={`${item.title} issued by ${item.issuer}`}
          width={item.width}
          height={item.height}
          loading="lazy"
          decoding="async"
          style={{ aspectRatio: `${item.width} / ${item.height}` }}
          className={cn(
            "w-full object-cover transition-transform duration-500 ease-out",
            !reduceMotion && "group-hover:scale-[1.03]",
          )}
        />
        {item.kind === "letter" && (
          <span className="absolute top-3 right-3 rounded-full bg-bg-elevated/90 px-2.5 py-0.5 font-mono text-[10px] tracking-wide text-fg-muted uppercase backdrop-blur-sm">
            Letter
          </span>
        )}
      </motion.div>

      <div className="mt-3">
        <p className="text-sm font-semibold text-fg">{item.title}</p>
        <p className="mt-0.5 font-mono text-[11px] text-accent">{item.issuer}</p>
        {/* Held back at rest and brought up on hover: the default card state
            should be the document, not a paragraph of metadata. */}
        <p className="mt-1 text-[11px] leading-snug text-fg-faint transition-colors group-hover:text-fg-muted">
          {item.issued ?? item.detail}
        </p>
      </div>
    </motion.button>
  );
}
