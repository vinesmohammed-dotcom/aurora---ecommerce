import { useEffect } from "react";

let lockCount = 0;
let previousOverflow = "";
let previousPaddingRight = "";

/**
 * Universal Scroll Lock Hook for Modals, Drawers, and Lightboxes
 * Safely locks background scrolling when active, compensates for scrollbar width,
 * and guarantees background scrolling is restored upon closing or unmounting.
 *
 * @param {boolean} isLocked - Whether background scrolling should currently be disabled
 */
export function useScrollLock(isLocked = false) {
  useEffect(() => {
    if (!isLocked) return;

    if (typeof document !== "undefined") {
      if (lockCount === 0) {
        previousOverflow = document.body.style.overflow;
        previousPaddingRight = document.body.style.paddingRight;

        // Prevent layout shift when scrollbar disappears
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
          document.body.style.paddingRight = `${scrollbarWidth}px`;
        }

        document.body.style.overflow = "hidden";
      }
      lockCount += 1;
    }

    return () => {
      if (typeof document !== "undefined") {
        lockCount = Math.max(0, lockCount - 1);
        if (lockCount === 0) {
          document.body.style.overflow = previousOverflow;
          document.body.style.paddingRight = previousPaddingRight;
        }
      }
    };
  }, [isLocked]);
}

export default useScrollLock;
