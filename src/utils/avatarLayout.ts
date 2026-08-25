// Mirrors Hero's own layout constants (`container-px` ≈ 1.25rem side
// padding, `max-w-6xl` container, the tagline's `max-w-xl` paragraph) so
// the avatar's size/position are derived from the actual space Hero's text
// leaves free, not a guessed pixel value. Shared by `DeveloperAvatar.tsx`
// (which renders the avatar) and `IntroParticles.tsx` (which needs to know
// how large the avatar will end up, so its dot-formation can hand off to it
// at a matching scale instead of two differently-sized things cross-fading).
const HERO_MAX_WIDTH = 1152;
const HERO_CONTAINER_PX = 20;
const HERO_TEXT_MAX_WIDTH = 576;
const HERO_TEXT_GAP = 64;

/** Below this the layout is treated as a phone: the avatar is smaller and
 * docks out of the way of Hero's text rather than beside it. Shared so the
 * opening sequence knows the same thing the avatar does. */
export const AVATAR_MIN_WIDTH = 1024;

export function isCompactViewport() {
  return window.innerWidth < AVATAR_MIN_WIDTH;
}

/**
 * The avatar renders everywhere now.
 *
 * It used to be desktop-only, which is why it was simply missing on a phone.
 * The reasons were screen space and device budget, and both are answered
 * rather than ignored: `avatarSize` gives a phone a much smaller form docked
 * clear of the text, and the r3f scene already caps its own resolution
 * (`dpr={[1, 1.5]}`) and idles a static frame when nothing is moving.
 *
 * Reduced motion still removes it entirely, in `DeveloperAvatar`.
 */
export function avatarIsRendered() {
  return true;
}

export function heroContainerRight() {
  const width = Math.min(window.innerWidth, HERO_MAX_WIDTH);
  const left = (window.innerWidth - width) / 2;
  return left + width - HERO_CONTAINER_PX;
}

export function avatarSize() {
  if (isCompactViewport()) {
    // A phone has no column to spare beside the text, so the avatar is
    // sized as a small companion instead: a share of the narrower edge,
    // bounded so it stays a presence on a large phone without dominating a
    // small one.
    const byWidth = window.innerWidth * 0.42;
    const byHeight = window.innerHeight * 0.22;
    return Math.round(Math.min(Math.max(Math.min(byWidth, byHeight), 120), 200));
  }
  const containerWidth = Math.min(window.innerWidth, HERO_MAX_WIDTH) - HERO_CONTAINER_PX * 2;
  const byAvailableWidth = containerWidth - HERO_TEXT_MAX_WIDTH - HERO_TEXT_GAP;
  const byHeight = window.innerHeight * 0.62;
  return Math.round(Math.min(Math.max(byAvailableWidth, 220), byHeight, 560));
}

// Right side of Hero, shifted in from the container's own edge rather than
// corner-pinned or hugging the raw viewport edge.
export function dockedCenter(size: number) {
  if (isCompactViewport()) {
    // Lower right, above the fold but below Hero's copy and its CTAs, so it
    // reads as sitting in the corner of the screen rather than on top of the
    // text. Kept a full margin off both edges.
    const margin = 16 + size * 0.1;
    return {
      x: window.innerWidth - margin - size / 2,
      y: window.innerHeight - margin - size / 2,
    };
  }
  const margin = size * 0.08;
  return { x: heroContainerRight() - margin - size / 2, y: window.innerHeight / 2 };
}

// Vertical space the opening sequence's caption + continue button occupy
// beneath the avatar, including the gap separating them from it.
// Gap tightened (was 40) so the caption sits a little higher under the
// avatar, and the block grown (was 132) to hold the now roughly twice-size
// caption plus the extra breathing room kept above the continue button.
const INTRO_CAPTION_GAP = 26;
const INTRO_CAPTION_BLOCK = 158;

/**
 * The opening sequence is one composition — avatar, caption, continue
 * button — vertically centered as a *group*, not three independently
 * placed elements. `IntroOverlay` positions the caption/button from
 * `captionTop`, and `DeveloperAvatar` positions the avatar (and
 * `IntroParticles` its dot field) from `avatarCenter`, both derived here so
 * they cannot drift apart at any viewport size.
 *
 * On narrow viewports the avatar itself isn't rendered (desktop only), but
 * the dot wireframe still is — so the same composition math applies, just
 * with the smaller `avatarSize()` a narrow viewport yields.
 */
export function introComposition(size: number) {
  const totalHeight = size + INTRO_CAPTION_GAP + INTRO_CAPTION_BLOCK;
  // Never let the group start above the viewport on short screens; the
  // caption/button can sit closer instead of the avatar being clipped.
  const top = Math.max(24, (window.innerHeight - totalHeight) / 2);
  return {
    avatarCenter: { x: window.innerWidth / 2, y: top + size / 2 },
    captionTop: Math.min(top + size + INTRO_CAPTION_GAP, window.innerHeight - INTRO_CAPTION_BLOCK),
  };
}
