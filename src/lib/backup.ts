import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface BackupManifest {
  id: string;
  created_at: string;
  firmware_version: string | null;
  device_name: string | null;
  has_internal: boolean;
  has_sd: boolean;
  sd_bytes: number;
  checksum: string;
}

export interface BackupSummary {
  id: string;
  path: string;
  created_at: string;
  firmware_version: string | null;
  size_bytes: number;
  has_internal: boolean;
  has_sd: boolean;
}

export interface BackupProgress {
  stage: string;
  message: string;
  pct: number | null;
}

export const backupDefaultDir = (): Promise<string> =>
  invoke("backup_default_dir");

export const backupList = (): Promise<BackupSummary[]> =>
  invoke("backup_list");

export const backupCreateFull = (
  qflipperPath: string | null,
  firmwareVersion: string | null,
  deviceName: string | null,
): Promise<BackupManifest> =>
  invoke("backup_create_full", {
    qflipper_path: qflipperPath,
    firmware_version: firmwareVersion,
    device_name: deviceName,
  });

export const backupRestore = (
  backupPath: string,
  options: { restore_internal: boolean; restore_sd: boolean },
  qflipperPath: string | null,
): Promise<void> =>
  invoke("backup_restore", {
    backup_path: backupPath,
    options,
    qflipper_path: qflipperPath,
  });

export const onBackupProgress = (cb: (p: BackupProgress) => void) =>
  listen<BackupProgress>("backup-progress", (e) => cb(e.payload));
