# Deez Flipper Toolbox

Desktop manager for Flipper Zero — forked from [FlipperUI](https://github.com/fuckmaz/FlipperUI) and extended with backup, firmware, FBT build studio, signal editors, and dev tools.

Created by [deac.online @ worldbuild.io](https://deac.online)

## Features

- **File manager & libraries** — Sub-GHz, IR, NFC, RFID, BadUSB, Apps (from FlipperUI)
- **Backup & restore** — Internal memory via qFlipper-cli + full SD card mirror
- **Firmware & OS** — Official/community updates, local `.tgz`/`.dfu` flash
- **FBT Build Studio** — Clone firmware, configure `fbt_options_local.py`, build & flash custom OS
- **Signal editors** — Sub-GHz, IR, NFC with raw + form views
- **Dev Studio** — uFBT FAP builds and JS app scaffolding
- **WiFi Board setup** — Flash ESP32 Marauder firmware (custom boards), deploy WiFi Marauder companion FAP, Field tab for launch/mirror/console/captures, GPIO wiring guide
- **Setup wizard** — Detects qFlipper-cli, Git, Python, Node, uFBT, esptool
- **Tutorial mode** — Corner toggle that explains every Flipper feature and app section with official learn-more links

## Development

```bash
npm install
npm run tauri dev
```

## Build installer

```bash
npm run tauri build
```

## Prerequisites

- [Rust](https://rustup.rs/) + MSVC (Windows)
- Node.js 20+
- [qFlipper](https://update.flipperzero.one/) (firmware flash & internal backup)
- Git + Python (FBT firmware builds)
- uFBT (`pip install ufbt`) for FAP app development
- esptool (`pip install esptool`, or [uv](https://github.com/astral-sh/uv) for `uvx --from esptool esptool`) for WiFi dev board flashing

## WiFi dev board (custom ESP32)

1. Open **WiFi Board** in the side rail.
2. Wire ESP **RX** ← Flipper **PC1 (TX)**, ESP **TX** → Flipper **PC0 (RX)**, plus **GND** and **3.3V**.
3. Connect the ESP32 to your PC over USB and pick its COM port (Flipper ports are excluded).
4. Choose a board profile (generic headless ESP32 → **LDDB**; detect chip if unsure).
5. Download a [Marauder release](https://github.com/justcallmekoko/ESP32Marauder/releases) and **Flash** (full flash for new boards).
6. With Flipper connected, **Deploy** the [WiFi Marauder companion FAP](https://github.com/0xchocolate/flipperzero-wifi-marauder) to `/ext/apps/GPIO/`.
7. On the Flipper: **Apps → GPIO → WiFi Marauder** with the ESP attached to the GPIO header — or use the **Field** tab to launch from the desktop and mirror the UI.

### Field use (Flipper tethered to PC)

1. Open **WiFi Board → Field**.
2. Verify readiness (Flipper connected, companion FAP on SD).
3. **Launch WiFi Marauder** — optionally opens Screen Stream automatically.
4. **GPIO ESP32:** control via mirrored Flipper UI; pull captures from SD as they appear.
5. **Official dev board:** enable qFlipper USB Channel 0 @ 115200 for tethered Marauder CLI in the Field console.

Marauder features are for authorized testing on networks you own or have permission to assess.

## License

[MIT](LICENSE) — see [FlipperUI](https://github.com/fuckmaz/FlipperUI) for upstream lineage.
