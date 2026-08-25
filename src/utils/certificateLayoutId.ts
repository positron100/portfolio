/** Shared-layout key tying a certificate card's preview to the same preview
 * inside the lightbox, so opening one expands rather than cross-fades.
 * Namespaced the same way `projectLayoutId` is, so the two can never collide. */
export function certificateLayoutId(id: string) {
  return `certificate-${id}`;
}
