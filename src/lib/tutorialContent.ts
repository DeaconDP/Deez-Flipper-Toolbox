export type TutorialLink = { label: string; url: string };

export type TutorialTopic = {
  id: string;
  title: string;
  /** Always-visible one-line hook in everyday language. */
  tagline: string;
  /** Concrete use cases shown in the expandable examples list. */
  examples?: string[];
  /** Friendly empty-state copy for library views. */
  emptyHint?: string;
  flipper: string;
  inApp: string;
  tips?: string[];
  links: TutorialLink[];
  legal?: string;
};

export const CONNECTION_HINTS = {
  usb: "Files, libraries, screen mirror, terminal, and firmware flash.",
  ble: "Files, libraries, and screen mirror — terminal needs USB.",
  offline: "Firmware, editors, FBT, and cached libraries work offline.",
} as const;

const DOCS = "https://docs.flipper.net";
const QFLIPPER = "https://update.flipperzero.one/";
const FBT = "https://developer.flipper.net/fbt";
const OFFICIAL_FW = "https://github.com/flipperdevices/flipperzero-firmware";
const UNLEASHED = "https://github.com/DarkFlippers/unleashed-firmware";
const MOMENTUM = "https://github.com/Next-Flip/Momentum-firmware";
const MARAUDER = "https://github.com/justcallmekoko/ESP32Marauder";
const UFBT = "https://github.com/flipperdevices/flipperzero-ufbt";
const JS_APPS = "https://developer.flipper.net/flipperzero/doxygen/js_developing_apps";

