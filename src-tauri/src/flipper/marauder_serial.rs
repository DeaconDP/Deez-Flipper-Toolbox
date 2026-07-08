//! Direct serial session to an ESP32 running Marauder firmware (115200 baud).

use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use once_cell::sync::Lazy;
use serialport::SerialPort;
use tauri::{AppHandle, Emitter};

use crate::error::{FlipperError, Result};

const MARAUDER_BAUD: u32 = 115200;

static MARAUDER_CONSOLE_ACTIVE: AtomicBool = AtomicBool::new(false);

struct MarauderSession {
    port: Box<dyn SerialPort>,
    reader_active: Arc<AtomicBool>,
}

static SESSION: Lazy<Mutex<Option<MarauderSession>>> = Lazy::new(|| Mutex::new(None));
static CONNECTED_PORT: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

pub fn console_is_active() -> bool {
    MARAUDER_CONSOLE_ACTIVE.load(Ordering::Relaxed)
}

pub fn console_port() -> Option<String> {
    if !console_is_active() {
        return None;
    }
    CONNECTED_PORT.lock().unwrap().clone()
}

pub fn start_console(port_name: &str, app: AppHandle) -> Result<()> {
    if MARAUDER_CONSOLE_ACTIVE.swap(true, Ordering::SeqCst) {
        return Err(FlipperError::Internal(
            "Marauder console is already connected".into(),
        ));
    }

    let port = serialport::new(port_name, MARAUDER_BAUD)
        .timeout(Duration::from_millis(100))
        .open()
        .map_err(|e| {
            MARAUDER_CONSOLE_ACTIVE.store(false, Ordering::SeqCst);
            FlipperError::Internal(format!("Failed to open {port_name}: {e}"))
        })?;

    let reader_active = Arc::new(AtomicBool::new(true));
    let session = MarauderSession {
        port,
        reader_active: Arc::clone(&reader_active),
    };

    {
        let mut guard = SESSION.lock().unwrap();
        *guard = Some(session);
    }
    *CONNECTED_PORT.lock().unwrap() = Some(port_name.to_string());

    let active = reader_active;
    let port_name = port_name.to_string();
    thread::spawn(move || marauder_reader_loop(active, app, port_name));

    Ok(())
}

pub fn send_command(line: &str) -> Result<()> {
    let mut guard = SESSION.lock().unwrap();
    let session = guard
        .as_mut()
        .ok_or_else(|| FlipperError::Internal("Marauder console not connected".into()))?;
    let payload = format!("{line}\r\n");
    session
        .port
        .write_all(payload.as_bytes())
        .map_err(FlipperError::Io)?;
    session.port.flush().map_err(FlipperError::Io)?;
    Ok(())
}

pub fn stop_console() {
    MARAUDER_CONSOLE_ACTIVE.store(false, Ordering::SeqCst);
    *CONNECTED_PORT.lock().unwrap() = None;
    let mut guard = SESSION.lock().unwrap();
    if let Some(session) = guard.take() {
        session.reader_active.store(false, Ordering::SeqCst);
    }
}

fn marauder_reader_loop(active: Arc<AtomicBool>, app: AppHandle, port_name: String) {
    let mut buf = [0u8; 1024];

    while active.load(Ordering::Relaxed) {
        let n = {
            let mut guard = SESSION.lock().unwrap();
            match guard.as_mut() {
                Some(session) => match session.port.read(&mut buf) {
                    Ok(n) if n > 0 => Some(Ok(n)),
                    Ok(_) => None,
                    Err(e) if e.kind() == std::io::ErrorKind::TimedOut => None,
                    Err(e) => Some(Err(e)),
                },
                None => break,
            }
        };

        match n {
            Some(Ok(n)) => {
                let text = String::from_utf8_lossy(&buf[..n]).to_string();
                let _ = app.emit("marauder-output", &text);
            }
            Some(Err(_)) => {
                let _ = app.emit(
                    "marauder-output",
                    &format!("\r\n[serial error on {port_name} — disconnected]\r\n"),
                );
                break;
            }
            None => {}
        }

        thread::sleep(Duration::from_millis(10));
    }

    MARAUDER_CONSOLE_ACTIVE.store(false, Ordering::SeqCst);
    *CONNECTED_PORT.lock().unwrap() = None;
    let mut guard = SESSION.lock().unwrap();
    *guard = None;
}
