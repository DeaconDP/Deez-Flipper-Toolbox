//! Tauri commands for the desktop Marauder serial console.

use serde::Serialize;
use tauri::AppHandle;

use crate::commands::device::{list_all_serial_ports, list_ports};
use crate::commands::wifi_board;
use crate::error::{FlipperError, Result};
use crate::flipper::marauder_serial;

#[derive(Debug, Clone, Serialize)]
pub struct MarauderConsoleStatus {
    pub active: bool,
    pub port: Option<String>,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn marauder_console_start(port: String, app: AppHandle) -> Result<()> {
    if wifi_board::is_flash_running() {
        return Err(FlipperError::Internal(
            "Cannot open console while a flash is in progress".into(),
        ));
    }

    tauri::async_runtime::spawn_blocking(move || {
        let ports = list_ports()?;
        if ports.iter().any(|p| p.name == port && p.is_flipper && !p.is_devboard_passthrough) {
            return Err(FlipperError::Internal(
                "Cannot connect to a Flipper RPC port — select your ESP32 USB serial port or dev board passthrough".into(),
            ));
        }
        marauder_serial::start_console(&port, app)
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn marauder_console_send(line: String) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || marauder_serial::send_command(&line))
        .await
        .map_err(|e| FlipperError::Internal(e.to_string()))?
}

#[tauri::command]
pub async fn marauder_console_stop() -> Result<()> {
    tauri::async_runtime::spawn_blocking(|| {
        marauder_serial::stop_console();
        Ok(())
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?
}

#[tauri::command]
pub fn marauder_console_status() -> MarauderConsoleStatus {
    MarauderConsoleStatus {
        active: marauder_serial::console_is_active(),
        port: marauder_serial::console_port(),
    }
}

#[tauri::command]
pub fn marauder_console_list_ports() -> Result<Vec<crate::commands::device::PortInfo>> {
    let ports = list_all_serial_ports()?;
    Ok(ports
        .into_iter()
        .filter(|p| {
            (!p.is_flipper && !p.is_flipper_bt) || p.is_devboard_passthrough
        })
        .collect())
}
