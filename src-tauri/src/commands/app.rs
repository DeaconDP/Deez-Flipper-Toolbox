use std::sync::Arc;
use std::time::Duration;

use tauri::State;

use crate::error::{FlipperError, Result};
use crate::flipper::app;
use crate::state::{AppState, ConnectionMode};

const APP_SETTLE: Duration = Duration::from_millis(250);

/// Launch an app with a file path, wait for the scene to settle, then press
/// an in-app RPC button. Used for NFC/RFID emulate, IR send, BadUSB run.
fn app_session_start(
    client: &mut crate::flipper::client::FlipperClient,
    app_name: &str,
    path: &str,
    button_args: &str,
    button_index: i32,
) -> Result<()> {
    app::app_start(client, app_name, path)?;
    std::thread::sleep(APP_SETTLE);
    if let Err(e) = app::app_button_press_index(client, button_args, button_index) {
        let _ = app::app_button_release(client);
        let _ = app::app_exit(client);
        return Err(e);
    }
    Ok(())
}

fn app_session_stop(client: &mut crate::flipper::client::FlipperClient) -> Result<()> {
    let _ = app::app_button_release(client);
    app::app_exit(client)
}

/// Launch a Flipper application by name with optional CLI-style args.
/// App-level RPC errors (busy, locked, unknown app) surface as
/// `FlipperError::Rpc` without tearing down the connection — those failures
/// are recoverable from the user's side.
#[tauri::command]
pub async fn app_start(name: String, args: String, state: State<'_, AppState>) -> Result<()> {
    let client_mutex = Arc::clone(&state.client);
    let mode_mutex = Arc::clone(&state.mode);

    tauri::async_runtime::spawn_blocking(move || {
        {
            let mode = mode_mutex.lock().unwrap();
            if *mode == ConnectionMode::Cli {
                return Err(FlipperError::CliModeActive);
            }
        }
        let mut guard = client_mutex.lock().unwrap();
        let client = guard.as_mut().ok_or(FlipperError::NotConnected)?;
        app::app_start(client, &name, &args)
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?
}

/// Exit the currently running Flipper application.
#[tauri::command]
pub async fn app_exit(state: State<'_, AppState>) -> Result<()> {
    let client_mutex = Arc::clone(&state.client);
    let mode_mutex = Arc::clone(&state.mode);

    tauri::async_runtime::spawn_blocking(move || {
        {
            let mode = mode_mutex.lock().unwrap();
            if *mode == ConnectionMode::Cli {
                return Err(FlipperError::CliModeActive);
            }
        }
        let mut guard = client_mutex.lock().unwrap();
        let client = guard.as_mut().ok_or(FlipperError::NotConnected)?;
        app::app_exit(client)
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?
}

/// Begin Sub-GHz replay of a .sub file via RPC.
///
/// Stock firmware's subghz_app treats a non-empty `args` string as the .sub
/// path to preload — the app lands on the Transmitter scene with the key
/// loaded (but not yet transmitting). We then fire `AppButtonPressRequest`
/// to simulate an OK press, which kicks off the actual radio TX. The app
/// keeps transmitting until [`subghz_tx_stop`] releases the button and exits.
#[tauri::command]
pub async fn subghz_tx_start(path: String, state: State<'_, AppState>) -> Result<()> {
    let client_mutex = Arc::clone(&state.client);
    let mode_mutex = Arc::clone(&state.mode);

    tauri::async_runtime::spawn_blocking(move || {
        {
            let mode = mode_mutex.lock().unwrap();
            if *mode == ConnectionMode::Cli {
                return Err(FlipperError::CliModeActive);
            }
        }
        let mut guard = client_mutex.lock().unwrap();
        let client = guard.as_mut().ok_or(FlipperError::NotConnected)?;

        // Launch the Sub-GHz app with the .sub path as args — the app
        // preloads the key and jumps to the Transmitter scene, which is
        // where RPC button events are actually wired up in firmware.
        app::app_start(client, "Sub-GHz", &path)?;
        // Give the scene transition a beat to settle before pressing — the
        // app's RPC handler only registers after it reaches the scene.
        std::thread::sleep(std::time::Duration::from_millis(250));
        // Press OK to start transmission. Best-effort cleanup on failure.
        if let Err(e) = app::app_button_press(client, "") {
            let _ = app::app_button_release(client);
            let _ = app::app_exit(client);
            return Err(e);
        }
        Ok(())
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?
}

/// Stop an in-progress Sub-GHz replay and exit the app.
#[tauri::command]
pub async fn subghz_tx_stop(state: State<'_, AppState>) -> Result<()> {
    let client_mutex = Arc::clone(&state.client);
    let mode_mutex = Arc::clone(&state.mode);

    tauri::async_runtime::spawn_blocking(move || {
        {
            let mode = mode_mutex.lock().unwrap();
            if *mode == ConnectionMode::Cli {
                return Err(FlipperError::CliModeActive);
            }
        }
        let mut guard = client_mutex.lock().unwrap();
        let client = guard.as_mut().ok_or(FlipperError::NotConnected)?;

        app_session_stop(client)
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?
}

async fn run_app_session<F>(state: State<'_, AppState>, f: F) -> Result<()>
where
    F: FnOnce(&mut crate::flipper::client::FlipperClient) -> Result<()> + Send + 'static,
{
    let client_mutex = Arc::clone(&state.client);
    let mode_mutex = Arc::clone(&state.mode);

    tauri::async_runtime::spawn_blocking(move || {
        {
            let mode = mode_mutex.lock().unwrap();
            if *mode == ConnectionMode::Cli {
                return Err(FlipperError::CliModeActive);
            }
        }
        let mut guard = client_mutex.lock().unwrap();
        let client = guard.as_mut().ok_or(FlipperError::NotConnected)?;
        f(client)
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?
}

/// Begin NFC tag emulation for a saved `.nfc` file.
#[tauri::command]
pub async fn nfc_emulate_start(path: String, state: State<'_, AppState>) -> Result<()> {
    run_app_session(state, move |client| {
        app_session_start(client, "NFC", &path, "Emulate", 0)
    })
    .await
}

/// Stop NFC emulation and exit the NFC app.
#[tauri::command]
pub async fn nfc_emulate_stop(state: State<'_, AppState>) -> Result<()> {
    run_app_session(state, app_session_stop).await
}

/// Begin 125 kHz RFID key emulation for a saved `.rfid` file.
#[tauri::command]
pub async fn rfid_emulate_start(path: String, state: State<'_, AppState>) -> Result<()> {
    run_app_session(state, move |client| {
        app_session_start(client, "125 kHz RFID", &path, "Emulate", 0)
    })
    .await
}

/// Stop RFID emulation and exit the app.
#[tauri::command]
pub async fn rfid_emulate_stop(state: State<'_, AppState>) -> Result<()> {
    run_app_session(state, app_session_stop).await
}

/// Send the first signal from a saved `.ir` remote file.
#[tauri::command]
pub async fn infrared_tx_start(path: String, state: State<'_, AppState>) -> Result<()> {
    run_app_session(state, move |client| {
        app_session_start(client, "Infrared", &path, "", 0)
    })
    .await
}

/// Stop infrared transmission and exit the Infrared app.
#[tauri::command]
pub async fn infrared_tx_stop(state: State<'_, AppState>) -> Result<()> {
    run_app_session(state, app_session_stop).await
}

/// Run a BadUSB script on the USB-attached host.
#[tauri::command]
pub async fn badusb_run_start(path: String, state: State<'_, AppState>) -> Result<()> {
    run_app_session(state, move |client| {
        app_session_start(client, "Bad USB", &path, "Run", 0)
    })
    .await
}

/// Stop a running BadUSB script and exit the app.
#[tauri::command]
pub async fn badusb_run_stop(state: State<'_, AppState>) -> Result<()> {
    run_app_session(state, app_session_stop).await
}
