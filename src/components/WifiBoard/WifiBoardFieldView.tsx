import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Monitor,
  Play,
  Power,
  RefreshCw,
  Square,
  Terminal,
  XCircle,
  Zap,
} from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";

import {
  COMPANION_FAP_PATH,
  MARAUDER_QUICK_GROUPS,
  useMarauderConsole,
} from "../../hooks/useMarauderConsole";
import { loadSettings, subscribeSettings } from "../../lib/settings";
import { appExit, appStart, gpioSetOtg, gpioSnapshot } from "../../lib/tauri";
import {
  marauderDownloadCapture,
  marauderListCaptures,
  type BoardSetupType,
  type MarauderCaptureFile,
  type WifiBoardConnectionMode,
  type WifiBoardFieldStatus,
  wifiBoardFieldStatus,
} from "../../lib/wifiBoard";
import {
  CONNECTION_MODE_HELP,
  FIELD_SECTION_HELP,
  formatAppStartError,
} from "../../lib/wifiBoardCopy";
import { useFlipperStore } from "../../store/useFlipperStore";
import { WifiBoardInfoPanel, WifiBoardTabIntro } from "./WifiBoardInfoPanel";

const FIELD_POLL_MS = 4000;
const CAPTURE_POLL_MS = 10000;

const MODE_LABELS: Record<WifiBoardConnectionMode, string> = {
  passthrough: CONNECTION_MODE_HELP.passthrough.title,
  direct_usb: CONNECTION_MODE_HELP.direct_usb.title,
  flipper_only: CONNECTION_MODE_HELP.flipper_only.title,
  disconnected: CONNECTION_MODE_HELP.disconnected.title,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatTs(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString();
}

interface WifiBoardFieldViewProps {
  onGoToSetup?: () => void;
  onGoToCaptures?: () => void;
  onGoToConsole?: () => void;
}

export function WifiBoardFieldView({
  onGoToSetup,
  onGoToCaptures,
  onGoToConsole,
}: WifiBoardFieldViewProps) {
  const isConnected = useFlipperStore((s) => s.isConnected);
  const setActiveView = useFlipperStore((s) => s.setActiveView);

  const [fieldStatus, setFieldStatus] = useState<WifiBoardFieldStatus | null>(null);
  const [setupType, setSetupType] = useState<BoardSetupType | null>(null);
  const [launchBusy, setLaunchBusy] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [otg, setOtg] = useState(false);
  const [otgBusy, setOtgBusy] = useState(false);

  const [captures, setCaptures] = useState<MarauderCaptureFile[]>([]);
  const [capturesLoading, setCapturesLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const knownPathsRef = useRef<Set<string>>(new Set());
  const [newCapturePaths, setNewCapturePaths] = useState<Set<string>>(new Set());

  const consolePort =
    fieldStatus?.connection_mode === "passthrough"
      ? fieldStatus.passthrough_port
      : fieldStatus?.connection_mode === "direct_usb"
        ? fieldStatus.direct_esp_port
        : null;

  const console = useMarauderConsole({
    preferredPort: consolePort,
    autoSelectPreferred: true,
  });

  const refreshFieldStatus = useCallback(async () => {
    try {
      setFieldStatus(await wifiBoardFieldStatus());
    } catch {
      setFieldStatus(null);
    }
  }, []);

  const refreshCaptures = useCallback(async () => {
    if (!isConnected) {
      setCaptures([]);
      setNewCapturePaths(new Set());
      knownPathsRef.current = new Set();
      return;
    }
    setCapturesLoading(true);
    try {
      const files = await marauderListCaptures();
      const sorted = [...files].sort((a, b) => b.modified - a.modified);
      const known = knownPathsRef.current;
      const fresh = sorted.filter((f) => !known.has(f.path)).map((f) => f.path);
      if (known.size > 0 && fresh.length > 0) {
        setNewCapturePaths((prev) => new Set([...prev, ...fresh]));
      }
      knownPathsRef.current = new Set(sorted.map((f) => f.path));
      setCaptures(sorted);
    } catch {
      setCaptures([]);
    } finally {
      setCapturesLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    void loadSettings().then((s) => {
      setSetupType(s.wifiBoard.setupType);
    });
    return subscribeSettings((s) => {
      setSetupType(s.wifiBoard.setupType);
    });
  }, []);

  useEffect(() => {
    void refreshFieldStatus();
    const id = window.setInterval(() => void refreshFieldStatus(), FIELD_POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshFieldStatus, isConnected]);

  useEffect(() => {
    void refreshCaptures();
    const id = window.setInterval(() => void refreshCaptures(), CAPTURE_POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshCaptures]);

  useEffect(() => {
    if (!isConnected) return;
    void gpioSnapshot()
      .then((s) => setOtg(s.otg))
      .catch(() => {});
  }, [isConnected]);

  const launchCompanion = async () => {
    setLaunchBusy(true);
    setLaunchError(null);
    try {
      await appStart(COMPANION_FAP_PATH, "");
      const settings = await loadSettings();
      if (settings.wifiBoard.autoOpenScreenStream) {
        setActiveView("screen");
      }
    } catch (e) {
      const raw = (e as Error).message || String(e);
      setLaunchError(formatAppStartError(raw));
    } finally {
      setLaunchBusy(false);
    }
  };

  const stopCompanion = async () => {
    setLaunchBusy(true);
    setLaunchError(null);
    try {
      await appExit();
    } catch (e) {
      setLaunchError((e as Error).message || String(e));
    } finally {
      setLaunchBusy(false);
    }
  };

  const toggleOtg = async () => {
    setOtgBusy(true);
    try {
      const next = !otg;
      await gpioSetOtg(next);
      setOtg(next);
    } finally {
      setOtgBusy(false);
    }
  };

  const downloadCapture = async (file: MarauderCaptureFile) => {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "pcap";
    const localPath = await openDialog({
      defaultPath: file.name,
      filters: [{ name: "Capture", extensions: [ext ?? "pcap"] }],
    });
    if (!localPath || Array.isArray(localPath)) return;
    setDownloading(file.path);
    try {
      await marauderDownloadCapture(file.path, localPath);
    } finally {
      setDownloading(null);
    }
  };

  const downloadAllNew = async () => {
    const targets = captures.filter((f) => newCapturePaths.has(f.path));
    if (targets.length === 0) return;
    const folder = await openDialog({ directory: true, multiple: false });
    if (!folder || Array.isArray(folder)) return;
    setBatchBusy(true);
    try {
      for (const file of targets) {
        const sep = folder.includes("\\") ? "\\" : "/";
        const dest = `${folder}${sep}${file.name}`;
        await marauderDownloadCapture(file.path, dest);
      }
      setNewCapturePaths(new Set());
    } finally {
      setBatchBusy(false);
    }
  };

  const newCount = newCapturePaths.size;

  const showConsole =
    fieldStatus?.connection_mode === "passthrough" ||
    fieldStatus?.connection_mode === "direct_usb";
  const showPassthroughGuide =
    setupType === "official_devboard" &&
    fieldStatus?.connection_mode === "flipper_only" &&
    isConnected;
  const showGpioOnlyInfo = fieldStatus?.connection_mode === "flipper_only";
  const showGpioPower = setupType === "custom_gpio" && isConnected;

  const readinessRows = [
    {
      label: "Flipper connected",
      ok: fieldStatus?.flipper_connected ?? false,
      warn: false,
    },
    {
      label: "Companion FAP on SD",
      ok: fieldStatus?.companion_on_sd === true,
      warn: fieldStatus?.companion_on_sd === false,
      blocked: !isConnected,
    },
    {
      label: "Hardware setup chosen",
      ok: setupType !== null,
      warn: setupType === null,
    },
    {
      label: `Connection: ${fieldStatus ? MODE_LABELS[fieldStatus.connection_mode] : "…"}`,
      ok:
        fieldStatus?.connection_mode === "passthrough" ||
        fieldStatus?.connection_mode === "direct_usb" ||
        fieldStatus?.connection_mode === "flipper_only",
      warn: fieldStatus?.connection_mode === "disconnected",
    },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
      <WifiBoardTabIntro
        title="Field operations"
        summary="Use this tab when the ESP is on your Flipper and the Flipper is linked to this PC. You can start the companion app, mirror its screen, run CLI commands if USB/passthrough is available, and download captures."
        bullets={[
          "GPIO ESP (no ESP USB to PC): Launch + Screen Stream — not Field console",
          "Official dev board + qFlipper Channel 0: Field console works",
          "Complete Setup first if readiness shows missing companion FAP",
        ]}
      />

      {fieldStatus && (
        <WifiBoardInfoPanel
          title={CONNECTION_MODE_HELP[fieldStatus.connection_mode].title}
          variant={
            fieldStatus.connection_mode === "disconnected" ? "warn" : "info"
          }
        >
          <p>{CONNECTION_MODE_HELP[fieldStatus.connection_mode].body}</p>
          <p className="mt-1.5 text-dim">
            <strong className="text-secondary">You can:</strong>{" "}
            {CONNECTION_MODE_HELP[fieldStatus.connection_mode].whatYouCanDo}
          </p>
        </WifiBoardInfoPanel>
      )}

      <section className="border border-border-subtle rounded-md p-3 space-y-2 bg-surface/30">
        <h2 className="text-sm font-medium">Field readiness</h2>
        <p className="text-[11px] text-dim">{FIELD_SECTION_HELP.readiness}</p>
        <ul className="space-y-1">
          {readinessRows.map((row) => (
            <li key={row.label} className="flex items-center gap-2 text-xs">
              {row.blocked ? (
                <AlertTriangle size={14} className="text-dim shrink-0" />
              ) : row.ok ? (
                <CheckCircle2 size={14} className="text-green-500 shrink-0" />
              ) : row.warn ? (
                <XCircle size={14} className="text-amber-500 shrink-0" />
              ) : (
                <Loader2 size={14} className="animate-spin text-dim shrink-0" />
              )}
              <span className={row.warn ? "text-amber-500" : "text-muted"}>
                {row.label}
              </span>
            </li>
          ))}
        </ul>
        {fieldStatus?.firmware_outdated && (
          <p className="text-xs text-amber-500">
            Cached Marauder firmware may be outdated — check Setup tab.
          </p>
        )}
        {fieldStatus?.companion_on_sd === false && (
          <button
            type="button"
            className="text-xs text-accent hover:underline"
            onClick={onGoToSetup}
          >
            Deploy companion FAP in Setup →
          </button>
        )}
        {setupType === null && (
          <button
            type="button"
            className="text-xs text-accent hover:underline block"
            onClick={onGoToSetup}
          >
            Choose hardware setup in Setup →
          </button>
        )}
      </section>

      <section className="border border-border-subtle rounded-md p-3 space-y-2">
        <h2 className="text-sm font-medium">Launch & mirror</h2>
        <p className="text-xs text-muted">{FIELD_SECTION_HELP.launch}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!isConnected || launchBusy}
            className="text-xs px-3 py-1.5 rounded bg-accent-dim hover:bg-accent-hover text-white disabled:opacity-50 flex items-center gap-1"
            onClick={() => void launchCompanion()}
          >
            {launchBusy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Launch WiFi Marauder
          </button>
          <button
            type="button"
            disabled={!isConnected}
            className="text-xs px-3 py-1.5 rounded border border-border-subtle hover:bg-elevated flex items-center gap-1 disabled:opacity-50"
            onClick={() => setActiveView("screen")}
          >
            <Monitor size={14} /> Open Screen Stream
          </button>
          <button
            type="button"
            disabled={!isConnected || launchBusy}
            className="text-xs px-3 py-1.5 rounded border border-border-subtle hover:bg-elevated disabled:opacity-50"
            onClick={() => void stopCompanion()}
          >
            Stop app
          </button>
        </div>
        {launchError && (
          <p className="text-xs text-red-400">{launchError}</p>
        )}
      </section>

      {showGpioPower && (
        <section className="border border-border-subtle rounded-md p-3 space-y-2">
          <h2 className="text-sm font-medium flex items-center gap-1">
            <Power size={14} /> GPIO power
          </h2>
          <p className="text-xs text-muted">{FIELD_SECTION_HELP.power}</p>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              disabled={otgBusy}
              className={`text-xs px-3 py-1.5 rounded border ${
                otg
                  ? "border-amber-500/50 text-amber-500"
                  : "border-border-subtle hover:bg-elevated"
              }`}
              onClick={() => void toggleOtg()}
            >
              OTG {otg ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              className="text-xs text-accent hover:underline"
              onClick={() => setActiveView("gpio")}
            >
              Open GPIO view →
            </button>
          </div>
        </section>
      )}

      {showGpioOnlyInfo && (
        <WifiBoardInfoPanel title="Why is there no Field console?" variant="warn">
          <p>
            Your ESP is connected to the Flipper over GPIO UART only. This app
            cannot send Marauder commands through that link — only the companion
            app on the Flipper can. Use <strong>Launch</strong> then{" "}
            <strong>Screen Stream</strong> to operate from your PC, or use the
            buttons on the Flipper itself.
          </p>
        </WifiBoardInfoPanel>
      )}

      {showPassthroughGuide && (
        <section className="border border-amber-500/30 rounded-md p-3 space-y-2 bg-amber-500/5">
          <h2 className="text-sm font-medium text-amber-500">
            Enable dev board passthrough
          </h2>
          <ol className="text-xs text-muted list-decimal list-inside space-y-1">
            <li>Connect Flipper to PC over USB</li>
            <li>Open qFlipper → Flipper settings → USB</li>
            <li>Set USB mode to Channel 0 (UART bridge)</li>
            <li>Baud rate 115200</li>
            <li>Click Refresh below — passthrough COM port should appear</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="text-xs px-2 py-1 rounded border border-border-subtle hover:bg-elevated flex items-center gap-1"
              onClick={() => void refreshFieldStatus()}
            >
              <RefreshCw size={12} /> Refresh status
            </button>
            <button
              type="button"
              className="text-xs text-accent hover:underline flex items-center gap-1"
              onClick={() =>
                void openUrl(
                  "https://docs.flipper.net/gpio-and-modules/wifi-module",
                )
              }
            >
              Official docs <ExternalLink size={12} />
            </button>
          </div>
        </section>
      )}

      {showConsole && (
        <section className="border border-border-subtle rounded-md p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Field console</h2>
            {fieldStatus?.connection_mode === "direct_usb" && (
              <button
                type="button"
                className="text-xs text-accent hover:underline"
                onClick={onGoToConsole}
              >
                Full console →
              </button>
            )}
          </div>
          <p className="text-[11px] text-dim">{FIELD_SECTION_HELP.console}</p>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="text-sm bg-surface border border-border-subtle rounded px-2 py-1.5 min-w-[10rem]"
              value={console.selectedPort ?? ""}
              onChange={(e) => console.setSelectedPort(e.target.value || null)}
              disabled={console.connected}
            >
              <option value="">Select COM port…</option>
              {console.ports.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                  {p.is_devboard_passthrough ? " (passthrough)" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="text-xs px-2 py-1.5 rounded border border-border-subtle hover:bg-elevated"
              onClick={() => void console.refreshPorts()}
              disabled={console.connected}
            >
              Refresh
            </button>
            {!console.connected ? (
              <button
                type="button"
                disabled={console.busy || !console.selectedPort}
                className="text-xs px-3 py-1.5 rounded bg-accent-dim hover:bg-accent-hover text-white disabled:opacity-50 flex items-center gap-1"
                onClick={() => void console.connect()}
              >
                {console.busy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
                )}
                Connect
              </button>
            ) : (
              <button
                type="button"
                disabled={console.busy}
                className="text-xs px-3 py-1.5 rounded border border-red-500/50 text-red-400 hover:bg-red-500/10 flex items-center gap-1"
                onClick={() => void console.disconnect()}
              >
                <Square size={14} /> Disconnect
              </button>
            )}
            {console.connected && (
              <span className="text-xs text-green-500 flex items-center gap-1">
                <Zap size={12} /> Live
              </span>
            )}
          </div>

          {console.connected &&
            MARAUDER_QUICK_GROUPS.map((group) => (
              <div key={group.title} className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-dim">
                  {group.title}
                </p>
                <div className="flex flex-wrap gap-1">
                  {group.commands
                    .filter((c) => !c.requiresBt || console.profileHasBt)
                    .map((c) => (
                      <button
                        key={c.cmd}
                        type="button"
                        className={`text-[10px] px-2 py-1 rounded border disabled:opacity-40 ${
                          c.destructive
                            ? "border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                            : "border-border-subtle hover:bg-elevated"
                        }`}
                        onClick={() =>
                          void console.sendWithConfirm(c.cmd, Boolean(c.destructive))
                        }
                      >
                        {c.label}
                      </button>
                    ))}
                </div>
              </div>
            ))}

          <pre
            ref={console.logRef}
            className="min-h-[120px] max-h-[200px] text-xs bg-black/50 border border-border-subtle rounded-md p-3 overflow-auto whitespace-pre-wrap font-mono"
          >
            {console.output || "Connect to run Marauder CLI from the field…"}
          </pre>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void console.sendLine(console.input);
            }}
          >
            <Terminal size={16} className="text-dim shrink-0 mt-2" />
            <input
              className="flex-1 text-sm bg-surface border border-border-subtle rounded px-2 py-1.5 font-mono"
              value={console.input}
              onChange={(e) => console.setInput(e.target.value)}
              disabled={!console.connected}
              placeholder={
                console.connected ? "Enter command…" : "Connect first"
              }
            />
            <button
              type="submit"
              disabled={!console.connected || !console.input.trim()}
              className="text-xs px-3 py-1.5 rounded bg-accent-dim hover:bg-accent-hover text-white disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </section>
      )}

      <section className="border border-border-subtle rounded-md p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium flex items-center gap-2">
            Live captures
            {newCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-dim text-white">
                {newCount} new
              </span>
            )}
          </h2>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={!isConnected || capturesLoading}
              className="text-xs px-2 py-1 rounded border border-border-subtle hover:bg-elevated disabled:opacity-50"
              onClick={() => void refreshCaptures()}
            >
              <RefreshCw size={12} className={capturesLoading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              disabled={!isConnected || batchBusy || captures.length === 0}
              className="text-xs px-2 py-1 rounded border border-border-subtle hover:bg-elevated disabled:opacity-50"
              onClick={() => void downloadAllNew()}
            >
              {batchBusy ? "Saving…" : "Download new"}
            </button>
            <button
              type="button"
              className="text-xs text-accent hover:underline"
              onClick={onGoToCaptures}
            >
              All captures →
            </button>
          </div>
        </div>
        <p className="text-[11px] text-dim">{FIELD_SECTION_HELP.captures}</p>
        {!isConnected ? (
          <p className="text-xs text-muted">Connect Flipper to list SD captures.</p>
        ) : captures.length === 0 ? (
          <p className="text-xs text-muted">No capture files yet.</p>
        ) : (
          <ul className="space-y-1">
            {captures.slice(0, 5).map((file) => (
              <li
                key={file.path}
                className="flex items-center justify-between gap-2 text-xs border border-border-subtle/50 rounded px-2 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono">{file.name}</p>
                  <p className="text-dim">
                    {formatSize(file.size)} · {formatTs(file.modified)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={downloading === file.path}
                  className="shrink-0 p-1 rounded hover:bg-elevated disabled:opacity-50"
                  onClick={() => void downloadCapture(file)}
                >
                  {downloading === file.path ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
