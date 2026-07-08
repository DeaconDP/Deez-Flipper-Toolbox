//! External tool detection and subprocess execution (qFlipper-cli, FBT, uFBT, etc.).

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::{FlipperError, Result};

static PROCESS_RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize)]
pub struct ToolStatus {
    pub name: String,
    pub found: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolDetectionResult {
    pub qflipper_cli: ToolStatus,
    pub git: ToolStatus,
    pub python: ToolStatus,
    pub node: ToolStatus,
    pub ufbt: ToolStatus,
    pub esptool: ToolStatus,
}

/// How to invoke esptool for WiFi board flashing.
#[derive(Debug, Clone)]
pub struct EsptoolInvocation {
    pub program: String,
    pub prefix_args: Vec<String>,
}

pub fn detect_esptool(custom_path: Option<&str>) -> (ToolStatus, Option<EsptoolInvocation>) {
    if let Some(p) = custom_path.filter(|s| !s.is_empty()) {
        let path = PathBuf::from(p);
        if path.exists() {
            let status = ToolStatus {
                name: "esptool".into(),
                found: true,
                path: Some(p.to_string()),
                version: probe_version(&path),
            };
            return (status, Some(EsptoolInvocation {
                program: p.to_string(),
                prefix_args: vec![],
            }));
        }
    }

    if let Some(p) = detect_on_path("esptool") {
        let status = ToolStatus {
            name: "esptool".into(),
            found: true,
            path: Some(p.to_string_lossy().into_owned()),
            version: probe_version(&p),
        };
        return (status, Some(EsptoolInvocation {
            program: p.to_string_lossy().into_owned(),
            prefix_args: vec![],
        }));
    }

    if let Some(py) = detect_on_path("python").or_else(|| detect_on_path("python3")) {
        let out = Command::new(&py)
            .args(["-m", "esptool", "version"])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output();
        if let Ok(out) = out {
            if out.status.success() || !out.stdout.is_empty() || !out.stderr.is_empty() {
                let text = String::from_utf8_lossy(if out.stdout.is_empty() {
                    &out.stderr
                } else {
                    &out.stdout
                });
                let version = text.lines().next().map(|l| l.trim().to_string());
                let py_str = py.to_string_lossy().into_owned();
                return (
                    ToolStatus {
                        name: "esptool".into(),
                        found: true,
                        path: Some(format!("{py_str} -m esptool")),
                        version,
                    },
                    Some(EsptoolInvocation {
                        program: py_str,
                        prefix_args: vec!["-m".into(), "esptool".into()],
                    }),
                );
            }
        }
    }

    if detect_on_path("uvx").is_some() {
        return (
            ToolStatus {
                name: "esptool".into(),
                found: true,
                path: Some("uvx --from esptool esptool".into()),
                version: None,
            },
            Some(EsptoolInvocation {
                program: "uvx".into(),
                prefix_args: vec![
                    "--from".into(),
                    "esptool".into(),
                    "esptool".into(),
                ],
            }),
        );
    }

    (
        ToolStatus {
            name: "esptool".into(),
            found: false,
            path: None,
            version: None,
        },
        None,
    )
}

pub fn run_esptool(
    invocation: &EsptoolInvocation,
    args: &[String],
    app: &AppHandle,
) -> Result<i32> {
    let mut cmd = Command::new(&invocation.program);
    cmd.args(&invocation.prefix_args);
    cmd.args(args);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(FlipperError::Io)?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    if let Some(out) = stdout {
        let app_out = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(out);
            for line in reader.lines().filter_map(|l| l.ok()) {
                let _ = app_out.emit("tool-output", ToolOutputLine {
                    stream: "stdout".into(),
                    line,
                });
            }
        });
    }
    if let Some(err) = stderr {
        let app_err = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(err);
            for line in reader.lines().filter_map(|l| l.ok()) {
                let _ = app_err.emit("tool-output", ToolOutputLine {
                    stream: "stderr".into(),
                    line,
                });
            }
        });
    }

    let status = child.wait()?;
    let code = status.code().unwrap_or(-1);
    let _ = app.emit("tool-exit", code);
    Ok(code)
}

fn detect_on_path(name: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        let candidate = dir.join(name);
        if candidate.exists() {
            return Some(candidate);
        }
        #[cfg(target_os = "windows")]
        {
            let with_exe = dir.join(format!("{name}.exe"));
            if with_exe.exists() {
                return Some(with_exe);
            }
        }
    }
    None
}

