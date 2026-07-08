import { useCallback, useEffect, useState } from "react";
import {
  Cpu,
  Download,
  ExternalLink,
  Loader2,
  Plug,
  Radio,
  Upload,
  X,
  Zap,
  FolderOpen,
} from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";

import { formatAppStartError, SETUP_STEP_HELP } from "../../lib/wifiBoardCopy";
import { HEADER_PINS } from "../../types/gpio";
import { TutorialBanner } from "../Tutorial/TutorialBanner";
import { WifiBoardInfoPanel, WifiBoardTabIntro } from "./WifiBoardInfoPanel";
import { COMPANION_FAP_PATH } from "../../hooks/useMarauderConsole";
import { loadSettings, updateSettings } from "../../lib/settings";
import { appStart } from "../../lib/tauri";
import { onToolOutput } from "../../lib/tools";
import { useFlipperStore } from "../../store/useFlipperStore";
import {
  onDownloadProgress,
  onUploadProgress,
  wifiBoardCancel,
  wifiBoardChipId,
  wifiBoardDeployCompanion,
  wifiBoardDetectTools,
  wifiBoardFetchCompanionFap,
  wifiBoardFetchRelease,
  wifiBoardFlash,
  wifiBoardHealthCheck,
  wifiBoardListCompanionReleases,
  wifiBoardListPorts,
  wifiBoardListReleases,
  wifiBoardProfiles,
  type BoardProfile,
  type BoardSetupType,
  type EspPortInfo,
  type FlashMode,
  type MarauderReleaseCache,
  type ReleaseSummary,
  type WifiBoardHealth,
} from "../../lib/wifiBoard";

const WIRE_PINS = HEADER_PINS.filter((p) =>
  ["PC0", "PC1", "GND", "+3V3"].includes(p.name),
);

type ReleasesFetchStatus = "loading" | "ok" | "error";

