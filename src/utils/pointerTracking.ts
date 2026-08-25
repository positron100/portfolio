/**
 * The site's single "where is the pointer/finger right now" subscription.
 *
 * Two things need this — the avatar's position loop (`DeveloperAvatar.tsx`)
 * and its eye/rotation loop (`DeveloperAvatarScene.tsx`) — and both had their
 * own copy of the listener wiring, so both carried the same mobile bug.
 *
 * ## The bug this exists to fix
 *
 * Listening to `pointermove` alone looks correct and works perfectly with a
 * mouse, but on a touch screen it silently stops partway through a gesture:
 * the moment the browser decides a touch is a page scroll, it claims the
 * gesture, fires `pointercancel`, and **stops sending `pointermove`
 * entirely** for the rest of that touch. The last coordinate to arrive is
 * wherever the finger was when scrolling took over, so the avatar froze there
 * and then eased to that stale point — exactly the "it only reacts to the
 * last known touch position" behaviour, and the reason it looked like the
 * avatar was sampling touches rather than following them.
 *
 * `touchmove` has no such rule: a passive `touchmove` listener keeps
 * receiving every sample for the whole gesture, scrolling included. So both
 * are subscribed, and whichever arrives first each frame wins. On a touch
 * device the two overlap and report the same coordinates, which costs nothing
 * — the handler only writes into a ref.
 *
 * ## Rules this must keep
 *
 * Every listener is **passive** and none of them ever calls
 * `preventDefault()`. The avatar is decorative; it may observe the finger but
 * must never take the gesture away from the page. Scrolling, taps, buttons,
 * form fields, card drags and the theme toggle all behave exactly as if this
 * were not here.
 */
export function trackPointerPosition(onMove: (x: number, y: number) => void): () => void {
  function fromPointer(event: PointerEvent) {
    // A touch fires `pointermove` *and* `touchmove` for the same finger
    // sample, and there are two subscribers (the avatar's position loop and
    // its eye tracking) — so one sample was running four handler bodies.
    // `touchmove` is the one that must stay, because it is the only one that
    // survives the browser claiming the gesture for a scroll. Pointer events
    // are therefore for mouse and pen only, which halves the per-sample work
    // on a phone and changes nothing on a desktop.
    if (event.pointerType === "touch") return;
    onMove(event.clientX, event.clientY);
  }

  // A tap is a down and an up with no movement between them, so the down has
  // to count too — otherwise a phone could only steer by dragging.
  function fromTouch(event: TouchEvent) {
    const touch = event.touches[0];
    if (touch) onMove(touch.clientX, touch.clientY);
  }

  const options = { passive: true } as const;
  window.addEventListener("pointermove", fromPointer, options);
  window.addEventListener("pointerdown", fromPointer, options);
  window.addEventListener("touchmove", fromTouch, options);
  window.addEventListener("touchstart", fromTouch, options);

  return () => {
    window.removeEventListener("pointermove", fromPointer);
    window.removeEventListener("pointerdown", fromPointer);
    window.removeEventListener("touchmove", fromTouch);
    window.removeEventListener("touchstart", fromTouch);
  };
}

/**
 * Whether a full-screen surface (currently the project modal) is open, as a
 * subscribable signal off `documentElement.dataset.modalOpen`.
 *
 * A `MutationObserver` rather than React state threaded through the tree: the
 * modal and the avatar are in unrelated parts of the app, this changes twice
 * per interaction, and the observer fires only on an actual attribute change.
 */
export function observeModalOpen(onChange: (open: boolean) => void): () => void {
  const read = () => onChange(document.documentElement.dataset.modalOpen === "true");
  read();
  const observer = new MutationObserver(read);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-modal-open"] });
  return () => observer.disconnect();
}

/** True on devices whose primary input is a finger — the ones that need the
 * cheaper render path. Read once at call time; a device does not change. */
export function isCoarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}