fn detect_exe(name: &str, candidates: &[&str]) -> ToolStatus {
    for c in candidates {
        let p = PathBuf::from(c);
        if p.exists() {
            return ToolStatus {
                name: name.to_string(),
                found: true,
                path: Some(p.to_string_lossy().into_owned()),
                version: probe_version(&p),
            };
        }
    }
    if let Some(p) = detect_on_path(name) {
        return ToolStatus {
            name: name.to_string(),
            found: true,
            path: Some(p.to_string_lossy().into_owned()),
            version: probe_version(&p),
        };
    }
    ToolStatus {
        name: name.to_string(),
        found: false,
        path: None,
        version: None,
    }
}

fn probe_version(path: &Path) -> Option<String> {
    let out = Command::new(path)
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(if out.stdout.is_empty() {
        &out.stderr
    } else {
        &out.stdout
    });
    let line = text.lines().next()?.trim();
    if line.is_empty() {
        None
    } else {
        Some(line.to_string())
    }
}

pub fn default_qflipper_cli_paths() -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        vec![
            r"C:\Program Files\qFlipper\qFlipper-cli.exe".to_string(),
            r"C:\Program Files (x86)\qFlipper\qFlipper-cli.exe".to_string(),
        ]
    }
    #[cfg(target_os = "macos")]
    {
        vec!["/Applications/qFlipper.app/Contents/MacOS/qFlipper-cli".to_string()]
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        vec!["/usr/bin/qFlipper-cli".to_string(), "/usr/local/bin/qFlipper-cli".to_string()]
    }
}

fn detect_all() -> ToolDetectionResult {
    let qflipper = {
        let candidates = default_qflipper_cli_paths();
        let refs: Vec<&str> = candidates.iter().map(|s| s.as_str()).collect();
        detect_exe("qFlipper-cli", &refs)
    };
    let python = {
        let py = detect_exe("python", &[]);
        if py.found { py } else { detect_exe("python3", &[]) }
    };
    ToolDetectionResult {
        qflipper_cli: qflipper,
        git: detect_exe("git", &[]),
        python,
        node: detect_exe("node", &[]),
        ufbt: detect_exe("ufbt", &[]),
        esptool: detect_esptool(None).0,
    }
}

#[tauri::command]
pub async fn tools_detect() -> Result<ToolDetectionResult> {
    tauri::async_runtime::spawn_blocking(detect_all)
        .await
        .map_err(|e| FlipperError::Internal(e.to_string()))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn tools_run(
    program: String,
    args: Vec<String>,
    cwd: Option<String>,
    app: AppHandle,
) -> Result<i32> {
    if PROCESS_RUNNING.swap(true, Ordering::SeqCst) {
        return Err(FlipperError::Internal(
            "Another external tool is already running".into(),
        ));
    }

    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new(&program);
        cmd.args(&args);
        if let Some(dir) = cwd {
            cmd.current_dir(dir);
        }
        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(FlipperError::Io)?;
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        if let Some(out) = stdout {
            let app_out = app.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(out);
                for line in reader.lines().filter_map(|l| l.ok()) {
                    let _ = app_out.emit("tool-output", ToolOutputLine {
                        stream: "stdout".into(),
                        line,
                    });
                }
            });
        }
        if let Some(err) = stderr {
            let app_err = app.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(err);
                for line in reader.lines().filter_map(|l| l.ok()) {
                    let _ = app_err.emit("tool-output", ToolOutputLine {
                        stream: "stderr".into(),
                        line,
                    });
                }
            });
        }

        let status = child.wait()?;
        let code = status.code().unwrap_or(-1);
        let _ = app.emit("tool-exit", code);
        Ok(code)
    })
    .await
    .map_err(|e| FlipperError::Internal(e.to_string()))?;

    PROCESS_RUNNING.store(false, Ordering::SeqCst);
    result
}

#[derive(Serialize, Clone)]
struct ToolOutputLine {
    stream: String,
    line: String,
}

#[tauri::command(rename_all = "snake_case")]
pub fn tools_resolve_qflipper(custom_path: Option<String>) -> Option<String> {
    if let Some(p) = custom_path.filter(|s| !s.is_empty()) {
        let path = PathBuf::from(&p);
        if path.exists() {
            return Some(p);
        }
    }
    detect_exe("qFlipper-cli", &default_qflipper_cli_paths().iter().map(|s| s.as_str()).collect::<Vec<_>>()).path
}