export function WifiBoardSetupView({ onGoToField }: { onGoToField?: () => void }) {
  const isConnected = useFlipperStore((s) => s.isConnected);
  const setActiveView = useFlipperStore((s) => s.setActiveView);

  const [profiles, setProfiles] = useState<BoardProfile[]>([]);
  const [setupType, setSetupType] = useState<BoardSetupType | null>(null);
  const [profileId, setProfileId] = useState("lddb");
  const [ports, setPorts] = useState<EspPortInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState<string | null>(null);
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [companionReleases, setCompanionReleases] = useState<ReleaseSummary[]>([]);
  const [releasesStatus, setReleasesStatus] = useState<ReleasesFetchStatus>("loading");
  const [companionReleasesStatus, setCompanionReleasesStatus] =
    useState<ReleasesFetchStatus>("loading");
  const [releasesError, setReleasesError] = useState<string | null>(null);
  const [companionReleasesError, setCompanionReleasesError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [companionTag, setCompanionTag] = useState<string | null>(null);
  const [cache, setCache] = useState<MarauderReleaseCache | null>(null);
  const [flashMode, setFlashMode] = useState<FlashMode>("full");
  const [customFirmwarePath, setCustomFirmwarePath] = useState<string | null>(null);
  const [esptoolPath, setEsptoolPath] = useState("");
  const [esptoolFound, setEsptoolFound] = useState(false);
  const [chipOutput, setChipOutput] = useState<string | null>(null);
  const [macAddress, setMacAddress] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [companionChannel, setCompanionChannel] = useState<"release" | "dev">("release");
  const [health, setHealth] = useState<WifiBoardHealth | null>(null);
  const [launchBusy, setLaunchBusy] = useState(false);

  /** Null setup type uses custom_gpio step numbers until the user chooses. */
  const gpioSteps = setupType !== "official_devboard";

  const append = useCallback((line: string) => {
    setLog((p) => [...p.slice(-300), line]);
  }, []);

  const refreshPorts = useCallback(async () => {
    const list = await wifiBoardListPorts();
    setPorts(list);
    const settings = await loadSettings();
    const remembered = settings.wifiBoard.lastEspPort;
    if (remembered && list.some((p) => p.name === remembered)) {
      setSelectedPort(remembered);
    } else if (list.length === 1) {
      setSelectedPort(list[0]!.name);
    }
  }, []);

  const detectEsptool = useCallback(async (path: string) => {
    const t = await wifiBoardDetectTools(path || null);
    setEsptoolFound(t.esptool.found);
  }, []);

  const fetchMarauderReleases = useCallback(async () => {
    setReleasesStatus("loading");
    setReleasesError(null);
    try {
      const r = await wifiBoardListReleases();
      setReleases(r);
      setReleasesStatus("ok");
      const settings = await loadSettings();
      const remembered = settings.wifiBoard.lastMarauderTag;
      if (remembered && r.some((x) => x.tag === remembered)) {
        setSelectedTag(remembered);
      } else if (r[0]) {
        setSelectedTag(r[0].tag);
      } else {
        setSelectedTag(null);
      }
    } catch (e) {
      setReleases([]);
      setSelectedTag(null);
      setReleasesStatus("error");
      setReleasesError((e as Error).message || String(e));
    }
  }, []);

  const fetchCompanionReleases = useCallback(async () => {
    setCompanionReleasesStatus("loading");
    setCompanionReleasesError(null);
    try {
      const r = await wifiBoardListCompanionReleases();
      setCompanionReleases(r);
      setCompanionReleasesStatus("ok");
      const settings = await loadSettings();
      const remembered = settings.wifiBoard.lastCompanionTag;
      if (remembered && r.some((x) => x.tag === remembered)) {
        setCompanionTag(remembered);
      } else if (r[0]) {
        setCompanionTag(r[0].tag);
      } else {
        setCompanionTag(null);
      }
    } catch (e) {
      setCompanionReleases([]);
      setCompanionTag(null);
      setCompanionReleasesStatus("error");
      setCompanionReleasesError((e as Error).message || String(e));
    }
  }, []);

  useEffect(() => {
    void wifiBoardProfiles().then(setProfiles);
    void fetchMarauderReleases();
    void fetchCompanionReleases();
    void loadSettings().then((s) => {
      setEsptoolPath(s.tools.esptoolPath ?? "");
      if (s.wifiBoard.lastProfile) setProfileId(s.wifiBoard.lastProfile);
      setSetupType(s.wifiBoard.setupType);
    });
    void detectEsptool("");
    void refreshPorts();
    if (isConnected) {
      void wifiBoardHealthCheck().then(setHealth).catch(() => setHealth(null));
    }
  }, [refreshPorts, detectEsptool, isConnected, fetchMarauderReleases, fetchCompanionReleases]);

  useEffect(() => {
    if (setupType === "official_devboard") {
      setProfileId("flipper_s2");
    }
  }, [setupType]);

  const chooseSetupType = async (next: BoardSetupType) => {
    setSetupType(next);
    await updateSettings({ wifiBoard: { setupType: next } });
  };

  useEffect(() => {
    const un = onToolOutput((line) => {
      append(`[${line.stream}] ${line.line}`);
    });
    return () => {
      void un.then((fn) => fn());
    };
  }, [append]);

  useEffect(() => {
    let unDl: (() => void) | undefined;
    let unUl: (() => void) | undefined;
    void onDownloadProgress((pct) => setProgress(pct)).then((fn) => {
      unDl = fn;
    });
    void onUploadProgress((pct) => setProgress(pct)).then((fn) => {
      unUl = fn;
    });
    return () => {
      unDl?.();
      unUl?.();
    };
  }, []);

  const savePrefs = async () => {
    const current = await loadSettings();
    await updateSettings({
      wifiBoard: {
        lastProfile: profileId,
        lastEspPort: selectedPort,
        lastMarauderTag: selectedTag,
        lastCompanionTag: companionTag,
        ...(setupType != null ? { setupType } : {}),
      },
      tools: {
        esptoolPath: esptoolPath || null,
        qflipperCliPath: current.tools.qflipperCliPath,
        ufbtPath: current.tools.ufbtPath,
        nodePath: current.tools.nodePath,
      },
    });
  };

  const handleEsptoolBlur = async () => {
    await detectEsptool(esptoolPath);
    const current = await loadSettings();
    await updateSettings({
      tools: {
        ...current.tools,
        esptoolPath: esptoolPath || null,
      },
    });
  };

  const pickCustomFirmware = async () => {
    const picked = await openDialog({
      multiple: false,
      filters: [{ name: "Firmware", extensions: ["bin"] }],
    });
    if (picked && typeof picked === "string") {
      setCustomFirmwarePath(picked);
      append(`Custom firmware: ${picked}`);
    }
  };

  const cancelOperation = () => {
    void wifiBoardCancel();
    append("Cancel requested…");
  };

  const detectChip = async () => {
    if (!selectedPort) {
      append("Select an ESP USB serial port first");
      return;
    }
    setBusy(true);
    try {
      const result = await wifiBoardChipId(selectedPort, esptoolPath || null);
      setChipOutput(result.output);
      setMacAddress(result.mac_address);
      if (result.suggested_profile_id) {
        setProfileId(result.suggested_profile_id);
        append(`Suggested profile: ${result.suggested_profile_id}`);
        if (
          result.suggested_profile_id === "lddb" &&
          setupType !== "official_devboard"
        ) {
          append(
            "Generic ESP32 detected — if you have a Dev Board Pro / BFFB, select that profile manually.",
          );
        }
      }
      if (result.mac_address) {
        append(`MAC: ${result.mac_address}`);
      }
      append("Chip detection complete");
    } catch (e) {
      append(String(e));
    } finally {
      setBusy(false);
    }
  };

  const downloadFirmware = async () => {
    if (!selectedTag) {
      append("Pick a Marauder release version");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const cached = await wifiBoardFetchRelease(selectedTag, profileId);
      setCache(cached);
      append(
        `Cached ${cached.firmware.name} (${cached.firmware.size} bytes, sha256 ${cached.firmware.sha256.slice(0, 12)}…)`,
      );
    } catch (e) {
      append(String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const flashBoard = async () => {
    if (!selectedPort || !selectedTag) {
      append("Select port and release before flashing");
      return;
    }
    if (!esptoolFound && !esptoolPath) {
      append("esptool not found — install via pip, PATH, or uv");
      return;
    }
    setBusy(true);
    setProgress(0);
    append(`Flashing (${flashMode}) on ${selectedPort}…`);
    try {
      const code = await wifiBoardFlash(
        selectedPort,
        profileId,
        selectedTag,
        flashMode,
        esptoolPath || null,
        customFirmwarePath,
      );
      append(`Flash finished with exit code ${code}`);
      await savePrefs();
    } catch (e) {
      append(String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const deployCompanion = async () => {
    if (!isConnected) {
      append("Connect your Flipper over USB/BLE to deploy the companion FAP");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      append("Downloading companion FAP…");
      const cached = await wifiBoardFetchCompanionFap(companionChannel, companionTag);
      append(`Fetched ${cached.artifact.name} (${cached.tag})`);
      append("Uploading to /ext/apps/GPIO/…");
      await wifiBoardDeployCompanion(companionChannel, companionTag);
      append("Companion app deployed — use the Field tab to launch on device");
      await savePrefs();
      const h = await wifiBoardHealthCheck();
      setHealth(h);
    } catch (e) {
      append(String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const launchCompanion = async () => {
    setLaunchBusy(true);
    try {
      await appStart(COMPANION_FAP_PATH, "");
      const settings = await loadSettings();
      if (settings.wifiBoard.autoOpenScreenStream) {
        setActiveView("screen");
      }
    } catch (e) {
      const raw = (e as Error).message || String(e);
      append(`Launch failed: ${formatAppStartError(raw)}`);
    } finally {
      setLaunchBusy(false);
    }
  };

  const marauderSelectPlaceholder =
    releasesStatus === "loading"
      ? "Loading…"
      : releasesStatus === "error"
        ? "No releases — retry"
        : "Select version…";

  const companionSelectPlaceholder =
    companionReleasesStatus === "loading"
      ? "Loading…"
      : companionReleasesStatus === "error"
        ? "No releases — retry"
        : "Select version…";

  const selectedProfile = profiles.find((p) => p.id === profileId);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
      <TutorialBanner topicId="wifiboard" />

      <WifiBoardTabIntro
        title="Setup wizard"
        summary="Prepare hardware once: write Marauder to the ESP32 while it is on USB to your PC, then copy the companion app onto the Flipper SD card. After that, use the Field tab for day-to-day use."
        bullets={[
          "Flipper is not used for flashing — only for deploying the companion FAP",
          "Pick GPIO or official dev board first — it changes wiring and profile hints",
          "When health shows companion on SD, switch to Field tab",
        ]}
      />

      <WifiBoardInfoPanel title="Authorized use only" variant="warn">
        Marauder WiFi tools are for security testing on networks you own or have
        explicit permission to assess.
      </WifiBoardInfoPanel>

      {health && (
        <section className="rounded-lg border border-border-subtle bg-panel/60 p-3 text-xs space-y-1">
          <p className="font-medium text-secondary">Setup health</p>
          <p>
            Companion FAP on SD:{" "}
            {health.companion_fap_on_sd ? (
              <span className="text-green-500">yes</span>
            ) : (
              <span className="text-amber-500">not found</span>
            )}
          </p>
          {health.firmware_outdated && health.latest_marauder_tag && (
            <p className="text-amber-500">
              Cached firmware may be outdated — latest Marauder: {health.latest_marauder_tag}
            </p>
          )}
          {health.cached_firmware_tags.length > 0 && (
            <p className="text-dim font-mono truncate">
              Cached: {health.cached_firmware_tags.join(", ")}
            </p>
          )}
          {health.companion_fap_on_sd && isConnected && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={launchBusy}
                className="text-xs px-2 py-1 rounded bg-accent-dim hover:bg-accent-hover text-white disabled:opacity-50"
                onClick={() => void launchCompanion()}
              >
                {launchBusy ? "Launching…" : "Launch on Flipper"}
              </button>
              {onGoToField && (
                <button
                  type="button"
                  className="text-xs text-accent hover:underline"
                  onClick={onGoToField}
                >
                  Open Field tab →
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Hardware type */}
      <section className="rounded-lg border border-border-subtle bg-panel p-4 space-y-3">
        <h2 className="text-sm font-medium">Hardware setup</h2>
        <p className="text-xs text-dim">{SETUP_STEP_HELP.hardware}</p>
        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="setupType"
              checked={setupType === "custom_gpio"}
              onChange={() => void chooseSetupType("custom_gpio")}
            />
            Custom ESP32 on GPIO header
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="setupType"
              checked={setupType === "official_devboard"}
              onChange={() => void chooseSetupType("official_devboard")}
            />
            Official Flipper WiFi Dev Board
          </label>
        </div>
        {setupType === null && (
          <p className="text-xs text-amber-500">
            Choose Custom GPIO or Official Dev Board before continuing — this is
            saved right away for Field readiness.
          </p>
        )}
        {setupType === "official_devboard" && (
          <p className="text-xs text-muted">
            Connect the dev board USB directly to your PC for flashing (not through
            the Flipper). Use profile <strong>ESP32-S2 (Flipper-style)</strong>. For
            UART passthrough with the board slotted in the Flipper, set USB Channel 0
            and baud 115200 per the{" "}
            <button
              type="button"
              className="text-accent hover:underline"
              onClick={() =>
                void openUrl(
                  "https://github.com/justcallmekoko/ESP32Marauder/wiki/CLI",
                )
              }
            >
              Marauder CLI wiki
            </button>
            .
          </p>
        )}
      </section>

      {/* Step 1 — Wiring */}
      {gpioSteps && (
        <section className="rounded-lg border border-border-subtle bg-panel p-4 space-y-3">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <Plug size={16} /> 1. Wire ESP32 to Flipper GPIO
          </h2>
          <p className="text-xs text-dim">{SETUP_STEP_HELP.wiring}</p>
          <ul className="text-xs space-y-1 font-mono">
            {WIRE_PINS.map((p) => (
              <li key={p.number} className="flex gap-3">
                <span className="text-dim w-8">#{p.number}</span>
                <span className="w-12">{p.name}</span>
                <span className="text-secondary">{p.alt}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Cross UART: Flipper <strong>PC1 (TX)</strong> → ESP <strong>RX</strong>,
            Flipper <strong>PC0 (RX)</strong> → ESP <strong>TX</strong>.
          </p>
          <button
            type="button"
            className="text-xs text-accent hover:underline"
            onClick={() => setActiveView("gpio")}
          >
            Open GPIO view for pin control →
          </button>
        </section>
      )}

      {/* Step 2 — Profile */}
      <section className="rounded-lg border border-border-subtle bg-panel p-4 space-y-3">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <Cpu size={16} /> {gpioSteps ? "2" : "1"}. Board profile
        </h2>
        <p className="text-xs text-dim">{SETUP_STEP_HELP.profile}</p>
        <select
          className="w-full text-sm bg-surface border border-border-subtle rounded px-2 py-1.5"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          disabled={setupType === "official_devboard"}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.chip})
            </option>
          ))}
        </select>
        {selectedProfile && (
          <p className="text-xs text-muted">{selectedProfile.description}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !selectedPort}
            className="text-xs px-3 py-1.5 rounded bg-surface border border-border-subtle hover:bg-elevated disabled:opacity-50"
            onClick={() => void detectChip()}
          >
            Detect chip
          </button>
        </div>
        {macAddress && (
          <p className="text-xs font-mono text-muted">MAC: {macAddress}</p>
        )}
        {chipOutput && (
          <pre className="text-[10px] bg-black/40 border border-border-subtle rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
            {chipOutput}
          </pre>
        )}
      </section>

      {/* Step 3 — Port */}
      <section className="rounded-lg border border-border-subtle bg-panel p-4 space-y-3">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <Zap size={16} /> {gpioSteps ? "3" : "2"}. ESP USB serial port
        </h2>
        <p className="text-xs text-dim">{SETUP_STEP_HELP.esptool}</p>
        <div className="flex gap-2">
          <select
            className="flex-1 text-sm bg-surface border border-border-subtle rounded px-2 py-1.5"
            value={selectedPort ?? ""}
            onChange={(e) => setSelectedPort(e.target.value || null)}
          >
            <option value="">Select COM port…</option>
            {ports.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
                {p.is_espressif ? " (Espressif)" : ""}
                {p.manufacturer ? ` — ${p.manufacturer}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="text-xs px-2 py-1.5 rounded border border-border-subtle hover:bg-elevated"
            onClick={() => void refreshPorts()}
          >
            Refresh
          </button>
        </div>
        <label className="block text-xs text-muted">
          esptool path override (optional)
          <input
            className="mt-1 w-full text-sm bg-surface border border-border-subtle rounded px-2 py-1"
            value={esptoolPath}
            onChange={(e) => setEsptoolPath(e.target.value)}
            onBlur={() => void handleEsptoolBlur()}
            placeholder="uvx --from esptool esptool, or python -m esptool"
          />
        </label>
        {!esptoolFound && !esptoolPath && (
          <p className="text-xs text-amber-500">esptool not detected</p>
        )}
      </section>

      {/* Step 4 — Download */}
      <section className="rounded-lg border border-border-subtle bg-panel p-4 space-y-3">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <Download size={16} /> {gpioSteps ? "4" : "3"}. Download Marauder firmware
        </h2>
        <p className="text-xs text-dim">{SETUP_STEP_HELP.firmware}</p>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="flex-1 min-w-[12rem] text-sm bg-surface border border-border-subtle rounded px-2 py-1.5"
            value={selectedTag ?? ""}
            onChange={(e) => setSelectedTag(e.target.value || null)}
            disabled={releasesStatus === "loading" || releases.length === 0}
          >
            {releases.length === 0 ? (
              <option value="">{marauderSelectPlaceholder}</option>
            ) : (
              releases.map((r) => (
                <option key={r.tag} value={r.tag}>
                  {r.name || r.tag}
                </option>
              ))
            )}
          </select>
          {(releasesStatus === "error" || releasesStatus === "loading") && (
            <button
              type="button"
              disabled={releasesStatus === "loading"}
              className="text-xs px-2 py-1.5 rounded border border-border-subtle hover:bg-elevated disabled:opacity-50"
              onClick={() => void fetchMarauderReleases()}
            >
              {releasesStatus === "loading" ? "Loading…" : "Retry"}
            </button>
          )}
        </div>
        {releasesError && (
          <p className="text-xs text-amber-500">{releasesError}</p>
        )}
        <button
          type="button"
          disabled={busy || !selectedTag}
          className="text-xs px-3 py-1.5 rounded bg-accent-dim hover:bg-accent-hover text-white disabled:opacity-50 flex items-center gap-1"
          onClick={() => void downloadFirmware()}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Download & cache
        </button>
        {cache && (
          <p className="text-xs text-muted font-mono truncate">
            {cache.firmware.local_path}
          </p>
        )}
      </section>

      {/* Step 5 — Flash */}
      <section className="rounded-lg border border-border-subtle bg-panel p-4 space-y-3">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <Upload size={16} /> {gpioSteps ? "5" : "4"}. Flash ESP32
        </h2>
        <p className="text-xs text-dim">{SETUP_STEP_HELP.flash}</p>
        <div className="flex gap-4 text-xs">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="flashMode"
              checked={flashMode === "full"}
              onChange={() => setFlashMode("full")}
            />
            Full flash (new board)
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="flashMode"
              checked={flashMode === "app_only"}
              onChange={() => setFlashMode("app_only")}
            />
            App only (update)
          </label>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            disabled={busy || !selectedPort || !selectedTag}
            className="text-xs px-3 py-1.5 rounded bg-accent-dim hover:bg-accent-hover text-white disabled:opacity-50 flex items-center gap-1"
            onClick={() => void flashBoard()}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            Flash board
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-xs px-2 py-1.5 rounded border border-border-subtle hover:bg-elevated flex items-center gap-1"
            onClick={() => void pickCustomFirmware()}
          >
            <FolderOpen size={14} />
            Custom .bin
          </button>
          {customFirmwarePath && (
            <span className="text-[10px] font-mono text-muted truncate max-w-xs">
              {customFirmwarePath}
            </span>
          )}
        </div>
      </section>

      {/* Step 6 — Companion FAP */}
      <section className="rounded-lg border border-border-subtle bg-panel p-4 space-y-3">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <Radio size={16} /> {gpioSteps ? "6" : "5"}. Install Flipper companion app
        </h2>
        <p className="text-xs text-dim">{SETUP_STEP_HELP.companion}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <select
            className="bg-surface border border-border-subtle rounded px-2 py-1"
            value={companionChannel}
            onChange={(e) => setCompanionChannel(e.target.value as "release" | "dev")}
          >
            <option value="release">Release channel FAP</option>
            <option value="dev">Dev channel FAP</option>
          </select>
          <select
            className="bg-surface border border-border-subtle rounded px-2 py-1 min-w-[8rem]"
            value={companionTag ?? ""}
            onChange={(e) => setCompanionTag(e.target.value || null)}
            disabled={
              companionReleasesStatus === "loading" || companionReleases.length === 0
            }
          >
            {companionReleases.length === 0 ? (
              <option value="">{companionSelectPlaceholder}</option>
            ) : (
              companionReleases.map((r) => (
                <option key={r.tag} value={r.tag}>
                  {r.name || r.tag}
                </option>
              ))
            )}
          </select>
          {(companionReleasesStatus === "error" ||
            companionReleasesStatus === "loading") && (
            <button
              type="button"
              disabled={companionReleasesStatus === "loading"}
              className="px-2 py-1 rounded border border-border-subtle hover:bg-elevated disabled:opacity-50"
              onClick={() => void fetchCompanionReleases()}
            >
              {companionReleasesStatus === "loading" ? "Loading…" : "Retry"}
            </button>
          )}
          <button
            type="button"
            disabled={busy || !isConnected}
            className="px-3 py-1.5 rounded bg-accent-dim hover:bg-accent-hover text-white disabled:opacity-50"
            onClick={() => void deployCompanion()}
          >
            Deploy to Flipper
          </button>
          <button
            type="button"
            className="px-2 py-1.5 rounded border border-border-subtle hover:bg-elevated flex items-center gap-1"
            onClick={() => void openUrl("https://lab.flipper.net/apps/esp32_wifi_marauder")}
          >
            Flipper Lab <ExternalLink size={12} />
          </button>
        </div>
        {companionReleasesError && (
          <p className="text-xs text-amber-500">{companionReleasesError}</p>
        )}
        {!isConnected && (
          <p className="text-xs text-dim">Connect Flipper to enable deploy</p>
        )}
      </section>

      {progress !== null && (
        <div className="space-y-1">
          <div className="h-1.5 bg-surface rounded overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-dim text-center">{progress}%</p>
        </div>
      )}

      {busy && (
        <button
          type="button"
          className="text-xs px-3 py-1.5 rounded border border-red-500/50 text-red-400 hover:bg-red-500/10 flex items-center gap-1"
          onClick={cancelOperation}
        >
          <X size={14} /> Cancel operation
        </button>
      )}

      {log.length > 0 && (
        <pre className="text-xs bg-black/40 border border-border-subtle rounded-md p-3 overflow-auto max-h-48 whitespace-pre-wrap font-mono">
          {log.join("\n")}
        </pre>
      )}
    </div>
  );
}
