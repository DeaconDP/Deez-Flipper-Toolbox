//! Flipper signal file format parsers and serializers.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::error::{FlipperError, Result};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SubGhzFile {
    pub filetype: String,
    pub version: u32,
    pub frequency: u64,
    pub preset: String,
    pub custom_preset_module: Option<String>,
    pub custom_preset_data: Option<String>,
    pub protocol: String,
    pub fields: BTreeMap<String, String>,
    pub raw_data: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct IrFile {
    pub filetype: String,
    pub version: u32,
    pub protocol: String,
    pub buttons: Vec<IrButton>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrButton {
    pub name: String,
    pub protocol: String,
    pub address: String,
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NfcFile {
    pub filetype: String,
    pub version: u32,
    pub device_type: String,
    pub uid: String,
    pub fields: BTreeMap<String, String>,
    pub data_blocks: Vec<String>,
}

fn parse_key_value_lines(content: &str) -> (BTreeMap<String, String>, Vec<String>) {
    let mut fields = BTreeMap::new();
    let mut raw_data = Vec::new();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some((k, v)) = line.split_once(':') {
            let key = k.trim().to_string();
            let val = v.trim().to_string();
            if key == "RAW_Data" {
                raw_data.push(val);
            } else {
                fields.insert(key, val);
            }
        }
    }
    (fields, raw_data)
}

pub fn parse_subghz(content: &str) -> Result<SubGhzFile> {
    let (fields, raw_data) = parse_key_value_lines(content);
    let filetype = fields
        .get("Filetype")
        .cloned()
        .unwrap_or_else(|| "Flipper SubGhz Key File".into());
    let version = fields.get("Version").and_then(|v| v.parse().ok()).unwrap_or(1);
    let frequency = fields
        .get("Frequency")
        .and_then(|v| v.parse().ok())
        .unwrap_or(433920000);
    let preset = fields
        .get("Preset")
        .cloned()
        .unwrap_or_else(|| "FuriHalSubGhzPresetOok650Async".into());
    let protocol = fields.get("Protocol").cloned().unwrap_or_else(|| "RAW".into());

    let mut extra = fields.clone();
    for k in [
        "Filetype",
        "Version",
        "Frequency",
        "Preset",
        "Protocol",
        "Custom_preset_module",
        "Custom_preset_data",
    ] {
        extra.remove(k);
    }

    Ok(SubGhzFile {
        filetype,
        version,
        frequency,
        preset,
        custom_preset_module: fields.get("Custom_preset_module").cloned(),
        custom_preset_data: fields.get("Custom_preset_data").cloned(),
        protocol,
        fields: extra,
        raw_data,
    })
}

pub fn serialize_subghz(file: &SubGhzFile) -> String {
    let mut lines = vec![
        format!("Filetype: {}", file.filetype),
        format!("Version: {}", file.version),
        format!("Frequency: {}", file.frequency),
        format!("Preset: {}", file.preset),
    ];
    if let Some(m) = &file.custom_preset_module {
        lines.push(format!("Custom_preset_module: {m}"));
    }
    if let Some(d) = &file.custom_preset_data {
        lines.push(format!("Custom_preset_data: {d}"));
    }
    lines.push(format!("Protocol: {}", file.protocol));
    for (k, v) in &file.fields {
        if k != "RAW_Data" {
            lines.push(format!("{k}: {v}"));
        }
    }
    for raw in &file.raw_data {
        lines.push(format!("RAW_Data: {raw}"));
    }
    format!("{}\n", lines.join("\n"))
}

pub fn parse_ir(content: &str) -> Result<IrFile> {
    let mut file = IrFile::default();
    let mut current_name = String::new();
    let mut current_proto = String::new();
    let mut current_addr = String::new();
    let mut current_cmd = String::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some((k, v)) = line.split_once(':') {
            let key = k.trim();
            let val = v.trim();
            match key {
                "Filetype" => file.filetype = val.to_string(),
                "Version" => file.version = val.parse().unwrap_or(1),
                "name" => {
                    if !current_name.is_empty() {
                        file.buttons.push(IrButton {
                            name: current_name.clone(),
                            protocol: current_proto.clone(),
                            address: current_addr.clone(),
                            command: current_cmd.clone(),
                        });
                    }
                    current_name = val.to_string();
                    current_proto.clear();
                    current_addr.clear();
                    current_cmd.clear();
                }
                "type" => current_proto = val.to_string(),
                "protocol" => {
                    file.protocol = val.to_string();
                    current_proto = val.to_string();
                }
                "address" => current_addr = val.to_string(),
                "command" => current_cmd = val.to_string(),
                _ => {}
            }
        }
    }
    if !current_name.is_empty() {
        file.buttons.push(IrButton {
            name: current_name,
            protocol: current_proto,
            address: current_addr,
            command: current_cmd,
        });
    }
    if file.filetype.is_empty() {
        file.filetype = "IR signals file".into();
    }
    Ok(file)
}

