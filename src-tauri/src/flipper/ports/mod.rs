#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(not(target_os = "windows"))]
pub mod windows {
    use std::collections::HashMap;

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

    pub fn flipper_usb_com_ports() -> HashMap<String, WindowsComPort> {
        HashMap::new()
    }

    pub fn com_port_usb_ids(_port_name: &str) -> Option<(u16, u16)> {
        None
    }

    pub fn com_port_identity(_port_name: &str) -> WindowsComIdentity {
        WindowsComIdentity {
            is_flipper_usb: false,
            is_flipper_bt: false,
        }
    }

    pub fn com_port_pnp_id(_port_name: &str) -> Option<String> {
        None
    }
}
