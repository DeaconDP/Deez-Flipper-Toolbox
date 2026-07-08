//! ESP32 Marauder board profiles, GitHub release fetch/cache, and esptool flash
//! command building for the WiFi Board setup workflow.

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::error::{FlipperError, Result};
use crate::flipper::firmware::{download, sha256_hex};

pub const MARAUDER_RELEASES_API: &str =
    "https://api.github.com/repos/justcallmekoko/ESP32Marauder/releases";
pub const COMPANION_RELEASES_API: &str =
    "https://api.github.com/repos/0xchocolate/flipperzero-wifi-marauder/releases";

const BOOTLOADER_NAME: &str = "esp32_marauder.ino.bootloader.bin";
const PARTITIONS_NAME: &str = "esp32_marauder.ino.partitions.bin";
const BOOT_APP_NAME: &str = "boot_app0.bin";

/// Standard ESP32 / ESP32-S2 flash layout.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct FlashLayout {
    pub bootloader_offset: u32,
    pub partitions_offset: u32,
    pub boot_app_offset: u32,
    pub firmware_offset: u32,
}

pub const LAYOUT_STANDARD: FlashLayout = FlashLayout {
    bootloader_offset: 0x1000,
    partitions_offset: 0x8000,
    boot_app_offset: 0xE000,
    firmware_offset: 0x10000,
};

pub const LAYOUT_S3: FlashLayout = FlashLayout {
    bootloader_offset: 0x0,
    partitions_offset: 0x8000,
    boot_app_offset: 0xE000,
    firmware_offset: 0x10000,
};

/// A selectable Marauder hardware profile for Flipper GPIO use.
#[derive(Debug, Clone, Serialize)]
pub struct BoardProfile {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    /// esptool `--chip` value.
    pub chip: &'static str,
    /// Suffix matched against release asset names (e.g. `_lddb.bin`).
    pub firmware_suffix: &'static str,
    pub layout: FlashLayout,
    /// Whether this profile typically supports Bluetooth Marauder commands.
    pub has_bt: bool,
}

pub const BOARD_PROFILES: &[BoardProfile] = &[
    BoardProfile {
        id: "lddb",
        name: "Generic headless ESP32",
        description: "NodeMCU-32S, Wemos D1 Mini, LDDB-style boards",
        chip: "esp32",
        firmware_suffix: "_lddb.bin",
        layout: LAYOUT_STANDARD,
        has_bt: true,
    },
    BoardProfile {
        id: "dev_board_pro",
        name: "Dev Board Pro / BFFB",
        description: "AWOK V3-style, BFFB, pro headless boards",
        chip: "esp32",
        firmware_suffix: "_marauder_dev_board_pro.bin",
        layout: LAYOUT_STANDARD,
        has_bt: true,
    },
    BoardProfile {
        id: "flipper_s2",
        name: "ESP32-S2 (Flipper-style)",
        description: "ESP32-S2 boards wired like the official WiFi dev board",
        chip: "esp32s2",
        firmware_suffix: "_flipper.bin",
        layout: LAYOUT_STANDARD,
        has_bt: false,
    },
    BoardProfile {
        id: "multiboard_s3",
        name: "ESP32-S3 headless",
        description: "ESP32-S3 multi-board variant",
        chip: "esp32s3",
        firmware_suffix: "_multiboardS3.bin",
        layout: LAYOUT_S3,
        has_bt: true,
    },
];

pub fn profile(id: &str) -> Option<&'static BoardProfile> {
    BOARD_PROFILES.iter().find(|p| p.id == id)
}

/// Suggest a profile id from esptool chip detection output.
pub fn suggest_profile_from_chip_output(output: &str) -> Option<&'static str> {
    let lower = output.to_lowercase();
    if lower.contains("esp32-s3") || lower.contains("esp32s3") {
        return Some("multiboard_s3");
    }
    if lower.contains("esp32-s2") || lower.contains("esp32s2") {
        return Some("flipper_s2");
    }
    if lower.contains("esp32") {
        return Some("lddb");
    }
    None
}

