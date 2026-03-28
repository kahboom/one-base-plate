import { useEffect } from 'react';

let lockCount = 0;
let savedOverflow = '';

/**
 * Locks document body scroll while active. Reference-counted so nested modals
 * restore overflow only after the last lock releases.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    if (lockCount === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount++;

    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.overflow = savedOverflow;
      }
    };
  }, [active]);
}