export const TUTORIAL_TOPICS: TutorialTopic[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    tagline: "Your Flipper at a glance — battery, storage, and everything saved on the SD card.",
    examples: [
      "Check battery before a field session",
      "See how many remotes and cards you've saved",
      "Jump straight to any signal library",
    ],
    flipper:
      "Think of the Flipper as a pocket multi-tool: it talks to garage remotes, TV remotes, contactless cards, key fobs, and USB keyboards — plus an expansion port for add-ons. The device home screen shows battery and quick access to apps.",
    inApp:
      "The Dashboard gives you an at-a-glance overview: battery and temperature, SD and internal storage, library file counts, and shortcuts to Device Info and firmware flashing.",
    tips: [
      "Connect over USB for the fullest feature set; Bluetooth works for most libraries and screen mirroring.",
      "Library counts update after you scan each library section.",
    ],
    links: [
      { label: "Flipper Docs", url: DOCS },
      { label: "Getting started", url: `${DOCS}/basics` },
    ],
  },
  {
    id: "files",
    title: "File Explorer",
    tagline: "Browse, upload, and download everything on your Flipper's SD card and internal storage.",
    examples: [
      "Drag a signal file from your PC onto the Flipper",
      "Download a whole folder of captures as backup",
      "Rename or delete files without touching the device screen",
    ],
    flipper:
      "Your Flipper has built-in storage for settings and a microSD card for signals, apps, and media. Most of what you care about lives on the SD card under folders like subghz, infrared, and nfc.",
    inApp:
      "Browse, upload, download, rename, and delete files on the device. Drag files from your PC onto the window to upload, or drag files out to export. Recursive folder download is supported.",
    tips: [
      "Right-click any row for the full action menu even if inline icons are hidden in Settings.",
      "Signal files usually live in /ext/subghz, /ext/infrared, /ext/nfc, /ext/lfrfid, and /ext/badusb.",
    ],
    links: [
      { label: "File management", url: `${DOCS}/basics/file-management` },
      { label: "Flipper Docs", url: DOCS },
    ],
  },
  {
    id: "apps",
    title: "Apps Library",
    tagline: "Extra apps you install on the Flipper — games, tools, and community projects.",
    examples: [
      "Launch a GPIO app like the WiFi Marauder companion",
      "Browse community apps you've sideloaded to the SD card",
      "Download a copy of an app to your PC",
    ],
    emptyHint:
      "Apps you install on the Flipper show up here after you scan — try adding .fap files to /ext/apps on the SD card.",
    flipper:
      "Beyond built-in tools, you can install extra apps (packaged as .fap files) to the SD card. They appear under Apps on the device — from games and utilities to WiFi companions and custom tools.",
    inApp:
      "Scans /ext/apps (and any extra paths you configure in Settings) for .fap files. Launch apps remotely, download copies to your PC, rename, or delete. FAP icons are shown when available.",
    tips: [
      "Use Dev Studio to build and deploy your own FAP apps with uFBT.",
      "GPIO apps like WiFi Marauder companion install to /ext/apps/GPIO/.",
    ],
    links: [
      { label: "Apps overview", url: `${DOCS}/apps` },
      { label: "uFBT", url: UFBT },
    ],
  },
  {
    id: "subghz",
    title: "Sub-GHz",
    tagline: "Copy signals from garage doors, gate remotes, and wireless sensors.",
    examples: [
      "Test a car fob on a vehicle you own",
      "Replay a saved remote from the SD card",
      "Browse captures you recorded on the Flipper",
    ],
    emptyHint:
      "Garage remotes and wireless sensors show up here after you record them on the Flipper, then scan.",
    flipper:
      "Sub-GHz is the radio band used by many remotes, car keys, and wireless sensors (~300–928 MHz, depending on your region). Record a signal on the Flipper, save it, and replay it later — stored as .sub files on the SD card.",
    inApp:
      "Indexes .sub files from /ext/subghz into a searchable table with protocol, preset, and key metadata. Star favorites, filter by protocol, transmit signals from a row, and open map links for GPS coordinates.",
    tips: [
      "Transmission power and allowed frequencies vary by country — check your local regulations.",
      "Cached scans let you browse your library while disconnected.",
    ],
    legal:
      "Only transmit on frequencies and at power levels legal in your region, and only on devices or networks you own or have explicit permission to test.",
    links: [
      { label: "Sub-GHz docs", url: `${DOCS}/sub-ghz` },
      { label: "Reading raw signals", url: `${DOCS}/sub-ghz/read-raw` },
    ],
  },
  {
    id: "infrared",
    title: "Infrared",
    tagline: "Control TVs, AC units, and other IR remotes from saved profiles.",
    examples: [
      "Turn off a TV in a test lab",
      "Store your living-room remote layout",
      "Send a button press from the desktop",
    ],
    emptyHint:
      "TV and AC remotes you save on the Flipper appear here after you scan — record them on-device first.",
    flipper:
      "The IR blaster on top of the Flipper sends and receives infrared remote commands — the same kind TVs, AC units, and projectors use. Saved remotes are stored as .ir files with named buttons.",
    inApp:
      "Scans /ext/infrared for .ir files and lists each remote's buttons. Send the first signal in a file directly from a library row without opening the file on the device.",
    tips: [
      "Use the Signal Editors view to inspect or edit .ir files on your PC before pushing them back.",
    ],
    links: [
      { label: "Infrared docs", url: `${DOCS}/infrared` },
      { label: "IR universal remotes", url: `${DOCS}/infrared/universal-remotes` },
    ],
  },
  {
    id: "nfc",
    title: "NFC",
    tagline: "Read and emulate contactless cards and tags (13.56 MHz — tap-to-pay style).",
    examples: [
      "Inspect a transit or access card you own",
      "Save a tag dump to the SD card",
      "Emulate a saved tag at another reader",
    ],
    emptyHint:
      "Contactless cards and tags you save on the Flipper show up here after you scan.",
    flipper:
      "NFC handles tap-style contactless cards and tags — transit passes, hotel keys, Amiibo, and more at 13.56 MHz. Read, save, emulate, and write many formats. This is different from 125 kHz key fobs (see RFID).",
    inApp:
      "Scans /ext/nfc for saved tags. Emulate a saved tag from a library row — the Flipper presents itself as that card to external readers.",
    tips: [
      "Emulation requires an active USB or BLE connection to this app.",
      "Some cards use rolling keys or server validation and cannot be fully cloned.",
    ],
    links: [
      { label: "NFC docs", url: `${DOCS}/nfc` },
      { label: "NFC dictionary", url: `${DOCS}/nfc/nfc` },
    ],
  },
  {
    id: "rfid",
    title: "RFID (125 kHz)",
    tagline: "Read low-frequency key fobs and access cards (125 kHz — not the same as NFC).",
    examples: [
      "Copy a building fob you are authorized to duplicate",
      "Save LF card dumps to the SD card",
      "Emulate a saved fob at a door reader",
    ],
    emptyHint:
      "Key fobs and LF access cards you save on the Flipper appear here after you scan.",
    flipper:
      "125 kHz RFID covers many building key fobs and access cards — a different technology from NFC tap cards. The Flipper reads and emulates these as .rfid files. LF and NFC files are not interchangeable.",
    inApp:
      "Scans /ext/lfrfid for saved 125 kHz tags. Emulate a tag from a library row so the Flipper broadcasts that card's ID to a reader.",
    tips: [
      "LF RFID and NFC are different protocols — files are not interchangeable.",
    ],
    links: [
      { label: "125 kHz RFID", url: `${DOCS}/rfid` },
      { label: "Flipper Docs", url: DOCS },
    ],
  },
  {
    id: "badusb",
    title: "BadUSB",
    tagline: "Plug in as a keyboard and run scripted keystrokes on a connected PC.",
    examples: [
      "Automate repetitive typing on your own machine",
      "Run DuckyScript payloads you wrote",
      "Test USB keyboard workflows in a lab",
    ],
    emptyHint:
      "Keyboard automation scripts you save on the Flipper show up here after you scan.",
    flipper:
      "BadUSB makes the Flipper act as a USB keyboard when plugged into a computer. DuckyScript .txt files automate keystrokes — useful for IT automation and security testing on machines you control.",
    inApp:
      "Scans /ext/badusb for scripts. Edit DuckyScript in the built-in CodeMirror editor and run scripts on the connected host from a library row.",
    tips: [
      "BadUSB only works when the Flipper is physically plugged into the target PC's USB port.",
      "Test scripts on your own machines first.",
    ],
    legal:
      "Only run BadUSB scripts on computers you own or have written authorization to test. Unauthorized keyboard injection may violate computer misuse laws.",
    links: [
      { label: "BadUSB docs", url: `${DOCS}/bad-usb` },
      { label: "DuckyScript reference", url: `${DOCS}/bad-usb/bad-usb` },
    ],
  },
  {
    id: "backup",
    title: "Backup & Restore",
    tagline: "Save your Flipper settings and SD card before firmware changes or experiments.",
    examples: [
      "Back up before switching to custom firmware",
      "Mirror your entire SD card to the PC",
      "Restore internal settings after a reset",
    ],
    flipper:
      "Internal memory stores firmware settings, Bluetooth pairings, and layouts. The SD card holds your signals, apps, and media. Back up both before major firmware changes.",
    inApp:
      "Full backup captures internal settings via qFlipper-cli and mirrors the entire SD card over RPC. Restore selectively — internal only, SD only, or both — from saved backup folders.",
    tips: [
      "Install qFlipper-cli for internal memory backup (see Setup Wizard or qFlipper download).",
      "Backups are stored under Documents/Deez Flipper Tools/Backups by default.",
    ],
    links: [
      { label: "Download qFlipper", url: QFLIPPER },
      { label: "Flipper Docs", url: DOCS },
    ],
  },
  {
    id: "firmware",
    title: "Firmware & OS",
    tagline: "Update or replace the Flipper's operating system — official or community builds.",
    examples: [
      "Install the latest official firmware over USB",
      "Try community firmware with extra features",
      "Flash a .dfu file you built yourself",
    ],
    flipper:
      "Firmware is the Flipper's operating system. Official builds come from Flipper Devices; community firmware (Unleashed, Momentum) adds features and fewer regional limits. You only need this when you want to update or customize the OS.",
    inApp:
      "Flash official firmware over USB with live progress, browse community releases, or flash a local .dfu/.tgz you built yourself. SD .zip updates can be deployed to /ext/update/ without a full USB flash.",
    tips: [
      "Close the qFlipper GUI before USB flashing — only one app can use the device.",
      "Back up your data before switching firmware families.",
    ],
    links: [
      { label: "qFlipper", url: QFLIPPER },
      { label: "Official firmware", url: OFFICIAL_FW },
      { label: "Unleashed", url: UNLEASHED },
      { label: "Momentum", url: MOMENTUM },
    ],
  },
  {
    id: "fbt",
    title: "FBT Build Studio",
    tagline: "Build your own custom Flipper firmware when stock OS isn't enough.",
    examples: [
      "Enable extra apps in a community firmware fork",
      "Customize the splash screen and bundled apps",
      "Compile and flash a firmware you configured",
    ],
    flipper:
      "FBT (Flipper Build Tool) is how developers compile custom firmware — pick apps, tweak options, and produce flashable builds. You only need this if you want to modify the OS itself, not for everyday signal work.",
    inApp:
      "Clone official or community firmware repos, edit fbt_options_local.py, pick apps from scanned manifests, run FBT targets, and flash build outputs. Save and load build profiles for repeat builds.",
    tips: [
      "Requires Git and Python 3.8+ on your PC.",
      "First clone can take a while — FBT downloads toolchains automatically.",
    ],
    links: [
      { label: "FBT documentation", url: FBT },
      { label: "Official firmware repo", url: OFFICIAL_FW },
    ],
  },
  {
    id: "editors",
    title: "Signal Editors",
    tagline: "Edit saved remotes and card dumps on your PC before sending them back.",
    examples: [
      "Tweak a Sub-GHz signal's frequency or protocol fields",
      "Rename buttons on an IR remote file",
      "Fix a typo in an NFC dump without re-reading the card",
    ],
    flipper:
      "Saved signals are plain-text files (.sub, .ir, .nfc) on the SD card. Editing them on a PC is easier than tweaking raw data on the tiny screen.",
    inApp:
      "Open local or device files in raw text or structured form views. Edit Sub-GHz, infrared, and NFC files on your PC, then push them back to the Flipper.",
    tips: [
      "Always save a backup before editing raw signal data.",
      "Use the form view for common fields; switch to raw for advanced tweaks.",
    ],
    links: [
      { label: "Sub-GHz file format", url: `${DOCS}/sub-ghz/read-raw` },
      { label: "Infrared docs", url: `${DOCS}/infrared` },
      { label: "NFC docs", url: `${DOCS}/nfc` },
    ],
  },
  {
    id: "devstudio",
    title: "Dev Studio",
    tagline: "Build and install your own Flipper apps — no need to start from scratch on-device.",
    examples: [
      "Compile a community FAP app and deploy it to the SD card",
      "Scaffold a JavaScript app that runs on the Flipper",
      "Iterate on an app without copying files manually",
    ],
    flipper:
      "Developers extend the Flipper with installable apps — full C apps (FAPs) for hardware access, or JavaScript apps for quick prototypes that run directly on the device.",
    inApp:
      "Detects uFBT, Node, and other tools. Scaffold, build, and deploy FAP apps to /ext/apps, or create and deploy JS scripts to /ext/apps/Scripts/.",
    tips: [
      "Install uFBT with: pip install ufbt",
      "JS apps need Node.js on your PC for the build step.",
    ],
    links: [
      { label: "uFBT", url: UFBT },
      { label: "JS app development", url: JS_APPS },
      { label: "FBT docs", url: FBT },
    ],
  },
  {
    id: "wifiboard",
    title: "WiFi Board (Marauder)",
    tagline:
      "Flipper has no WiFi — an ESP32 module does the radio work; a companion app on the Flipper controls it.",
    examples: [
      "Field tab: launch companion + mirror screen while tethered",
      "Setup tab: flash Marauder and deploy companion FAP (one-time)",
      "Console tab: debug ESP32 over USB at your desk",
      "Captures tab: download PCAP/logs from Flipper SD",
    ],
    flipper:
      "The Flipper talks to the ESP32 over GPIO UART (pins PC0/PC1) via the WiFi Marauder companion app. The ESP runs Marauder firmware and performs scans, sniffing, and related WiFi tasks.",
    inApp:
      "Five tabs: Field (tethered operation), Setup (flash + deploy), Console (USB CLI), Captures (SD files), Guide (reference). The desktop app sets up hardware and can mirror or command the board when USB/passthrough is available — it does not power the board on; power comes from GPIO 3.3V or the dev board slot.",
    tips: [
      "There is no separate power button — wire 3.3V + GND or use the official dev board slot.",
      "Setup/Console need ESP USB to the PC. Field with GPIO ESP uses Launch + Screen Stream.",
      "Official dev board: qFlipper USB Channel 0 @ 115200 for passthrough console.",
      "Authorized testing only on networks you own or have permission to assess.",
    ],
    legal:
      "Marauder WiFi tools are for authorized security testing on networks you own or have permission to assess. Deauthentication and sniffing without consent may be illegal.",
    links: [
      { label: "ESP32 Marauder", url: MARAUDER },
      { label: "GPIO docs", url: `${DOCS}/gpio` },
      { label: "WiFi Marauder companion", url: "https://github.com/0xchocolate/flipperzero-wifi-marauder" },
    ],
  },
  {
    id: "wifiboard-field",
    title: "Field",
    tagline:
      "Day-to-day use with the board on the Flipper and this PC connected — launch, mirror, optional CLI, pull captures.",
    examples: [
      "Launch companion then Screen Stream to drive scans from your laptop",
      "Dev board + passthrough: send scanap from Field console",
      "GPIO ESP: readiness shows flipper_only — use mirror, not CLI",
    ],
    flipper: "Same as WiFi Board — companion app on device, ESP on UART.",
    inApp:
      "Readiness shows connection mode. Launch opens the companion FAP. Field console only works when ESP serial reaches the PC (USB or passthrough).",
    links: [
      { label: "Official dev board docs", url: `${DOCS}/gpio-and-modules/wifi-module` },
    ],
  },
  {
    id: "wifiboard-setup",
    title: "Setup",
    tagline:
      "One-time: flash Marauder onto the ESP32 (USB to PC), then copy the companion app to Flipper SD.",
    examples: [
      "New board: full flash + deploy companion → Field tab",
      "Update Marauder only: app-only flash",
      "Official dev board: remove from Flipper, flash with ESP32-S2 profile",
    ],
    flipper: "Flipper is only needed for deploying the companion FAP to SD.",
    inApp:
      "esptool flashes the ESP while it is on USB to your PC. Deploy uploads esp32_wifi_marauder.fap. Flipper COM ports are blocked during flash.",
    links: [{ label: "Marauder releases", url: `${MARAUDER}/releases` }],
  },
  {
    id: "wifiboard-console",
    title: "Console",
    tagline:
      "Direct Marauder CLI to the ESP32 over USB — for desk debugging, not when only GPIO-wired to Flipper.",
    examples: [
      "ESP on USB: connect COM port, type help or scanap",
      "Dev board passthrough port labeled in the list",
      "Use Field tab console when board stays in Flipper with passthrough",
    ],
    flipper: "Not used — this path is PC ↔ ESP USB only.",
    inApp: "115200 baud serial. Quick action groups mirror common CLI commands. Close before flashing in Setup.",
    links: [
      { label: "Marauder CLI wiki", url: `${MARAUDER}/wiki/CLI` },
    ],
  },
  {
    id: "wifiboard-captures",
    title: "Captures",
    tagline:
      "Files Marauder wrote to Flipper SD — PCAP, CSV, logs — downloaded to your PC for analysis.",
    examples: [
      "After a wardrive or sniff session on device",
      "Field tab polls for new files automatically",
      "Open .pcap in Wireshark after download",
    ],
    flipper: "Captures land on microSD under apps_data and related folders.",
    inApp:
      "Requires Flipper connected (not CLI mode). Scans common Marauder paths on /ext. Does not stream live packets — only saved files.",
    links: [{ label: "Wireshark", url: "https://www.wireshark.org/" }],
  },
  {
    id: "gpio",
    title: "GPIO",
    tagline: "Wire sensors, UART devices, and add-on boards to the 18-pin header.",
    examples: [
      "Attach a WiFi dev board for Marauder",
      "Read a 1-Wire temperature sensor",
      "Control pins from this app over USB",
    ],
    flipper:
      "The 18-pin GPIO header exposes power, ground, UART, I2C, 1-Wire, and eight software-controllable pins — for shields, WiFi boards, and custom hardware.",
    inApp:
      "Visual pinout with mode control (input/output), pull resistors, read/write, and OTG +5V switch. Eight RPC pins: PC0, PC1, PC3, PB2, PB3, PA4, PA6, PA7.",
    tips: [
      "OTG +5V can supply ~500 mA — check your shield's power needs.",
      "BLE connections poll slower (500 ms minimum) than USB.",
    ],
    links: [
      { label: "GPIO docs", url: `${DOCS}/gpio` },
      { label: "Dev boards", url: `${DOCS}/gpio/dev-board` },
    ],
  },
  {
    id: "screen",
    title: "Screen Mirror",
    tagline: "See and control the Flipper screen from your PC in real time.",
    examples: [
      "Navigate menus with your keyboard",
      "Save a screenshot of what's on the device",
      "Record a GIF of a demo or workflow",
    ],
    flipper:
      "The Flipper has a 128×64 monochrome LCD. Screen streaming mirrors the display in real time so you can operate the device from your PC.",
    inApp:
      "Live 128×64 mirror with keyboard and button input forwarding. Save screenshots, record GIFs, and enter fullscreen. Configure default save folders in Settings.",
    tips: [
      "Click the mirrored screen or use keyboard shortcuts to navigate menus.",
      "Works over both USB and BLE, though USB is more responsive.",
    ],
    links: [
      { label: "Flipper Docs", url: DOCS },
    ],
  },
  {
    id: "cli",
    title: "Terminal (Serial CLI)",
    tagline: "Type commands directly to the Flipper over USB — for power users and debugging.",
    examples: [
      "Run file and settings commands without the GUI",
      "Debug connection or firmware issues",
      "Reboot into DFU mode for bootloader flashing",
    ],
    flipper:
      "The Flipper firmware includes a text command interface over USB serial — file commands, settings, and debugging without using the on-screen menus.",
    inApp:
      "Opens a serial CLI session to the connected Flipper. Type commands and see output in a terminal panel. Only available over USB — not Bluetooth.",
    tips: [
      "Disconnect other apps (qFlipper GUI) that may hold the serial port.",
      "Use the Command Palette to reboot into DFU mode for bootloader flashing.",
    ],
    links: [
      { label: "CLI reference", url: `${DOCS}/development/cli` },
      { label: "Flipper Docs", url: DOCS },
    ],
  },
  {
    id: "info",
    title: "Device Info",
    tagline: "Firmware version, hardware details, battery health, and storage breakdown.",
    examples: [
      "Check which firmware branch you're running",
      "See battery voltage and temperature",
      "Find your device's unique hardware ID",
    ],
    flipper:
      "Firmware version, hardware revision, Bluetooth address, and storage details identify your unit and help troubleshoot compatibility with apps and custom firmware.",
    inApp:
      "Shows the full RPC device_info map: firmware name/version, hardware UID, battery stats, and storage paths. Open from the Dashboard, sidebar, or Command Palette.",
    tips: [
      "Hardware UID is used to cache library scans per device.",
    ],
    links: [
      { label: "Flipper Docs", url: DOCS },
      { label: "Hardware versions", url: `${DOCS}/basics` },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    tagline: "Customize this desktop app — connection, appearance, scans, and tool paths.",
    examples: [
      "Turn feature hints on or off",
      "Exclude slow folders from library scans",
      "Set where screenshots and GIFs are saved",
    ],
    flipper:
      "Flipper Zero behavior is mostly configured on-device, but this desktop app has its own preferences for connection, appearance, library scanning, and external tool paths.",
    inApp:
      "Configure language, theme accent, tray icon, auto-connect, file browser actions, notifications, screen capture folders, library exclusions, app scan paths, and developer tools.",
    tips: [
      "Turn on Tutorial mode from the corner button to see extra hints on each setting below.",
      "Library exclusions persist per signal type and speed up scans on large SD cards.",
    ],
    links: [
      { label: "Flipper Docs", url: DOCS },
    ],
  },
  {
    id: "disconnected",
    title: "Getting Started",
    tagline: "Connect your Flipper over USB or Bluetooth to manage files, signals, and apps.",
    examples: [
      "Plug in with USB for the full feature set",
      "Pair over Bluetooth for wireless file access",
      "Browse cached libraries while offline",
    ],
    flipper:
      "Plug your Flipper into USB or pair it over Bluetooth. Install qFlipper for firmware updates, or use this app as a full desktop manager.",
    inApp:
      "Connect using the toolbar above. Firmware, FBT Studio, Editors, and Dev Studio work offline. Cached libraries (Sub-GHz, IR, NFC, RFID, BadUSB) are browsable without a live connection.",
    tips: [
      "Run the Setup Wizard on first launch to check for required tools.",
      "Hover any sidebar item to see what it does.",
      "Enable Tutorial mode (corner button) for in-depth explanations on each screen.",
    ],
    links: [
      { label: "Download qFlipper", url: QFLIPPER },
      { label: "Flipper Docs", url: DOCS },
    ],
  },
];

