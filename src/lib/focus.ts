/**
 * On touch devices, Radix auto-focuses the first focusable element when an
 * overlay opens. If that element is a text input, the on-screen keyboard pops
 * up unrequested and covers the UI. This blocks that auto-focus on touch/
 * mobile viewports while keeping desktop keyboard behaviour intact.
 */
export function isTouchViewport() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ||
    window.innerWidth < 768
  );
}

export function preventMobileAutoFocus(event: Event) {
  if (isTouchViewport()) event.preventDefault();
}
