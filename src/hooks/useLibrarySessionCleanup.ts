import { useEffect } from "react";
import { useFlipperStore, type ActiveView } from "../store/useFlipperStore";
import { stopAllLibrarySessions } from "../lib/librarySessions";

/**
 * Stop active on-device library sessions when leaving a library view.
 */
export function useLibrarySessionCleanup(view: ActiveView): void {
  const activeView = useFlipperStore((s) => s.activeView);

  useEffect(() => {
    if (activeView !== view) {
      void stopAllLibrarySessions();
    }
  }, [activeView, view]);
}
