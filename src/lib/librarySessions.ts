import { confirm } from "@tauri-apps/plugin-dialog";
import {
  badusbRunStop,
  infraredTxStop,
  nfcEmulateStop,
  rfidEmulateStop,
  subghzTxStop,
} from "./tauri";
import { useFlipperStore } from "../store/useFlipperStore";

/** Stop every in-progress library on-device session. Safe to call when idle. */
export async function stopAllLibrarySessions(): Promise<void> {
  const s = useFlipperStore.getState();
  const stops: Promise<void>[] = [];
  if (s.subghzTransmittingPath) {
    stops.push(subghzTxStop().catch(() => {}));
  }
  if (s.nfcEmulatingPath) {
    stops.push(nfcEmulateStop().catch(() => {}));
  }
  if (s.rfidEmulatingPath) {
    stops.push(rfidEmulateStop().catch(() => {}));
  }
  if (s.irTransmittingPath) {
    stops.push(infraredTxStop().catch(() => {}));
  }
  if (s.badusbRunningPath) {
    stops.push(badusbRunStop().catch(() => {}));
  }
  await Promise.all(stops);
  useFlipperStore.setState({
    subghzTransmittingPath: null,
    nfcEmulatingPath: null,
    rfidEmulatingPath: null,
    irTransmittingPath: null,
    badusbRunningPath: null,
  });
}

/** Confirm before starting RF / emulation actions that affect the real world. */
export async function confirmLibraryAction(
  title: string,
  message: string,
): Promise<boolean> {
  return confirm(message, {
    title,
    kind: "warning",
    okLabel: "Continue",
    cancelLabel: "Cancel",
  });
}
