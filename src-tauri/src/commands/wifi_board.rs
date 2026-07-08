//! WiFi Board setup: Marauder firmware fetch/flash and companion FAP deploy.

use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::commands::client::with_client;
use crate::commands::device::{list_all_serial_ports, list_ports, PortInfo};
use crate::commands::tools::{detect_esptool, run_esptool, EsptoolInvocation};
use crate::error::{FlipperError, Result};
use crate::flipper::marauder::{
    build_flash_args, cache_root, fetch_companion_fap, fetch_marauder_release,
    list_companion_releases, list_marauder_releases, profile, suggest_profile_from_chip_output,
    BoardProfile, CompanionFapCache, FlashMode, MarauderReleaseCache, ReleaseSummary,
    BOARD_PROFILES,
};
use crate::flipper::marauder_serial;
use crate::flipper::storage;
use crate::state::AppState;

static WIFI_FLASH_RUNNING: AtomicBool = AtomicBool::new(false);
static WIFI_BOARD_CANCEL: AtomicBool = AtomicBool::new(false);

pub fn is_flash_running() -> bool {
    WIFI_FLASH_RUNNING.load(Ordering::Relaxed)
}

fn is_cancelled() -> bool {
    WIFI_BOARD_CANCEL.load(Ordering::Relaxed)
}

fn emit_download_progress(app: &AppHandle, pct: u64) {
    let _ = app.emit("download-progress", pct.min(100) as u32);
}

#[derive(Debug, Clone, Serialize)]
pub struct WifiBoardTools {
    pub esptool: crate::commands::tools::ToolStatus,
}

#[tauri::command]
pub fn wifi_board_profiles() -> Vec<BoardProfile> {
    BOARD_PROFILES.to_vec()
}

#[tauri::command]
pub async fn wifi_board_detect_tools(esptool_path: Option<String>) -> Result<WifiBoardTools> {
    let (esptool, _) = detect_esptool(esptool_path.as_deref());
    Ok(WifiBoardTools { esptool })
}

#[tauri::command]
pub fn wifi_board_list_ports() -> Result<Vec<PortInfo>> {
    let ports = list_all_serial_ports()?;
    Ok(ports
        .into_iter()
        .filter(|p| !p.is_flipper && !p.is_flipper_bt)
        .collect())
}

#[tauri::command]
pub async fn wifi_board_list_releases(limit: Option<usize>) -> Result<Vec<ReleaseSummary>> {
    tauri::async_runtime::spawn_blocking(move || list_marauder_releases(limit.unwrap_or(10)))
        .await
        .map_err(|e| FlipperError::Internal(e.to_string()))?
}

#[tauri::command]
pub async fn wifi_board_list_companion_releases(
    limit: Option<usize>,
) -> Result<Vec<ReleaseSummary>> {
    tauri::async_runtime::spawn_blocking(move || list_companion_releases(limit.unwrap_or(10)))
        .await
        .map_err(|e| FlipperError::Internal(e.to_string()))?
}

#[tauri::command]
pub fn wifi_board_cancel() {
    WIFI_BOARD_CANCEL.store(true, Ordering::SeqCst);
}

