import { useCallback, useEffect, useState } from "react";
import { Download, FolderOpen, Loader2, RefreshCw } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";

import { useFlipperStore } from "../../store/useFlipperStore";
import {
  marauderDownloadCapture,
  marauderListCaptures,
  type MarauderCaptureFile,
} from "../../lib/wifiBoard";
import { WifiBoardTabIntro } from "./WifiBoardInfoPanel";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatTs(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString();
}

export function MarauderCapturesView() {
  const isConnected = useFlipperStore((s) => s.isConnected);
  const [files, setFiles] = useState<MarauderCaptureFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isConnected) {
      setFiles([]);
      return;
    }
    setLoading(true);
    try {
      setFiles(await marauderListCaptures());
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const downloadFile = async (file: MarauderCaptureFile) => {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "pcap";
    const localPath = await save({
      defaultPath: file.name,
      filters: [{ name: "Capture", extensions: [ext ?? "pcap"] }],
    });
    if (!localPath) return;
    setDownloading(file.path);
    try {
      await marauderDownloadCapture(file.path, localPath);
      const open = window.confirm(
        `Saved to ${localPath}\n\nOpen file location?`,
      );
      if (open) {
        await openPath(localPath);
      }
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 gap-3">
      <WifiBoardTabIntro
        title="SD capture files"
        summary="After Marauder sessions on the Flipper, PCAP, CSV, and log files land on the microSD card. This tab lists them and saves copies to your PC. It does not show live WiFi traffic — only files already written to SD."
        bullets={[
          "Requires Flipper connected (USB or BLE), not CLI shell mode",
          "Field tab auto-refreshes a short list; this tab shows everything",
          "Open .pcap files in Wireshark after download",
        ]}
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Scans /ext/apps_data, /ext/wifi_marauder, /ext/pcap, and /ext/marauder on Flipper SD.
        </p>
        <button
          type="button"
          disabled={!isConnected || loading}
          className="text-xs px-2 py-1.5 rounded border border-border-subtle hover:bg-elevated flex items-center gap-1 disabled:opacity-50"
          onClick={() => void refresh()}
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {!isConnected && (
        <p className="text-sm text-dim text-center py-8">
          Connect your Flipper to browse Marauder captures on SD.
        </p>
      )}

      {isConnected && files.length === 0 && !loading && (
        <p className="text-sm text-dim text-center py-8">
          No capture files found under /ext/apps_data, /ext/wifi_marauder, /ext/pcap, or /ext/marauder.
        </p>
      )}

      {files.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto border border-border-subtle rounded-md">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-panel border-b border-border-subtle">
              <tr className="text-left text-dim">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Modified</th>
                <th className="px-3 py-2 font-medium w-24" />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr
                  key={f.path}
                  className="border-b border-border-subtle/50 hover:bg-surface/40"
                >
                  <td className="px-3 py-2 font-mono truncate max-w-[12rem]" title={f.path}>
                    {f.name}
                  </td>
                  <td className="px-3 py-2 text-muted">{formatSize(f.size)}</td>
                  <td className="px-3 py-2 text-muted">{formatTs(f.modified)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={downloading === f.path}
                      className="text-accent hover:underline flex items-center gap-1 disabled:opacity-50"
                      onClick={() => void downloadFile(f)}
                    >
                      {downloading === f.path ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Download size={12} />
                      )}
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-dim flex items-center gap-1">
        <FolderOpen size={10} />
        Open saved .pcap files in Wireshark for analysis.
      </p>
    </div>
  );
}
