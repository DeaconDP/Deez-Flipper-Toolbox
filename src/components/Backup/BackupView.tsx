import { useCallback, useEffect, useState } from "react";
import { HardDriveDownload, History, Loader2, RotateCcw } from "lucide-react";
import { useFlipperStore } from "../../store/useFlipperStore";
import {
  backupCreateFull,
  backupDefaultDir,
  backupList,
  backupRestore,
  onBackupProgress,
  type BackupProgress,
  type BackupSummary,
} from "../../lib/backup";
import { TutorialBanner } from "../Tutorial/TutorialBanner";
import { FeatureContextBar } from "../ui/FeatureContextBar";
import { loadSettings } from "../../lib/settings";

export function BackupView() {
  const isConnected = useFlipperStore((s) => s.isConnected);
  const deviceInfo = useFlipperStore((s) => s.deviceInfo);
  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [defaultDir, setDefaultDir] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qflipperPath, setQflipperPath] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBackups(await backupList());
  }, []);

  useEffect(() => {
    void backupDefaultDir().then(setDefaultDir);
    void loadSettings().then((s) => setQflipperPath(s.tools.qflipperCliPath));
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const un = onBackupProgress((p) => setProgress(p));
    return () => {
      void un.then((fn) => fn());
    };
  }, []);

  const createBackup = async () => {
    setBusy(true);
    setError(null);
    try {
      await backupCreateFull(
        qflipperPath,
        deviceInfo?.firmware_version ?? null,
        deviceInfo?.hardware_name ?? null,
      );
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const restore = async (path: string, internal: boolean, sd: boolean) => {
    if (!confirm("Restore this backup? Existing data may be overwritten.")) return;
    setBusy(true);
    setError(null);
    try {
      await backupRestore(path, { restore_internal: internal, restore_sd: sd }, qflipperPath);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto p-6 space-y-6">
      <TutorialBanner topicId="backup" />
      <FeatureContextBar topicId="backup" />
      <div>
        <h1 className="text-xl font-semibold text-primary">Backup & Restore</h1>
        <p className="text-sm text-muted mt-1">
          Full backup includes internal settings (qFlipper-cli) and your entire SD card (/ext).
        </p>
        <p className="text-xs text-dim mt-1">Default folder: {defaultDir}</p>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {progress && (
        <div className="text-sm text-muted">
          {progress.stage}: {progress.message || `${progress.pct ?? 0}%`}
        </div>
      )}

      <button
        type="button"
        disabled={!isConnected || busy}
        onClick={() => void createBackup()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-black font-medium disabled:opacity-40"
      >
        {busy ? <Loader2 className="animate-spin" size={16} /> : <HardDriveDownload size={16} />}
        Create full backup
      </button>

      <section>
        <h2 className="text-sm font-medium text-primary flex items-center gap-2 mb-3">
          <History size={16} /> Backup history
        </h2>
        {backups.length === 0 ? (
          <p className="text-sm text-muted">No backups yet.</p>
        ) : (
          <ul className="space-y-2">
            {backups.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-4 p-3 rounded-md bg-surface/40 border border-border-subtle"
              >
                <div>
                  <div className="text-sm font-medium">{b.id}</div>
                  <div className="text-xs text-muted">
                    {b.firmware_version ? `fw ${b.firmware_version} · ` : ""}
                    internal {b.has_internal ? "yes" : "no"} · SD {b.has_sd ? "yes" : "no"} ·{" "}
                    {(b.size_bytes / 1024 / 1024).toFixed(1)} MB
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void restore(b.path, true, false)}
                    className="text-xs px-2 py-1 rounded border border-border-subtle hover:bg-surface/60"
                  >
                    Internal
                  </button>
                  <button
                    type="button"
                    disabled={busy || !isConnected}
                    onClick={() => void restore(b.path, false, true)}
                    className="text-xs px-2 py-1 rounded border border-border-subtle hover:bg-surface/60"
                  >
                    SD
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void restore(b.path, true, true)}
                    className="text-xs px-2 py-1 rounded border border-border-subtle hover:bg-surface/60 inline-flex items-center gap-1"
                  >
                    <RotateCcw size={12} /> Full
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