#[derive(Debug, Clone, Serialize)]
pub struct ChipDetectResult {
    pub output: String,
    pub suggested_profile_id: Option<String>,
    pub mac_address: Option<String>,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn wifi_board_chip_id(
    port: String,
    esptool_path: Option<String>,
) -> Result<ChipDetectResult> {
    tauri::async_runtime::spawn_blocking(move || {
        let ports = list_ports()?;
        if ports.iter().any(|p| p.name == port && p.is_flipper) {
            return Err(FlipperError::Internal(
                "Cannot probe a Flipper port — select your ESP32 USB serial port".into(),
            ));
        }

        let (_, invocation) = detect_esptool(esptool_path.as_deref());
        let invocation = invocation.ok_or_else(|| {
            FlipperError::Internal(
                "esptool not found — install Python esptool, esptool on PATH, or uv".into(),
            )
        })?;

        let mut chip_args = vec!["--port".into(), port.clone(), "chip_id".into()];
        let chip_output = run_esptool_capture(&invocation, &mut chip_args)?;
        let suggested = suggest_profile_from_chip_output(&chip_output).map(str::to_string);

        let mut mac_args = vec!["--port".into(), port, "read_mac".into()];
        let mac_output = run_esptool_capture(&invocation, &mut mac_args).ok();
        let mac_address = mac_output.and_then(parse_mac_from_esptool);

        Ok(ChipDetectResult {
            output: chip_output,
            suggested_profile_id: suggested,
            mac_address,
        })
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?
}

fn parse_mac_from_esptool(output: String) -> Option<String> {
    for line in output.lines() {
        let lower = line.to_lowercase();
        if lower.contains("mac") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            for part in parts {
                let clean = part.trim_matches(|c: char| !c.is_ascii_hexdigit() && c != ':');
                if clean.matches(':').count() == 5 && clean.len() >= 17 {
                    return Some(clean.to_ascii_uppercase());
                }
            }
        }
    }
    None
}

fn run_esptool_capture(invocation: &EsptoolInvocation, args: &mut Vec<String>) -> Result<String> {
    let mut cmd = Command::new(&invocation.program);
    cmd.args(&invocation.prefix_args);
    cmd.args(args);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let out = cmd.output().map_err(FlipperError::Io)?;
    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);
    let combined = if stderr.is_empty() {
        stdout.into_owned()
    } else if stdout.is_empty() {
        stderr.into_owned()
    } else {
        format!("{stdout}\n{stderr}")
    };
    if !out.status.success() && combined.trim().is_empty() {
        return Err(FlipperError::Internal(format!(
            "esptool exited with {}",
            out.status.code().unwrap_or(-1)
        )));
    }
    Ok(combined)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn wifi_board_fetch_release(
    tag: String,
    profile_id: String,
    app: AppHandle,
) -> Result<MarauderReleaseCache> {
    WIFI_BOARD_CANCEL.store(false, Ordering::SeqCst);
    tauri::async_runtime::spawn_blocking(move || {
        fetch_marauder_release(
            &tag,
            &profile_id,
            &is_cancelled,
            &|pct, _| emit_download_progress(&app, pct),
        )
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn wifi_board_flash(
    port: String,
    profile_id: String,
    tag: String,
    mode: FlashMode,
    esptool_path: Option<String>,
    custom_firmware_path: Option<String>,
    app: AppHandle,
) -> Result<i32> {
    if WIFI_FLASH_RUNNING.swap(true, Ordering::SeqCst) {
        return Err(FlipperError::Internal(
            "A WiFi board flash is already in progress".into(),
        ));
    }
    if crate::flipper::marauder_serial::console_is_active() {
        return Err(FlipperError::Internal(
            "Close the Marauder console before flashing".into(),
        ));
    }
    WIFI_BOARD_CANCEL.store(false, Ordering::SeqCst);

    let result = tauri::async_runtime::spawn_blocking(move || {
        let ports = list_ports()?;
        if ports.iter().any(|p| p.name == port && p.is_flipper) {
            return Err(FlipperError::Internal(
                "Refusing to flash a Flipper port — select your ESP32 USB serial port".into(),
            ));
        }

        let prof = profile(&profile_id).ok_or_else(|| {
            FlipperError::Internal(format!("unknown board profile {profile_id}"))
        })?;

        let cache = fetch_marauder_release(
            &tag,
            &profile_id,
            &is_cancelled,
            &|pct, _| emit_download_progress(&app, pct),
        )?;

        let custom = custom_firmware_path
            .filter(|s| !s.is_empty())
            .map(PathBuf::from);

        let flash_args = build_flash_args(
            &port,
            prof,
            &cache,
            mode,
            custom.as_deref(),
        )?;

        let (_, invocation) = detect_esptool(esptool_path.as_deref());
        let invocation =
            invocation.ok_or_else(|| FlipperError::Internal("esptool not found".into()))?;

        run_esptool(&invocation, &flash_args, &app)
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()));

    WIFI_FLASH_RUNNING.store(false, Ordering::SeqCst);
    result?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn wifi_board_fetch_companion_fap(
    channel: Option<String>,
    tag: Option<String>,
    app: AppHandle,
) -> Result<CompanionFapCache> {
    let ch = channel.unwrap_or_else(|| "release".into());
    WIFI_BOARD_CANCEL.store(false, Ordering::SeqCst);
    tauri::async_runtime::spawn_blocking(move || {
        fetch_companion_fap(
            &ch,
            tag.as_deref(),
            &is_cancelled,
            &|pct, _| emit_download_progress(&app, pct),
        )
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn wifi_board_deploy_companion(
    channel: Option<String>,
    tag: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<()> {
    let ch = channel.unwrap_or_else(|| "release".into());
    let client_mutex = Arc::clone(&state.client);
    let mode_mutex = Arc::clone(&state.mode);
    WIFI_BOARD_CANCEL.store(false, Ordering::SeqCst);

    tauri::async_runtime::spawn_blocking(move || {
        let cached = fetch_companion_fap(
            &ch,
            tag.as_deref(),
            &is_cancelled,
            &|pct, _| emit_download_progress(&app, pct),
        )?;
        let bytes = std::fs::read(&cached.artifact.local_path)?;
        let remote_path = "/ext/apps/GPIO/esp32_wifi_marauder.fap";

        let app_for_progress = app.clone();
        with_client(&mode_mutex, &client_mutex, |c| {
            storage::storage_mkdir(c, "/ext/apps/GPIO")?;
            storage::storage_write(
                c,
                remote_path,
                &bytes,
                |sent, total| {
                    let pct = if total == 0 {
                        0
                    } else {
                        ((sent as f64 / total as f64) * 100.0).round() as u8
                    };
                    let _ = app_for_progress.emit("upload-progress", pct);
                },
                &is_cancelled,
            )
        })?;
        let _ = app.emit("upload-progress", 100);
        Ok(())
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?
}

#[derive(Debug, Clone, Serialize)]
pub struct WifiBoardHealth {
    pub companion_fap_on_sd: bool,
    pub cached_firmware_tags: Vec<String>,
    pub latest_marauder_tag: Option<String>,
    pub firmware_outdated: bool,
}

#[tauri::command]
pub async fn wifi_board_health_check(state: State<'_, AppState>) -> Result<WifiBoardHealth> {
    let client_mutex = Arc::clone(&state.client);
    let mode_mutex = Arc::clone(&state.mode);

    let companion_on_sd = tauri::async_runtime::spawn_blocking({
        let client_mutex = Arc::clone(&client_mutex);
        let mode_mutex = Arc::clone(&mode_mutex);
        move || {
            with_client(&mode_mutex, &client_mutex, |c| {
                Ok(storage::storage_stat(c, "/ext/apps/GPIO/esp32_wifi_marauder.fap").is_ok())
            })
            .unwrap_or(false)
        }
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?;

    let (cached_tags, latest_tag) = tauri::async_runtime::spawn_blocking(move || {
        let mut tags = Vec::new();
        if let Ok(root) = cache_root() {
            if let Ok(entries) = std::fs::read_dir(&root) {
                for entry in entries.flatten() {
                    if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                        let name = entry.file_name().to_string_lossy().into_owned();
                        if !name.starts_with("companion") {
                            tags.push(name);
                        }
                    }
                }
            }
        }
        tags.sort();
        tags.reverse();
        let latest = list_marauder_releases(1).ok().and_then(|r| r.into_iter().next().map(|s| s.tag));
        (tags, latest)
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?;

    let firmware_outdated = match (&cached_tags.first(), &latest_tag) {
        (Some(cached), Some(latest)) => cached.as_str() != latest.as_str(),
        _ => false,
    };

    Ok(WifiBoardHealth {
        companion_fap_on_sd: companion_on_sd,
        cached_firmware_tags: cached_tags,
        latest_marauder_tag: latest_tag,
        firmware_outdated,
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum WifiBoardConnectionMode {
    Passthrough,
    DirectUsb,
    FlipperOnly,
    Disconnected,
}

#[derive(Debug, Clone, Serialize)]
pub struct WifiBoardFieldStatus {
    pub flipper_connected: bool,
    pub companion_on_sd: Option<bool>,
    pub firmware_outdated: Option<bool>,
    pub connection_mode: WifiBoardConnectionMode,
    pub passthrough_port: Option<String>,
    pub direct_esp_port: Option<String>,
    pub console_active: bool,
    pub console_port: Option<String>,
}

#[tauri::command]
pub async fn wifi_board_field_status(state: State<'_, AppState>) -> Result<WifiBoardFieldStatus> {
    let flipper_connected = {
        let guard = state.client.lock().unwrap();
        guard.is_some()
    };

    let (companion_on_sd, firmware_outdated) = if flipper_connected {
        let health = wifi_board_health_check(state).await?;
        (
            Some(health.companion_fap_on_sd),
            Some(health.firmware_outdated),
        )
    } else {
        (None, None)
    };

    let ports = list_all_serial_ports().unwrap_or_default();
    let passthrough_port = ports
        .iter()
        .find(|p| p.is_devboard_passthrough && p.available)
        .map(|p| p.name.clone());
    let direct_esp_port = ports
        .iter()
        .find(|p| {
            !p.is_flipper
                && !p.is_flipper_bt
                && !p.is_devboard_passthrough
                && (p.is_espressif || p.vid == Some(0x303A))
                && p.available
        })
        .map(|p| p.name.clone());

    let connection_mode = if passthrough_port.is_some() {
        WifiBoardConnectionMode::Passthrough
    } else if direct_esp_port.is_some() {
        WifiBoardConnectionMode::DirectUsb
    } else if flipper_connected {
        WifiBoardConnectionMode::FlipperOnly
    } else {
        WifiBoardConnectionMode::Disconnected
    };

    Ok(WifiBoardFieldStatus {
        flipper_connected,
        companion_on_sd,
        firmware_outdated,
        connection_mode,
        passthrough_port,
        direct_esp_port,
        console_active: marauder_serial::console_is_active(),
        console_port: marauder_serial::console_port(),
    })
}
