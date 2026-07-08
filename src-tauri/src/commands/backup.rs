//! Full device backup and restore — internal memory via qFlipper-cli + SD mirror via RPC.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::commands::client::with_client;
use crate::commands::storage;
use crate::commands::tools;
use crate::error::{FlipperError, Result};
use crate::flipper::client::FlipperClient;
use crate::flipper::storage as flipper_storage;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupManifest {
    pub id: String,
    pub created_at: String,
    pub firmware_version: Option<String>,
    pub device_name: Option<String>,
    pub has_internal: bool,
    pub has_sd: bool,
    pub sd_bytes: u64,
    pub checksum: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BackupSummary {
    pub id: String,
    pub path: String,
    pub created_at: String,
    pub firmware_version: Option<String>,
    pub size_bytes: u64,
    pub has_internal: bool,
    pub has_sd: bool,
}

#[derive(Debug, Deserialize)]
pub struct RestoreOptions {
    pub restore_internal: bool,
    pub restore_sd: bool,
}

fn backups_root() -> Result<PathBuf> {
    let docs = dirs::document_dir().ok_or_else(|| {
        FlipperError::Internal("could not resolve Documents folder".into())
    })?;
    let root = docs.join("Deez Flipper Tools").join("Backups");
    fs::create_dir_all(&root)?;
    Ok(root)
}

fn timestamp_id() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("backup-{secs}")
}

fn dir_size(path: &Path) -> u64 {
    WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter_map(|e| e.metadata().ok())
        .filter(|m| m.is_file())
        .map(|m| m.len())
        .sum()
}

fn write_manifest(dir: &Path, manifest: &BackupManifest) -> Result<()> {
    let json = serde_json::to_string_pretty(manifest)?;
    fs::write(dir.join("manifest.json"), json)?;
    Ok(())
}

fn read_manifest(dir: &Path) -> Option<BackupManifest> {
    let data = fs::read_to_string(dir.join("manifest.json")).ok()?;
    serde_json::from_str(&data).ok()
}

fn resolve_qflipper_cli(custom: Option<String>) -> Result<PathBuf> {
    tools::tools_resolve_qflipper(custom)
        .map(PathBuf::from)
        .ok_or_else(|| {
            FlipperError::Internal(
                "qFlipper-cli not found — install qFlipper from update.flipperzero.one".into(),
            )
        })
}

fn run_qflipper(cli: &Path, args: &[&str]) -> Result<()> {
    let out = std::process::Command::new(cli)
        .args(args)
        .output()
        .map_err(FlipperError::Io)?;
    if out.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr);
        let stdout = String::from_utf8_lossy(&out.stdout);
        Err(FlipperError::Internal(format!(
            "qFlipper-cli failed: {}{}",
            stdout,
            stderr
        )))
    }
}

fn join_remote(dir: &str, name: &str) -> String {
    if dir.ends_with('/') {
        format!("{dir}{name}")
    } else {
        format!("{dir}/{name}")
    }
}

fn ignore_already_exists(r: Result<()>) -> Result<()> {
    match r {
        Err(FlipperError::Rpc { status: 6, .. }) => Ok(()),
        other => other,
    }
}

