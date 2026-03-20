import { useEffect, useState } from "react";

/** Responsive cap for suggested-meal tray: mobile 4, tablet 6, desktop 8. */
export function useSuggestedTrayCap(): number {
  const [cap, setCap] = useState(8);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setCap(8);
      return;
    }
    let mqLg: MediaQueryList;
    let mqSm: MediaQueryList;
    try {
      mqLg = window.matchMedia("(min-width: 1024px)");
      mqSm = window.matchMedia("(min-width: 640px)");
    } catch {
      setCap(8);
      return;
    }
    if (!mqLg || !mqSm || typeof mqLg.matches !== "boolean" || typeof mqSm.matches !== "boolean") {
      setCap(8);
      return;
    }

    function sync() {
      if (mqLg.matches) setCap(8);
      else if (mqSm.matches) setCap(6);
      else setCap(4);
    }

    sync();
    mqLg.addEventListener("change", sync);
    mqSm.addEventListener("change", sync);
    return () => {
      mqLg.removeEventListener("change", sync);
      mqSm.removeEventListener("change", sync);
    };
  }, []);

  return cap;
}
