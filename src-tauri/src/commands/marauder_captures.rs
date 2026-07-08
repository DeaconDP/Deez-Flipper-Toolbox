//! Scan Flipper SD for Marauder capture files (PCAP, CSV, logs).

use std::sync::Arc;

use serde::Serialize;
use tauri::State;

use crate::commands::client::with_client;
use crate::error::{FlipperError, Result};
use crate::flipper::client::FlipperClient;
use crate::flipper::storage;
use crate::state::AppState;

const CAPTURE_ROOTS: &[&str] = &[
    "/ext/apps_data",
    "/ext/wifi_marauder",
    "/ext/pcap",
    "/ext/marauder",
];

const CAPTURE_EXTENSIONS: &[&str] = &[".pcap", ".csv", ".log", ".txt"];

#[derive(Debug, Clone, Serialize)]
pub struct MarauderCaptureFile {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub modified: u32,
}

#[tauri::command]
pub async fn marauder_list_captures(state: State<'_, AppState>) -> Result<Vec<MarauderCaptureFile>> {
    let client_mutex = Arc::clone(&state.client);
    let mode_mutex = Arc::clone(&state.mode);

    tauri::async_runtime::spawn_blocking(move || {
        let mut out = Vec::new();
        with_client(&mode_mutex, &client_mutex, |client| {
            for root in CAPTURE_ROOTS {
                collect_captures(client, root, &mut out);
            }
            Ok(())
        })?;
        out.sort_by(|a, b| b.modified.cmp(&a.modified));
        Ok(out)
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?
}

fn collect_captures(client: &mut FlipperClient, dir: &str, out: &mut Vec<MarauderCaptureFile>) {
    let entries = match storage::storage_list(client, dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries {
        let path = format!("{}/{}", dir.trim_end_matches('/'), entry.name);
        if entry.r#type == 1 {
            collect_captures(client, &path, out);
        } else if is_capture_file(&entry.name) {
            let modified = storage::storage_timestamp(client, &path).unwrap_or(0);
            out.push(MarauderCaptureFile {
                name: entry.name.clone(),
                path: path.clone(),
                size: entry.size as u64,
                modified,
            });
        }
    }
}

fn is_capture_file(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    CAPTURE_EXTENSIONS
        .iter()
        .any(|ext| lower.ends_with(ext))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn marauder_download_capture(
    remote_path: String,
    local_path: String,
    state: State<'_, AppState>,
) -> Result<()> {
    let client_mutex = Arc::clone(&state.client);
    let mode_mutex = Arc::clone(&state.mode);

    tauri::async_runtime::spawn_blocking(move || {
        with_client(&mode_mutex, &client_mutex, |client| {
            let bytes = storage::storage_read(client, &remote_path, |_, _| {}, &|| false)?;
            std::fs::write(&local_path, &bytes)?;
            Ok(())
        })
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?
}