// ── GitHub releases ─────────────────────────────────────────────────────────

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(20))
        .user_agent(concat!("DeezFlipperTools/", env!("CARGO_PKG_VERSION")))
        .build()
}

#[derive(Debug, Deserialize)]
struct GhRelease {
    #[serde(default)]
    tag_name: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    assets: Vec<GhAsset>,
}

#[derive(Debug, Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReleaseSummary {
    pub tag: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CachedArtifact {
    pub name: String,
    pub local_path: String,
    pub size: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MarauderReleaseCache {
    pub tag: String,
    pub profile_id: String,
    pub bootloader: CachedArtifact,
    pub partitions: CachedArtifact,
    pub boot_app: CachedArtifact,
    pub firmware: CachedArtifact,
}

pub fn cache_root() -> Result<PathBuf> {
    let root = dirs::cache_dir()
        .ok_or_else(|| FlipperError::Internal("no cache directory".into()))?
        .join("deez-flipper-tools")
        .join("marauder");
    fs::create_dir_all(&root)?;
    Ok(root)
}

fn fetch_releases(url: &str) -> Result<Vec<GhRelease>> {
    let body = agent()
        .get(url)
        .call()
        .map_err(|e| FlipperError::Internal(format!("GitHub API request failed: {e}")))?
        .into_string()
        .map_err(|e| FlipperError::Internal(format!("GitHub API read failed: {e}")))?;
    serde_json::from_str(&body)
        .map_err(|e| FlipperError::Internal(format!("GitHub API parse failed: {e}")))
}

pub fn list_marauder_releases(limit: usize) -> Result<Vec<ReleaseSummary>> {
    list_releases_from(MARAUDER_RELEASES_API, limit)
}

pub fn list_companion_releases(limit: usize) -> Result<Vec<ReleaseSummary>> {
    list_releases_from(COMPANION_RELEASES_API, limit)
}

fn list_releases_from(url: &str, limit: usize) -> Result<Vec<ReleaseSummary>> {
    let releases = fetch_releases(url)?;
    Ok(releases
        .into_iter()
        .take(limit)
        .map(|r| ReleaseSummary {
            tag: r.tag_name.clone(),
            name: if r.name.is_empty() {
                r.tag_name
            } else {
                r.name
            },
        })
        .collect())
}

fn release_by_tag(tag: &str) -> Result<GhRelease> {
    let releases = fetch_releases(MARAUDER_RELEASES_API)?;
    releases
        .into_iter()
        .find(|r| r.tag_name == tag)
        .ok_or_else(|| FlipperError::Internal(format!("release {tag} not found")))
}

fn find_asset<'a>(assets: &'a [GhAsset], name: &str) -> Result<&'a GhAsset> {
    assets
        .iter()
        .find(|a| a.name == name)
        .ok_or_else(|| FlipperError::Internal(format!("asset {name} not found in release")))
}

fn find_firmware_asset<'a>(assets: &'a [GhAsset], suffix: &str) -> Result<&'a GhAsset> {
    assets
        .iter()
        .find(|a| a.name.ends_with(suffix))
        .ok_or_else(|| {
            FlipperError::Internal(format!(
                "no firmware asset ending with {suffix} in release"
            ))
        })
}

fn write_cached(path: &Path, bytes: &[u8]) -> Result<CachedArtifact> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, bytes)?;
    Ok(CachedArtifact {
        name: path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
        local_path: path.to_string_lossy().into_owned(),
        size: bytes.len() as u64,
        sha256: sha256_hex(bytes),
    })
}

