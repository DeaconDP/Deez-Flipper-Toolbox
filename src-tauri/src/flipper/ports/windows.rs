//! Windows-specific COM port discovery. `serialport::available_ports()` often
//! omits USB metadata (and sometimes entire ports) for Flipper Zero on Windows,
//! so we supplement it with registry lookups.

use std::collections::HashMap;

const FLIPPER_USB_VID: u16 = 0x0483;
const FLIPPER_USB_PID: u16 = 0x5740;
/// Flipper's Bluetooth company identifier in Windows BTHENUM instance IDs.
const FLIPPER_BT_PNP_TOKEN: &str = "VID&00010057";

#[derive(Debug, Clone)]
pub struct WindowsComPort {
    pub name: String,
    pub vid: u16,
    pub pid: u16,
    pub manufacturer: Option<String>,
}

#[derive(Debug, Clone)]
pub struct WindowsComIdentity {
    pub is_flipper_usb: bool,
    pub is_flipper_bt: bool,
}

/// Map COM port names (e.g. "COM3") to Flipper USB identity from the registry.
pub fn flipper_usb_com_ports() -> HashMap<String, WindowsComPort> {
    let mut out = HashMap::new();
    for entry in enumerate_usb_flipper_ports() {
        out.insert(entry.name.clone(), entry);
    }
    out
}

/// Resolve USB VID/PID for a COM port via the USB device enum tree.
pub fn com_port_usb_ids(port_name: &str) -> Option<(u16, u16)> {
    let target = port_name.to_ascii_uppercase();
    enumerate_usb_flipper_ports()
        .into_iter()
        .find(|p| p.name.eq_ignore_ascii_case(&target))
        .map(|p| (p.vid, p.pid))
}

/// Classify a COM port using the PnP instance ID behind it.
pub fn com_port_identity(port_name: &str) -> WindowsComIdentity {
    let pnp = com_port_pnp_id(port_name).unwrap_or_default();
    let upper = pnp.to_ascii_uppercase();
    WindowsComIdentity {
        is_flipper_usb: upper.contains("VID_0483&PID_5740"),
        is_flipper_bt: upper.contains(FLIPPER_BT_PNP_TOKEN),
    }
}

/// Read the PnP instance ID for a COM port by walking the USB/BTHENUM enum trees.
pub fn com_port_pnp_id(port_name: &str) -> Option<String> {
    let target = port_name.to_ascii_uppercase();
    for root in [
        r"SYSTEM\CurrentControlSet\Enum\USB",
        r"SYSTEM\CurrentControlSet\Enum\BTHENUM",
    ] {
        if let Some(id) = pnp_id_for_port_name(root, &target) {
            return Some(id);
        }
    }
    None
}

fn pnp_id_for_port_name(enum_root: &str, port_name: &str) -> Option<String> {
    let root_key = winreg::RegKey::predef(winreg::enums::HKEY_LOCAL_MACHINE)
        .open_subkey(enum_root)
        .ok()?;
    for class_id in root_key.enum_keys().flatten() {
        let Ok(class_key) = root_key.open_subkey(&class_id) else {
            continue;
        };
        for instance_id in class_key.enum_keys().flatten() {
            let Ok(dev_key) = class_key.open_subkey(&instance_id) else {
                continue;
            };
            let Ok(params) = dev_key.open_subkey("Device Parameters") else {
                continue;
            };
            let Ok(com): Result<String, _> = params.get_value("PortName") else {
                continue;
            };
            if com.eq_ignore_ascii_case(port_name) {
                return Some(format!("{enum_root}\\{class_id}\\{instance_id}"));
            }
        }
    }
    None
}

fn enumerate_usb_flipper_ports() -> Vec<WindowsComPort> {
    let mut ports = Vec::new();
    let usb_root = r"SYSTEM\CurrentControlSet\Enum\USB";
    let Ok(usb_key) = winreg::RegKey::predef(winreg::enums::HKEY_LOCAL_MACHINE).open_subkey(usb_root)
    else {
        return ports;
    };

    for vid_pid in usb_key.enum_keys().flatten() {
        if !vid_pid.starts_with("VID_0483&PID_5740") {
            continue;
        }
        let Ok(instance_key) = usb_key.open_subkey(&vid_pid) else {
            continue;
        };
        for instance_id in instance_key.enum_keys().flatten() {
            let Ok(dev_key) = instance_key.open_subkey(&instance_id) else {
                continue;
            };
            let Ok(params) = dev_key.open_subkey("Device Parameters") else {
                continue;
            };
            let Ok(com_name): Result<String, _> = params.get_value("PortName") else {
                continue;
            };

            ports.push(WindowsComPort {
                name: com_name,
                vid: FLIPPER_USB_VID,
                pid: FLIPPER_USB_PID,
                manufacturer: Some("STMicroelectronics".into()),
            });
        }
    }

    ports
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::*;

    #[test]
    fn com4_detects_flipper_bt_pnp() {
        if com_port_pnp_id("COM4").is_some() {
            let id = com_port_identity("COM4");
            assert!(id.is_flipper_bt, "COM4 should be Flipper Bluetooth SPP");
        }
    }
}
