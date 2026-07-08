import type { WifiBoardConnectionMode } from "./wifiBoard";

/** One-line description shown under each tab button when active. */
export const WIFI_TAB_SUMMARIES = {
  field:
    "Use the board on your Flipper while tethered to this PC — launch the companion app, mirror the screen, and pull captures.",
  setup:
    "One-time prep: flash Marauder onto the ESP32 over USB, then copy the Flipper companion app to the SD card.",
  console:
    "Desk debugging: talk directly to the ESP32 over its USB port (board must be plugged into the PC, not only the Flipper).",
  captures:
    "Download WiFi scan logs and PCAP files that Marauder saved onto the Flipper SD card.",
  guide:
    "How the pieces fit together — hardware, wiring, and which tab to use when.",
} as const;

export type WifiTabId = keyof typeof WIFI_TAB_SUMMARIES;

export const WIFI_GLOSSARY = [
  {
    term: "ESP32 / WiFi board",
    definition:
      "A small WiFi module (often ESP32) running Marauder firmware. It does the actual radio work — scanning, sniffing, etc. The Flipper has no built-in WiFi.",
  },
  {
    term: "Marauder firmware",
    definition:
      "Third-party firmware installed on the ESP32. Provides a text-based CLI over serial (115200 baud) and WiFi/BLE features depending on the board.",
  },
  {
    term: "Companion FAP",
    definition:
      "A Flipper app (esp32_wifi_marauder.fap) on your SD card. It sends commands to the ESP32 over GPIO UART (pins PC0/PC1) and shows menus on the Flipper screen.",
  },
  {
    term: "This desktop app",
    definition:
      "Helps you flash the ESP32, deploy the companion FAP, debug over USB, operate tethered in the Field tab, and download capture files. It does not replace the companion app when you are walking around untethered.",
  },
] as const;

export const CONNECTION_MODE_HELP: Record<
  WifiBoardConnectionMode,
  { title: string; body: string; whatYouCanDo: string }
> = {
  passthrough: {
    title: "Dev board passthrough",
    body:
      "The official WiFi dev board is in the Flipper, and qFlipper USB Channel 0 forwards the ESP serial to your PC. The Field console can send Marauder commands from here.",
    whatYouCanDo:
      "Launch on Flipper, use Field console quick actions, and download captures — all while the board stays slotted.",
  },
  direct_usb: {
    title: "ESP USB direct",
    body:
      "The ESP32 is plugged into your PC over USB (often with the board removed from the Flipper). This is the same path as the Setup and Console tabs.",
    whatYouCanDo:
      "Flash, debug CLI, and use Field console. For portable use, re-attach the board to the Flipper and switch to Field → Launch.",
  },
  flipper_only: {
    title: "Flipper + GPIO UART",
    body:
      "The ESP32 is wired or slotted on the Flipper, but its USB is not connected to the PC. Commands travel Flipper ↔ ESP over UART only — the desktop cannot inject CLI commands on this path.",
    whatYouCanDo:
      "Launch the companion app and use Screen Stream to see and drive the Flipper UI from your PC. Pull captures from SD as they appear.",
  },
  disconnected: {
    title: "Not connected",
    body: "Connect your Flipper over USB or Bluetooth so this app can deploy apps, launch the companion, and read the SD card.",
    whatYouCanDo:
      "Connect Flipper first. ESP USB is only needed in Setup or Console for flashing/debugging.",
  },
};

export const SETUP_STEP_HELP = {
  hardware:
    "Pick how your ESP32 attaches to the Flipper. The choice is saved immediately and Field readiness waits on it. It also drives wiring notes and which firmware profile to use — both paths need Marauder on the ESP and the companion FAP on SD.",
  wiring:
    "Cross the UART lines: Flipper transmits on PC1 into ESP RX, Flipper receives on PC0 from ESP TX. Share ground and power the ESP from 3.3V (not 5V unless your module explicitly needs OTG).",
  esptool:
    "esptool writes Marauder to the ESP32. The ESP must be on USB to your PC for this step — the Flipper is not involved in flashing.",
  profile:
    "Each profile matches a different board layout and Marauder build. Use Detect chip if unsure. Official Flipper dev board → ESP32-S2 (Flipper-style).",
  firmware:
    "Downloads bootloader, partition table, and Marauder binary from GitHub and caches them locally. You need this before Flash.",
  flash:
    "Full flash = new or erased board. App only = update Marauder without touching the bootloader. Close the Console tab first if it is connected.",
  companion:
    "The companion FAP is the on-Flipper remote for the ESP. After deploy, use Field → Launch (or Apps → GPIO → WiFi Marauder on the device).",
} as const;

export const FIELD_SECTION_HELP = {
  readiness:
    "Checks that this app can help you operate: Flipper linked, companion app on SD, hardware setup chosen in Setup (Custom GPIO vs Official Dev Board), and how the ESP is reachable from the PC (if at all).",
  launch:
    "Launch starts the companion FAP on the Flipper. Screen Stream mirrors what you would see on the device — useful when the ESP is on GPIO and there is no USB serial to the PC. If Launch says another app is running, Exit on the Flipper or use Stop app here first.",
  console:
    "Only available when the ESP serial reaches your PC (USB direct or dev-board passthrough). Sends the same text commands as the Marauder CLI wiki.",
  captures:
    "Marauder saves PCAP/CSV/logs to the Flipper SD while the companion app runs. This list refreshes automatically; download to analyze on your PC (e.g. Wireshark).",
  power:
    "Most ESP32 modules on the GPIO header use 3.3V from the Flipper. OTG enables +5V on the VCC pin — only if your hardware requires it.",
} as const;

/** Map Flipper RPC app-start failures to actionable copy. */
export function formatAppStartError(message: string): string {
  if (/\bstatus\s*=\s*17\b/i.test(message)) {
    return "Another Flipper app is already running. Stop it on the device (or use Stop app), then Launch again.";
  }
  return message;
}