fn cache_file_if_needed(
    url: &str,
    dest: &Path,
    cancelled: &dyn Fn() -> bool,
    on_progress: &dyn Fn(u64, u64),
) -> Result<Vec<u8>> {
    if dest.exists() {
        on_progress(100, 100);
        return fs::read(dest).map_err(FlipperError::Io);
    }
    let bytes = download(
        url,
        |downloaded, total| {
            let pct = if total == 0 {
                0
            } else {
                ((downloaded as f64 / total as f64) * 100.0).round() as u64
            };
            on_progress(pct.min(100), 100);
        },
        cancelled,
    )?;
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(dest, &bytes)?;
    on_progress(100, 100);
    Ok(bytes)
}

/// Download (or reuse cached) Marauder release artifacts for a board profile.
pub fn fetch_marauder_release(
    tag: &str,
    profile_id: &str,
    cancelled: &dyn Fn() -> bool,
    on_progress: &dyn Fn(u64, u64),
) -> Result<MarauderReleaseCache> {
    let prof = profile(profile_id)
        .ok_or_else(|| FlipperError::Internal(format!("unknown profile {profile_id}")))?;
    let release = release_by_tag(tag)?;
    let dir = cache_root()?.join(tag).join(profile_id);

    let bootloader_asset = find_asset(&release.assets, BOOTLOADER_NAME)?;
    let partitions_asset = find_asset(&release.assets, PARTITIONS_NAME)?;
    let boot_app_asset = find_asset(&release.assets, BOOT_APP_NAME)?;
    let firmware_asset = find_firmware_asset(&release.assets, prof.firmware_suffix)?;

    let bootloader_path = dir.join(BOOTLOADER_NAME);
    let partitions_path = dir.join(PARTITIONS_NAME);
    let boot_app_path = dir.join(BOOT_APP_NAME);
    let firmware_path = dir.join(firmware_asset.name.clone());

    let artifact_progress = |idx: u64| {
        on_progress((idx * 25).min(100), 100);
    };

    let bootloader_bytes = cache_file_if_needed(
        &bootloader_asset.browser_download_url,
        &bootloader_path,
        cancelled,
        &|pct, _| artifact_progress(pct / 4),
    )?;
    let partitions_bytes = cache_file_if_needed(
        &partitions_asset.browser_download_url,
        &partitions_path,
        cancelled,
        &|pct, _| artifact_progress(25 + pct / 4),
    )?;
    let boot_app_bytes = cache_file_if_needed(
        &boot_app_asset.browser_download_url,
        &boot_app_path,
        cancelled,
        &|pct, _| artifact_progress(50 + pct / 4),
    )?;
    let firmware_bytes = cache_file_if_needed(
        &firmware_asset.browser_download_url,
        &firmware_path,
        cancelled,
        &|pct, _| artifact_progress(75 + pct / 4),
    )?;

    Ok(MarauderReleaseCache {
        tag: tag.to_string(),
        profile_id: profile_id.to_string(),
        bootloader: write_cached(&bootloader_path, &bootloader_bytes)?,
        partitions: write_cached(&partitions_path, &partitions_bytes)?,
        boot_app: write_cached(&boot_app_path, &boot_app_bytes)?,
        firmware: write_cached(&firmware_path, &firmware_bytes)?,
    })
}

// ── Companion FAP ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct CompanionFapCache {
    pub tag: String,
    pub artifact: CachedArtifact,
}

