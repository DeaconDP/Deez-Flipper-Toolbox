import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface BoardProfile {
  id: string;
  name: string;
  description: string;
  chip: string;
  firmware_suffix: string;
  has_bt: boolean;
  layout: {
    bootloader_offset: number;
    partitions_offset: number;
    boot_app_offset: number;
    firmware_offset: number;
  };
}

export interface ReleaseSummary {
  tag: string;
  name: string;
}

export interface CachedArtifact {
  name: string;
  local_path: string;
  size: number;
  sha256: string;
}

export interface MarauderReleaseCache {
  tag: string;
  profile_id: string;
  bootloader: CachedArtifact;
  partitions: CachedArtifact;
  boot_app: CachedArtifact;
  firmware: CachedArtifact;
}

export interface CompanionFapCache {
  tag: string;
  artifact: CachedArtifact;
}

export interface EspPortInfo {
  name: string;
  is_flipper: boolean;
  vid: number | null;
  pid: number | null;
  manufacturer: string | null;
  available?: boolean;
  is_flipper_bt?: boolean;
  is_espressif?: boolean;
  is_devboard_passthrough?: boolean;
}

export interface ChipDetectResult {
  output: string;
  suggested_profile_id: string | null;
  mac_address: string | null;
}

export interface WifiBoardTools {
  esptool: {
    name: string;
    found: boolean;
    path: string | null;
    version: string | null;
  };
}

export type WifiBoardConnectionMode =
  | "passthrough"
  | "direct_usb"
  | "flipper_only"
  | "disconnected";

export interface WifiBoardHealth {
  companion_fap_on_sd: boolean;
  cached_firmware_tags: string[];
  latest_marauder_tag: string | null;
  firmware_outdated: boolean;
}

export interface WifiBoardFieldStatus {
  flipper_connected: boolean;
  companion_on_sd: boolean | null;
  firmware_outdated: boolean | null;
  connection_mode: WifiBoardConnectionMode;
  passthrough_port: string | null;
  direct_esp_port: string | null;
  console_active: boolean;
  console_port: string | null;
}

export interface MarauderConsoleStatus {
  active: boolean;
  port: string | null;
}

export interface MarauderCaptureFile {
  path: string;
  name: string;
  size: number;
  modified: number;
}

export type FlashMode = "full" | "app_only";
export type BoardSetupType = "custom_gpio" | "official_devboard";

export const wifiBoardProfiles = (): Promise<BoardProfile[]> =>
  invoke("wifi_board_profiles");

export const wifiBoardDetectTools = (
  esptoolPath?: string | null,
): Promise<WifiBoardTools> =>
  invoke("wifi_board_detect_tools", { esptool_path: esptoolPath ?? null });

export const wifiBoardListPorts = (): Promise<EspPortInfo[]> =>
  invoke("wifi_board_list_ports");

export const wifiBoardListReleases = (limit = 10): Promise<ReleaseSummary[]> =>
  invoke("wifi_board_list_releases", { limit });

export const wifiBoardListCompanionReleases = (
  limit = 10,
): Promise<ReleaseSummary[]> =>
  invoke("wifi_board_list_companion_releases", { limit });

export const wifiBoardCancel = (): Promise<void> =>
  invoke("wifi_board_cancel");

export const wifiBoardChipId = (
  port: string,
  esptoolPath?: string | null,
): Promise<ChipDetectResult> =>
  invoke("wifi_board_chip_id", {
    port,
    esptool_path: esptoolPath ?? null,
  });

export const wifiBoardFetchRelease = (
  tag: string,
  profileId: string,
): Promise<MarauderReleaseCache> =>
  invoke("wifi_board_fetch_release", { tag, profile_id: profileId });

export const wifiBoardFlash = (
  port: string,
  profileId: string,
  tag: string,
  mode: FlashMode,
  esptoolPath?: string | null,
  customFirmwarePath?: string | null,
): Promise<number> =>
  invoke("wifi_board_flash", {
    port,
    profile_id: profileId,
    tag,
    mode,
    esptool_path: esptoolPath ?? null,
    custom_firmware_path: customFirmwarePath ?? null,
  });

export const wifiBoardFetchCompanionFap = (
  channel?: "release" | "dev",
  tag?: string | null,
): Promise<CompanionFapCache> =>
  invoke("wifi_board_fetch_companion_fap", {
    channel: channel ?? null,
    tag: tag ?? null,
  });

export const wifiBoardDeployCompanion = (
  channel?: "release" | "dev",
  tag?: string | null,
): Promise<void> =>
  invoke("wifi_board_deploy_companion", {
    channel: channel ?? null,
    tag: tag ?? null,
  });

export const wifiBoardHealthCheck = (): Promise<WifiBoardHealth> =>
  invoke("wifi_board_health_check");

export const wifiBoardFieldStatus = (): Promise<WifiBoardFieldStatus> =>
  invoke("wifi_board_field_status");

export const marauderConsoleStart = (port: string): Promise<void> =>
  invoke("marauder_console_start", { port });

export const marauderConsoleSend = (line: string): Promise<void> =>
  invoke("marauder_console_send", { line });

export const marauderConsoleStop = (): Promise<void> =>
  invoke("marauder_console_stop");

export const marauderConsoleStatus = (): Promise<MarauderConsoleStatus> =>
  invoke("marauder_console_status");

export const marauderConsoleListPorts = (): Promise<EspPortInfo[]> =>
  invoke("marauder_console_list_ports");

export const marauderListCaptures = (): Promise<MarauderCaptureFile[]> =>
  invoke("marauder_list_captures");

export const marauderDownloadCapture = (
  remotePath: string,
  localPath: string,
): Promise<void> =>
  invoke("marauder_download_capture", {
    remote_path: remotePath,
    local_path: localPath,
  });

export const onMarauderOutput = (
  handler: (text: string) => void,
): Promise<UnlistenFn> =>
  listen<string>("marauder-output", (event) => {
    handler(event.payload);
  });

export const onDownloadProgress = (
  handler: (pct: number) => void,
): Promise<UnlistenFn> =>
  listen<number>("download-progress", (event) => {
    handler(event.payload);
  });

export const onUploadProgress = (
  handler: (pct: number) => void,
): Promise<UnlistenFn> =>
  listen<number>("upload-progress", (event) => {
    handler(event.payload);
  });