const topicMap = new Map(TUTORIAL_TOPICS.map((t) => [t.id, t]));

export function getTutorialTopic(id: string): TutorialTopic | undefined {
  return topicMap.get(id);
}

export function getLibraryEmptyHint(topicId: string): string {
  return getTutorialTopic(topicId)?.emptyHint ?? "Nothing indexed yet — connect and scan.";
}

/** Built-in Flipper hardware capabilities for the Dashboard overview. */
export const BUILTIN_CAPABILITIES = [
  { topicId: "subghz", label: "Sub-GHz", view: "subghz" as const },
  { topicId: "infrared", label: "Infrared", view: "infrared" as const },
  { topicId: "nfc", label: "NFC", view: "nfc" as const },
  { topicId: "rfid", label: "LF RFID", view: "rfid" as const },
  { topicId: "badusb", label: "USB HID", view: "badusb" as const },
] as const;

export const SETTING_HINTS: Record<string, string> = {
  language:
    "Flipper itself uses the language set on-device. This setting will control the desktop app UI once internationalization is added.",
  "app-icon":
    "Cosmetic only — does not affect firmware or device behavior. macOS users can also hide the Dock icon when using the menubar tray.",
  "theme-accent":
    "Changes highlight colors across this app. The splash screen brand orange is intentionally fixed.",
  "tray-enabled":
    "Keeps Deez Flipper Tools reachable when the window is hidden. Right-click the tray icon for Show/Hide/Quit.",
  "tray-monochrome":
    "On macOS, template images follow light/dark menubar automatically.",
  "tray-hide-dock":
    "Menubar-only mode — make sure the tray icon stays enabled or you won't be able to reopen the window.",
  "auto-reconnect":
    "Useful if you frequently plug/unplug USB. Turn off if you run multiple Flipper tools and want manual control.",
  "sync-clock":
    "Handy for timestamped logs and signal filenames that reference date/time on the device.",
  "inline-actions":
    "Reduces clutter on the file list. Right-click always exposes the full menu regardless of these toggles.",
  "inline-rename": "Quick rename without opening the context menu.",
  "inline-download": "Save a copy to your PC with one click.",
  "inline-delete": "Permanently removes the file on the Flipper — use with care.",
  "notif-library":
    "OS notification permission is requested on first use. Handy for long scans of large SD cards.",
  "notif-disconnect":
    "Alerts you if the USB cable is bumped or BLE range is lost during a task.",
  "screenshot-dir":
    "A starting folder only — you can still pick another location in the save dialog each time.",
  "gif-dir": "Same as screenshot folder — pre-fills the GIF recorder save dialog.",
  "pre-scan-review":
    "Large directories (254+ files or 1 MiB+ files) slow scans. Excluding them keeps libraries fast.",
  "library-exclusions":
    "Per-library paths skipped during scan. Does not delete files — only hides them from the index.",
  "apps-extra-dirs":
    "Some FAPs install to /ext/apps_data or custom folders. Add those paths here to include them in the Apps library.",
  "esptool-path":
    "Leave empty to auto-detect via python -m esptool or uvx. Set manually if you have multiple Python installs.",
  "developer-diag":
    "Logs raw RPC frames for debugging connection issues. Enable only when troubleshooting.",
  "feature-hints":
    "Shows a short plain-language description at the top of each screen. Turn off if you already know your way around.",
};

export function getSettingHint(id: string): string | undefined {
  return SETTING_HINTS[id];
}
