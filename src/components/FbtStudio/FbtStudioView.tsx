import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Hammer, Loader2, Play, Save } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  fbtCloneRepo,
  fbtFirmwareBases,
  fbtListArtifacts,
  fbtListProfiles,
  fbtLoadProfile,
  fbtReadConfig,
  fbtRun,
  fbtSaveProfile,
  fbtScanManifests,
  fbtWriteConfig,
  type AppManifestEntry,
  type FbtArtifact,
  type FbtConfig,
  type FirmwareBase,
} from "../../lib/fbt";
import { useFlipperStore } from "../../store/useFlipperStore";
import { qflipperRun } from "../../lib/tools";
import { loadSettings } from "../../lib/settings";
import { TutorialBanner } from "../Tutorial/TutorialBanner";
import { FeatureContextBar } from "../ui/FeatureContextBar";

const DEFAULT_FW_ROOT = "D:\\Bot Projects\\Bot Projects\\Cursor\\Deez Flipper Zero\\firmware";

export function FbtStudioView() {
  const setActiveView = useFlipperStore((s) => s.setActiveView);
  const [bases, setBases] = useState<FirmwareBase[]>([]);
  const [repoPath, setRepoPath] = useState("");
  const [projectName, setProjectName] = useState("deez-fw");
  const [config, setConfig] = useState<FbtConfig>({
    firmware_origin: "DeezFW",
    firmware_app_set: "default",
    extra_int_apps: [],
    extra_ext_apps: [],
    update_splash: "update_default",
    loader_autostart: "",
    extra_defines: [],
  });
  const [apps, setApps] = useState<AppManifestEntry[]>([]);
  const [artifacts, setArtifacts] = useState<FbtArtifact[]>([]);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [profileName, setProfileName] = useState("default");
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshArtifacts = useCallback(async () => {
    if (!repoPath) return;
    setArtifacts(await fbtListArtifacts(repoPath));
  }, [repoPath]);

  useEffect(() => {
    void fbtFirmwareBases().then(setBases);
    void fbtListProfiles().then(setProfiles);
  }, []);

  useEffect(() => {
    if (!repoPath) return;
    void fbtReadConfig(repoPath).then(setConfig);
    void fbtScanManifests(repoPath).then(setApps);
    void refreshArtifacts();
  }, [repoPath, refreshArtifacts]);

  const cloneBase = async (base: FirmwareBase) => {
    setBusy(true);
    setLog(`Cloning ${base.name}…`);
    try {
      const target = `${DEFAULT_FW_ROOT}\\${projectName}`;
      await fbtCloneRepo(base.url, target);
      setRepoPath(target);
      setLog(`Cloned to ${target}`);
    } catch (e) {
      setLog(String(e));
    } finally {
      setBusy(false);
    }
  };

  const pickRepo = async () => {
    const dir = await openDialog({ directory: true, multiple: false });
    if (dir && typeof dir === "string") setRepoPath(dir);
  };

  const saveConfig = async () => {
    if (!repoPath) return;
    await fbtWriteConfig(repoPath, config);
    setLog("Saved fbt_options_local.py");
  };

  const runBuild = async (target: string) => {
    if (!repoPath) return;
    setBusy(true);
    setLog(`Running fbt ${target}…`);
    try {
      await saveConfig();
      const extra: string[] = [];
      if (config.extra_int_apps.length) {
        extra.push(`--extra-int-apps=${config.extra_int_apps.join(",")}`);
      }
      if (config.extra_ext_apps.length) {
        extra.push(`--extra-ext-apps=${config.extra_ext_apps.join(",")}`);
      }
      for (const d of config.extra_defines) extra.push(`--extra-define=${d}`);
      const code = await fbtRun(repoPath, target, extra, config);
      setLog(`fbt ${target} exited with code ${code}`);
      await refreshArtifacts();
    } catch (e) {
      setLog(String(e));
    } finally {
      setBusy(false);
    }
  };

  const flashArtifact = async (path: string, kind: string) => {
    const settings = await loadSettings();
    const qpath = settings.tools.qflipperCliPath ?? undefined;
    try {
      if (kind === "dfu" || kind === "tgz") {
        const out = await qflipperRun("firmware", [path], qpath);
        setLog(out);
      }
    } catch (e) {
      setLog(String(e));
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto p-6 space-y-5">
      <TutorialBanner topicId="fbt" />
      <FeatureContextBar topicId="fbt" />
      <div>
        <h1 className="text-xl font-semibold text-primary">FBT Build Studio</h1>
        <p className="text-sm text-muted mt-1">
          Clone firmware, configure apps, compile, and flash your custom OS.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">New project</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="px-2 py-1 rounded bg-surface border border-border-subtle text-sm"
            placeholder="project name"
          />
          {bases.map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={busy}
              onClick={() => void cloneBase(b)}
              className="text-xs px-3 py-1.5 rounded border border-border-subtle hover:bg-surface/60"
            >
              Clone {b.name}
            </button>
          ))}
          <button type="button" onClick={() => void pickRepo()} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-border-subtle">
            <FolderOpen size={14} /> Link existing repo
          </button>
        </div>
        {repoPath && <p className="text-xs text-dim font-mono">{repoPath}</p>}
      </section>

      {repoPath && (
        <>
          <section className="grid grid-cols-2 gap-3 max-w-2xl">
            <label className="text-xs text-muted">
              Firmware origin
              <input
                value={config.firmware_origin}
                onChange={(e) => setConfig({ ...config, firmware_origin: e.target.value })}
                className="block w-full mt-1 px-2 py-1 rounded bg-surface border border-border-subtle text-sm"
              />
            </label>
            <label className="text-xs text-muted">
              App set
              <input
                value={config.firmware_app_set}
                onChange={(e) => setConfig({ ...config, firmware_app_set: e.target.value })}
                className="block w-full mt-1 px-2 py-1 rounded bg-surface border border-border-subtle text-sm"
              />
            </label>
            <label className="text-xs text-muted col-span-2">
              Autostart app
              <input
                value={config.loader_autostart}
                onChange={(e) => setConfig({ ...config, loader_autostart: e.target.value })}
                className="block w-full mt-1 px-2 py-1 rounded bg-surface border border-border-subtle text-sm"
              />
            </label>
          </section>

          <section>
            <h2 className="text-sm font-medium mb-2">Build actions</h2>
            <div className="flex flex-wrap gap-2">
              {["firmware_all", "updater_package", "faps", "-c"].map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={busy}
                  onClick={() => void runBuild(t)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-accent/20 text-accent"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Hammer size={14} />}
                  {t === "-c" ? "Clean" : t}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => void runBuild("flash_usb_full")}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-accent text-black font-medium"
              >
                <Play size={14} /> flash_usb_full
              </button>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium mb-2">Profiles</h2>
            <div className="flex gap-2 items-center">
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="px-2 py-1 rounded bg-surface border border-border-subtle text-sm"
              />
              <button
                type="button"
                onClick={() => void fbtSaveProfile(profileName, config).then(() => fbtListProfiles().then(setProfiles))}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border-subtle"
              >
                <Save size={12} /> Save
              </button>
              <select
                className="text-xs px-2 py-1 rounded bg-surface border border-border-subtle"
                onChange={(e) => {
                  const n = e.target.value;
                  if (n) void fbtLoadProfile(n).then(setConfig);
                }}
              >
                <option value="">Load profile…</option>
                {profiles.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium mb-2">Artifacts ({artifacts.length})</h2>
            <ul className="space-y-1 text-xs">
              {artifacts.slice(0, 10).map((a) => (
                <li key={a.path} className="flex justify-between gap-2 p-2 rounded bg-surface/30">
                  <span className="font-mono truncate">{a.path}</span>
                  <button
                    type="button"
                    onClick={() => void flashArtifact(a.path, a.kind)}
                    className="shrink-0 text-accent"
                  >
                    Flash
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setActiveView("firmware")} className="text-xs text-accent mt-2">
              More flash options in Firmware →
            </button>
          </section>

          {apps.length > 0 && (
            <p className="text-xs text-dim">{apps.length} apps discovered in application.fam files</p>
          )}
        </>
      )}

      {log && (
        <pre className="text-xs bg-black/40 border border-border-subtle rounded-md p-3 overflow-auto max-h-40 whitespace-pre-wrap">
          {log}
        </pre>
      )}
    </div>
  );
}
