import { ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

import {
  WIFI_GLOSSARY,
  WIFI_TAB_SUMMARIES,
  type WifiTabId,
} from "../../lib/wifiBoardCopy";
import { useFlipperStore } from "../../store/useFlipperStore";
import { WifiBoardInfoPanel } from "./WifiBoardInfoPanel";

const LINKS = [
  {
    label: "ESP32 Marauder project",
    url: "https://github.com/justcallmekoko/ESP32Marauder",
  },
  {
    label: "Marauder CLI wiki",
    url: "https://github.com/justcallmekoko/ESP32Marauder/wiki/CLI",
  },
  {
    label: "WiFi Marauder companion FAP",
    url: "https://github.com/0xchocolate/flipperzero-wifi-marauder",
  },
  {
    label: "Flipper Lab app page",
    url: "https://lab.flipper.net/apps/esp32_wifi_marauder",
  },
  {
    label: "Official WiFi dev board docs",
    url: "https://docs.flipper.net/gpio-and-modules/wifi-module",
  },
];

const TAB_PICKER: { id: WifiTabId; when: string }[] = [
  {
    id: "setup",
    when: "First time — flash the ESP32 and put the companion app on SD",
  },
  {
    id: "field",
    when: "Board on Flipper + PC connected — launch, mirror, tethered control",
  },
  {
    id: "console",
    when: "Desk debugging — ESP32 USB plugged into the PC only",
  },
  {
    id: "captures",
    when: "Download PCAP/logs from Flipper SD after a session",
  },
];

export function WifiBoardGuideView({
  onSelectTab,
}: {
  onSelectTab?: (tab: WifiTabId) => void;
}) {
  const setActiveView = useFlipperStore((s) => s.setActiveView);
  const isConnected = useFlipperStore((s) => s.isConnected);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-sm">
      <WifiBoardInfoPanel title="How the pieces fit together" variant="tip">
        <ol className="list-decimal list-inside space-y-2 text-muted">
          <li>
            <strong className="text-secondary">ESP32</strong> runs Marauder
            firmware and does WiFi/BLE radio work.
          </li>
          <li>
            <strong className="text-secondary">Companion FAP</strong> on Flipper
            SD sends commands to the ESP over GPIO UART (PC0/PC1).
          </li>
          <li>
            <strong className="text-secondary">This desktop app</strong> flashes
            the ESP, deploys the FAP, can mirror the Flipper screen, and
            optionally talks to the ESP over USB when available.
          </li>
        </ol>
        <p className="mt-2 text-dim">
          There is no separate “turn on” step — power the ESP from 3.3V + GND
          (GPIO wiring) or slot the official dev board. Marauder starts when
          the companion app runs on the Flipper.
        </p>
      </WifiBoardInfoPanel>

      <section className="space-y-2">
        <h2 className="font-medium">Which tab should I use?</h2>
        <ul className="space-y-2">
          {TAB_PICKER.map(({ id, when }) => (
            <li
              key={id}
              className="text-xs border border-border-subtle rounded-md p-2 flex flex-wrap items-center justify-between gap-2"
            >
              <span className="text-muted">
                <strong className="text-secondary capitalize">{id}</strong>
                {" — "}
                {when}
              </span>
              {onSelectTab && (
                <button
                  type="button"
                  className="text-accent hover:underline shrink-0"
                  onClick={() => onSelectTab(id)}
                >
                  Open tab →
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-dim">{WIFI_TAB_SUMMARIES.guide}</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Glossary</h2>
        <dl className="space-y-2">
          {WIFI_GLOSSARY.map(({ term, definition }) => (
            <div
              key={term}
              className="text-xs border border-border-subtle/60 rounded-md p-2"
            >
              <dt className="font-medium text-secondary">{term}</dt>
              <dd className="text-muted mt-0.5">{definition}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Custom ESP32 on GPIO</h2>
        <ol className="text-xs text-muted list-decimal list-inside space-y-1">
          <li>
            <strong>Setup</strong> — flash Marauder with ESP on USB to PC.
          </li>
          <li>Wire PC1→ESP RX, PC0→ESP TX, GND, 3.3V.</li>
          <li>
            <strong>Setup</strong> — deploy companion FAP to SD.
          </li>
          <li>
            <strong>Field</strong> — Launch + Screen Stream (CLI from PC not
            available over GPIO).
          </li>
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Official Flipper WiFi Dev Board</h2>
        <ol className="text-xs text-muted list-decimal list-inside space-y-1">
          <li>Remove board → USB to PC → <strong>Setup</strong> flash (ESP32-S2 profile).</li>
          <li>Re-slot into Flipper → deploy companion FAP.</li>
          <li>
            <strong>Field</strong> — Launch on Flipper; optional passthrough
            console if qFlipper USB Channel 0 @ 115200 is enabled.
          </li>
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">USB vs GPIO — common confusion</h2>
        <WifiBoardInfoPanel>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>
              <strong>ESP USB → PC</strong> — used in Setup (flash) and Console
              (debug). Flipper can be unplugged.
            </li>
            <li>
              <strong>ESP on Flipper GPIO / dev slot</strong> — used in the
              field. Control via companion app; desktop uses Screen Stream unless
              passthrough exposes serial.
            </li>
            <li>
              <strong>Flipper USB → PC</strong> — lets this app deploy apps,
              launch companion, read SD captures, and mirror the screen. Does
              not by itself carry Marauder CLI unless dev-board passthrough is
              configured.
            </li>
          </ul>
        </WifiBoardInfoPanel>
      </section>

      {isConnected && (
        <button
          type="button"
          className="text-xs text-accent hover:underline"
          onClick={() => setActiveView("screen")}
        >
          Open Screen Stream — mirror Flipper after launching companion →
        </button>
      )}

      <ul className="space-y-2 pt-2">
        {LINKS.map((l) => (
          <li key={l.url}>
            <button
              type="button"
              className="text-xs text-accent hover:underline flex items-center gap-1"
              onClick={() => void openUrl(l.url)}
            >
              {l.label} <ExternalLink size={12} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
