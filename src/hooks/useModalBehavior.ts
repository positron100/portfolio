import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function useModalBehavior(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    triggerRef.current = document.activeElement as HTMLElement | null;

    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    // Locking the body removes the scrollbar, and the page reflows by its
    // width the instant it does. That reflow lands in the middle of the
    // card's shared-layout transition: the origin card was measured before
    // it and is somewhere else after it, which is the modal briefly
    // appearing offset from where it should be. Replacing the scrollbar's
    // width with padding keeps the layout perfectly still.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    // Announce that a full-screen surface is up. The decorative avatar reads
    // this and stops both its follow loop and its WebGL render while it is
    // set: it sits at z-40 behind a z-60 modal and an opaque scrim, so none
    // of that work is visible, and on a mid-range phone it was competing for
    // the GPU with the very animation the visitor is looking at. One
    // attribute rather than a store: nothing here should re-render React.
    document.documentElement.dataset.modalOpen = "true";

    const container = containerRef.current;
    const focusables = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusables?.[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !container) return;

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      delete document.documentElement.dataset.modalOpen;
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [isOpen, onClose]);

  return containerRef;
}