pub fn serialize_ir(file: &IrFile) -> String {
    let mut lines = vec![
        format!("Filetype: {}", file.filetype),
        format!("Version: {}", file.version),
    ];
    if !file.protocol.is_empty() {
        lines.push(format!("# Protocol: {}", file.protocol));
    }
    for btn in &file.buttons {
        lines.push(format!("name: {}", btn.name));
        if !btn.protocol.is_empty() {
            lines.push(format!("type: {}", btn.protocol));
        }
        if !btn.address.is_empty() {
            lines.push(format!("address: {}", btn.address));
        }
        if !btn.command.is_empty() {
            lines.push(format!("command: {}", btn.command));
        }
        lines.push(String::new());
    }
    format!("{}\n", lines.join("\n"))
}

pub fn parse_nfc(content: &str) -> Result<NfcFile> {
    let (fields, _) = parse_key_value_lines(content);
    let filetype = fields
        .get("Filetype")
        .cloned()
        .unwrap_or_else(|| "Flipper NFC device".into());
    let version = fields.get("Version").and_then(|v| v.parse().ok()).unwrap_or(4);
    let device_type = fields
        .get("Device type")
        .cloned()
        .unwrap_or_else(|| "NTAG215".into());
    let uid = fields.get("UID").cloned().unwrap_or_default();

    let mut extra = fields.clone();
    for k in ["Filetype", "Version", "Device type", "UID"] {
        extra.remove(k);
    }

    Ok(NfcFile {
        filetype,
        version,
        device_type,
        uid,
        fields: extra,
        data_blocks: vec![],
    })
}

pub fn serialize_nfc(file: &NfcFile) -> String {
    let mut lines = vec![
        format!("Filetype: {}", file.filetype),
        format!("Version: {}", file.version),
        format!("Device type: {}", file.device_type),
        format!("UID: {}", file.uid),
    ];
    for (k, v) in &file.fields {
        lines.push(format!("{k}: {v}"));
    }
    format!("{}\n", lines.join("\n"))
}

#[tauri::command(rename_all = "snake_case")]
pub fn formats_parse_subghz(content: String) -> Result<SubGhzFile> {
    parse_subghz(&content)
}

#[tauri::command(rename_all = "snake_case")]
pub fn formats_serialize_subghz(file: SubGhzFile) -> Result<String> {
    Ok(serialize_subghz(&file))
}

#[tauri::command(rename_all = "snake_case")]
pub fn formats_parse_ir(content: String) -> Result<IrFile> {
    parse_ir(&content)
}

#[tauri::command(rename_all = "snake_case")]
pub fn formats_serialize_ir(file: IrFile) -> Result<String> {
    Ok(serialize_ir(&file))
}

#[tauri::command(rename_all = "snake_case")]
pub fn formats_parse_nfc(content: String) -> Result<NfcFile> {
    parse_nfc(&content)
}

#[tauri::command(rename_all = "snake_case")]
pub fn formats_serialize_nfc(file: NfcFile) -> Result<String> {
    Ok(serialize_nfc(&file))
}

#[tauri::command(rename_all = "snake_case")]
pub fn formats_read_local_file(path: String) -> Result<String> {
    std::fs::read_to_string(path).map_err(FlipperError::from)
}

#[tauri::command(rename_all = "snake_case")]
pub fn formats_write_local_file(path: String, content: String) -> Result<()> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, content).map_err(FlipperError::from)
}
