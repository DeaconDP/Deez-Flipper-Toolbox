import { invoke } from "@tauri-apps/api/core";

export interface FbtConfig {
  firmware_origin: string;
  firmware_app_set: string;
  extra_int_apps: string[];
  extra_ext_apps: string[];
  update_splash: string;
  loader_autostart: string;
  extra_defines: string[];
}

export interface AppManifestEntry {
  appid: string;
  name: string | null;
  apptype: string | null;
  path: string;
}

export interface FbtArtifact {
  path: string;
  kind: string;
  size_bytes: number;
  modified_secs: number;
}

export interface FirmwareBase {
  id: string;
  name: string;
  url: string;
}

export const fbtFirmwareBases = (): Promise<FirmwareBase[]> =>
  invoke("fbt_firmware_bases");

export const fbtCloneRepo = (url: string, targetDir: string): Promise<string> =>
  invoke("fbt_clone_repo", { url, target_dir: targetDir });

export const fbtScanManifests = (repoPath: string): Promise<AppManifestEntry[]> =>
  invoke("fbt_scan_manifests", { repo_path: repoPath });

export const fbtReadConfig = (repoPath: string): Promise<FbtConfig> =>
  invoke("fbt_read_config", { repo_path: repoPath });

export const fbtWriteConfig = (repoPath: string, config: FbtConfig): Promise<void> =>
  invoke("fbt_write_config", { repo_path: repoPath, config });

export const fbtListArtifacts = (repoPath: string): Promise<FbtArtifact[]> =>
  invoke("fbt_list_artifacts", { repo_path: repoPath });

export const fbtRun = (
  repoPath: string,
  target: string,
  extraArgs: string[],
  config?: FbtConfig,
): Promise<number> =>
  invoke("fbt_run", {
    repo_path: repoPath,
    target,
    extra_args: extraArgs,
    config: config ?? null,
  });

export const fbtListProfiles = (): Promise<string[]> =>
  invoke("fbt_list_profiles");

export const fbtSaveProfile = (name: string, config: FbtConfig): Promise<void> =>
  invoke("fbt_save_profile", { name, config });

export const fbtLoadProfile = (name: string): Promise<FbtConfig> =>
  invoke("fbt_load_profile", { name });

export const fbtProfilesDir = (): Promise<string> =>
  invoke("fbt_profiles_dir");
