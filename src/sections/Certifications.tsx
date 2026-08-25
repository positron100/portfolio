import { useState } from "react";
import { motion } from "framer-motion";
import { SectionBigTitle } from "@/components/SectionBigTitle";
import { CertificateCard } from "@/components/CertificateCard";
import { CertificateLightbox } from "@/components/CertificateLightbox";
import { Reveal } from "@/components/Reveal";
import { certificates } from "@/data/certificates";
import { useConnectedScroll } from "@/hooks/useConnectedScroll";
import type { CertificateItem } from "@/types";

export function Certifications() {
  const { sectionRef, style } = useConnectedScroll();
  const [activeId, setActiveId] = useState<string | null>(null);

  function handleOpen(item: CertificateItem) {
    setActiveId(item.id);
  }

  return (
    <section ref={sectionRef} id="certifications" className="border-b border-border py-20 sm:py-24">
      <motion.div style={style} className="container-px mx-auto max-w-6xl">
        {/* The one heading for the section, same component every other
            section uses. Nothing else here is a heading above h3. */}
        <SectionBigTitle
          bigWord="Certifications"
          subtitle="Credentials, as issued."
          description="Every document here is the real certificate. Open one to read it at full size."
        />

        {/* CSS columns, not a grid.
            These documents run from 4:3 landscape to A4 portrait, and a grid
            locks every row to its tallest cell: one portrait certificate left
            a half-screen of dead space under the two landscape cards beside
            it. Columns pack each card directly under the previous one, so the
            varying proportions read as deliberate rhythm instead of as gaps.
            No masonry library and no row-span maths, and `break-inside-avoid`
            is all that is needed to stop a card splitting across a column. */}
        <div className="columns-2 gap-x-4 sm:gap-x-6 lg:columns-3">
          {certificates.map((item, index) => (
            <Reveal
              key={item.id}
              delay={Math.min(index, 5) * 0.05}
              className="mb-8 break-inside-avoid"
            >
              <CertificateCard item={item} onOpen={handleOpen} />
            </Reveal>
          ))}
        </div>
      </motion.div>

      <CertificateLightbox
        items={certificates}
        activeId={activeId}
        onClose={() => setActiveId(null)}
        onNavigate={setActiveId}
      />
    </section>
  );
}