fn upload_dir_recursive(
    client: &mut FlipperClient,
    local_dir: &Path,
    remote_dir: &str,
) -> Result<()> {
    for entry in fs::read_dir(local_dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let local_path = entry.path();
        let remote_path = join_remote(remote_dir, &name);
        if local_path.is_dir() {
            ignore_already_exists(flipper_storage::storage_mkdir(client, &remote_path))?;
            upload_dir_recursive(client, &local_path, &remote_path)?;
        } else {
            let data = fs::read(&local_path)?;
            flipper_storage::storage_write(client, &remote_path, &data, |_, _| {}, &|| false)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn backup_default_dir() -> Result<String> {
    Ok(backups_root()?.to_string_lossy().into_owned())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn backup_list() -> Result<Vec<BackupSummary>> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = backups_root()?;
        let mut out = Vec::new();
        for entry in fs::read_dir(&root)? {
            let entry = entry?;
            if !entry.file_type()?.is_dir() {
                continue;
            }
            let path = entry.path();
            let manifest = read_manifest(&path);
            let id = manifest
                .as_ref()
                .map(|m| m.id.clone())
                .unwrap_or_else(|| entry.file_name().to_string_lossy().into_owned());
            out.push(BackupSummary {
                id: id.clone(),
                path: path.to_string_lossy().into_owned(),
                created_at: manifest
                    .as_ref()
                    .map(|m| m.created_at.clone())
                    .unwrap_or_default(),
                firmware_version: manifest.as_ref().and_then(|m| m.firmware_version.clone()),
                size_bytes: dir_size(&path),
                has_internal: path.join("internal").exists(),
                has_sd: path.join("sd").exists(),
            });
        }
        out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(out)
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn backup_create_full(
    qflipper_path: Option<String>,
    firmware_version: Option<String>,
    device_name: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<BackupManifest> {
    let client_mutex = Arc::clone(&state.client);
    let mode_mutex = Arc::clone(&state.mode);
    let generation = state.transfer_generation.fetch_add(1, Ordering::Relaxed) + 1;
    let cancelled_generation = Arc::clone(&state.transfer_cancelled_generation);

    tauri::async_runtime::spawn_blocking(move || {
        let root = backups_root()?;
        let id = timestamp_id();
        let backup_dir = root.join(&id);
        fs::create_dir_all(&backup_dir)?;

        let _ = app.emit("backup-progress", BackupProgress {
            stage: "internal".into(),
            message: "Backing up internal memory via qFlipper-cli…".into(),
            pct: Some(5),
        });

        let internal_dir = backup_dir.join("internal");
        fs::create_dir_all(&internal_dir)?;
        let cli = resolve_qflipper_cli(qflipper_path)?;
        run_qflipper(&cli, &["backup", internal_dir.to_str().unwrap_or("")])?;

        let _ = app.emit("backup-progress", BackupProgress {
            stage: "sd".into(),
            message: "Mirroring SD card (/ext, includes Marauder app data)…".into(),
            pct: Some(10),
        });

        let sd_local = backup_dir.join("sd");
        fs::create_dir_all(&sd_local)?;
        let mut sd_bytes: u64 = 0;

        with_client(&mode_mutex, &client_mutex, |client| {
            let total = storage::sum_tree_bytes(client, "/ext")?;
            let mut done: u64 = 0;
            storage::download_dir_recursive(
                client,
                "/ext",
                &sd_local,
                total,
                &mut done,
                &|d, t| {
                    let pct = 10 + ((d.saturating_mul(80)) / t.max(1)).min(80) as u32;
                    let _ = app.emit("backup-progress", BackupProgress {
                        stage: "sd".into(),
                        message: String::new(),
                        pct: Some(pct),
                    });
                },
                &|| {
                    cancelled_generation.load(Ordering::Relaxed) == generation
                },
            )?;
            sd_bytes = done;
            Ok(())
        })?;

        let manifest = BackupManifest {
            id: id.clone(),
            created_at: chrono_lite_now(),
            firmware_version,
            device_name,
            has_internal: true,
            has_sd: true,
            sd_bytes,
            checksum: String::new(),
        };
        write_manifest(&backup_dir, &manifest)?;

        let _ = app.emit("backup-progress", BackupProgress {
            stage: "archive".into(),
            message: "Creating zip archive…".into(),
            pct: Some(95),
        });
        let zip_path = backup_dir.with_extension("zip");
        create_zip(&backup_dir, &zip_path)?;

        let _ = app.emit("backup-progress", BackupProgress {
            stage: "done".into(),
            message: "Backup complete".into(),
            pct: Some(100),
        });

        Ok(manifest)
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?
}

#[derive(Serialize, Clone)]
struct BackupProgress {
    stage: String,
    message: String,
    pct: Option<u32>,
}

fn chrono_lite_now() -> String {
    // Avoid adding chrono dependency — ISO-ish local timestamp from system time.
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}")
}

fn create_zip(src_dir: &Path, zip_path: &Path) -> Result<()> {
    let file = File::create(zip_path)?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    for entry in WalkDir::new(src_dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = path.strip_prefix(src_dir).unwrap_or(path);
        let name_str = name.to_string_lossy().replace('\\', "/");
        if name_str.is_empty() {
            continue;
        }
        if path.is_file() {
            zip.start_file(name_str, options)?;
            let mut f = File::open(path)?;
            let mut buf = Vec::new();
            f.read_to_end(&mut buf)?;
            zip.write_all(&buf)?;
        } else if path.is_dir() {
            zip.add_directory(format!("{name_str}/"), options)?;
        }
    }
    zip.finish()?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn backup_restore(
    backup_path: String,
    options: RestoreOptions,
    qflipper_path: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<()> {
    let client_mutex = Arc::clone(&state.client);
    let mode_mutex = Arc::clone(&state.mode);

    tauri::async_runtime::spawn_blocking(move || {
        let base = PathBuf::from(&backup_path);
        if options.restore_internal {
            let internal = base.join("internal");
            if internal.exists() {
                let _ = app.emit("backup-progress", BackupProgress {
                    stage: "restore-internal".into(),
                    message: "Restoring internal memory…".into(),
                    pct: Some(20),
                });
                let cli = resolve_qflipper_cli(qflipper_path.clone())?;
                run_qflipper(&cli, &["restore", internal.to_str().unwrap_or("")])?;
            }
        }
        if options.restore_sd {
            let sd = base.join("sd");
            if sd.exists() {
                let _ = app.emit("backup-progress", BackupProgress {
                    stage: "restore-sd".into(),
                    message: "Restoring SD card contents…".into(),
                    pct: Some(50),
                });
                with_client(&mode_mutex, &client_mutex, |client| {
                    upload_dir_recursive(client, &sd, "/ext")
                })?;
            }
        }
        let _ = app.emit("backup-progress", BackupProgress {
            stage: "done".into(),
            message: "Restore complete — reboot Flipper if needed".into(),
            pct: Some(100),
        });
        Ok(())
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?
}