/// Download the WiFi Marauder companion `.fap` from GitHub releases.
/// `channel` is `"release"` or `"dev"` — picks the matching ZIP asset when present.
/// When `tag` is `None`, uses the latest release.
pub fn fetch_companion_fap(
    channel: &str,
    tag: Option<&str>,
    cancelled: &dyn Fn() -> bool,
    on_progress: &dyn Fn(u64, u64),
) -> Result<CompanionFapCache> {
    let releases = fetch_releases(COMPANION_RELEASES_API)?;
    let release = if let Some(t) = tag {
        releases
            .into_iter()
            .find(|r| r.tag_name == t)
            .ok_or_else(|| FlipperError::Internal(format!("companion release {t} not found")))?
    } else {
        releases
            .into_iter()
            .next()
            .ok_or_else(|| FlipperError::Internal("no companion app releases found".into()))?
    };

    let zip_name = format!("esp32_wifi_marauder-{channel}.zip");
    let asset = release
        .assets
        .iter()
        .find(|a| a.name == zip_name)
        .or_else(|| {
            release
                .assets
                .iter()
                .find(|a| a.name.starts_with("esp32_wifi_marauder") && a.name.ends_with(".zip"))
        })
        .ok_or_else(|| FlipperError::Internal(format!("companion ZIP {zip_name} not found")))?;

    let dir = cache_root()?.join("companion").join(&release.tag_name);
    fs::create_dir_all(&dir)?;
    let zip_path = dir.join(&asset.name);
    let fap_path = dir.join("esp32_wifi_marauder.fap");

    if !fap_path.exists() {
        let zip_bytes = if zip_path.exists() {
            on_progress(100, 100);
            fs::read(&zip_path)?
        } else {
            let bytes = download(
                &asset.browser_download_url,
                |downloaded, total| {
                    let pct = if total == 0 {
                        0
                    } else {
                        ((downloaded as f64 / total as f64) * 100.0).round() as u64
                    };
                    on_progress(pct.min(100), 100);
                },
                cancelled,
            )?;
            fs::write(&zip_path, &bytes)?;
            bytes
        };
        extract_fap_from_zip(&zip_bytes, &fap_path)?;
    } else {
        on_progress(100, 100);
    }

    let fap_bytes = fs::read(&fap_path)?;
    Ok(CompanionFapCache {
        tag: release.tag_name.clone(),
        artifact: write_cached(&fap_path, &fap_bytes)?,
    })
}

fn extract_fap_from_zip(zip_bytes: &[u8], dest: &Path) -> Result<()> {
    let cursor = std::io::Cursor::new(zip_bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| FlipperError::Internal(format!("companion ZIP invalid: {e}")))?;
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| FlipperError::Internal(format!("ZIP entry error: {e}")))?;
        let name = file.name().replace('\\', "/");
        if name.ends_with("esp32_wifi_marauder.fap") || name.ends_with(".fap") {
            let mut buf = Vec::new();
            file.read_to_end(&mut buf)?;
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(dest, &buf)?;
            return Ok(());
        }
    }
    Err(FlipperError::Internal(
        "esp32_wifi_marauder.fap not found inside companion ZIP".into(),
    ))
}

// ── esptool flash args ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FlashMode {
    Full,
    AppOnly,
}

/// Build esptool `write_flash` arguments for the given cache and mode.
pub fn build_flash_args(
    port: &str,
    prof: &BoardProfile,
    cache: &MarauderReleaseCache,
    mode: FlashMode,
    custom_firmware: Option<&Path>,
) -> Result<Vec<String>> {
    let firmware_path = custom_firmware
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| cache.firmware.local_path.clone());

    let mut args = vec![
        "--chip".into(),
        prof.chip.into(),
        "--port".into(),
        port.into(),
        "--baud".into(),
        "921600".into(),
        "write_flash".into(),
        "-z".into(),
    ];

    match mode {
        FlashMode::Full => {
            let layout = prof.layout;
            args.push(format!("0x{:x}", layout.bootloader_offset));
            args.push(cache.bootloader.local_path.clone());
            args.push(format!("0x{:x}", layout.partitions_offset));
            args.push(cache.partitions.local_path.clone());
            args.push(format!("0x{:x}", layout.boot_app_offset));
            args.push(cache.boot_app.local_path.clone());
            args.push(format!("0x{:x}", layout.firmware_offset));
            args.push(firmware_path);
        }
        FlashMode::AppOnly => {
            args.push(format!("0x{:x}", prof.layout.firmware_offset));
            args.push(firmware_path);
        }
    }

    Ok(args)
}
