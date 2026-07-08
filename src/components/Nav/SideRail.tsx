import {
  FolderTree,
  HardDriveDownload,
  Hammer,
  Home,
  Info,
  Menu,
  Monitor,
  Pencil,
  Terminal,
  Cpu,
  Code2,
  Radio,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { useFlipperStore, type ActiveView } from "../../store/useFlipperStore";
import { getTutorialTopic } from "../../lib/tutorialContent";
import { FlipperSvgIcon } from "../ui/FlipperSvgIcon";
import subghzIconSvg from "../../assets/icons/sub1.svg?raw";
import infraredIconSvg from "../../assets/icons/infrared.svg?raw";
import nfcIconSvg from "../../assets/icons/nfc.svg?raw";
import rfidIconSvg from "../../assets/icons/125.svg?raw";
import pluginsIconSvg from "../../assets/icons/plugins.svg?raw";
import settingsIconSvg from "../../assets/icons/settings.svg?raw";
import badusbIconSvg from "../../assets/icons/badusb.svg?raw";
import gpioIconSvg from "../../assets/icons/gpio.svg?raw";

type RailIconProps = { size?: number; strokeWidth?: number };

const flipperIcon = (svg: string, name: string): ComponentType<RailIconProps> => {
  const Icon = ({ size }: RailIconProps) => <FlipperSvgIcon svg={svg} size={size} />;
  Icon.displayName = `FlipperIcon(${name})`;
  return Icon;
};

interface RailItem {
  view: ActiveView;
  label: string;
  topicId?: string;
  Icon: ComponentType<RailIconProps>;
  /** Disabled while no device is connected. */
  requiresConnection?: boolean;
  /**
   * If true, the item stays enabled while disconnected as long as its cached
   * library has at least one entry — the view is browsable offline.
   */
  browsableOffline?: "subghz" | "infrared" | "nfc" | "rfid" | "badusb";
  /** Additionally disabled while the active transport is BLE. */
  disabledOnBle?: boolean;
}

const TOP_ITEMS: RailItem[] = [
  { view: "dashboard", label: "Dashboard", topicId: "dashboard", Icon: Home },
  { view: "files", label: "File Explorer", topicId: "files", Icon: FolderTree, requiresConnection: true },
  { view: "apps", label: "Apps", topicId: "apps", Icon: flipperIcon(pluginsIconSvg, "plugins"), requiresConnection: true },
  { view: "subghz", label: "Sub-GHz", topicId: "subghz", Icon: flipperIcon(subghzIconSvg, "subghz"), requiresConnection: true, browsableOffline: "subghz" },
  { view: "infrared", label: "Infrared", topicId: "infrared", Icon: flipperIcon(infraredIconSvg, "infrared"), requiresConnection: true, browsableOffline: "infrared" },
  { view: "nfc", label: "NFC", topicId: "nfc", Icon: flipperIcon(nfcIconSvg, "nfc"), requiresConnection: true, browsableOffline: "nfc" },
  { view: "rfid", label: "RFID (125 kHz)", topicId: "rfid", Icon: flipperIcon(rfidIconSvg, "rfid"), requiresConnection: true, browsableOffline: "rfid" },
  { view: "badusb", label: "BadUSB", topicId: "badusb", Icon: flipperIcon(badusbIconSvg, "badusb"), requiresConnection: true, browsableOffline: "badusb" },
  { view: "backup", label: "Backup", topicId: "backup", Icon: HardDriveDownload, requiresConnection: true },
  { view: "firmware", label: "Firmware", topicId: "firmware", Icon: Cpu },
  { view: "fbt", label: "FBT Studio", topicId: "fbt", Icon: Hammer },
  { view: "editors", label: "Editors", topicId: "editors", Icon: Pencil },
  { view: "devstudio", label: "Dev Studio", topicId: "devstudio", Icon: Code2 },
  { view: "wifiboard", label: "WiFi Board", topicId: "wifiboard", Icon: Radio },
  { view: "gpio", label: "GPIO", topicId: "gpio", Icon: flipperIcon(gpioIconSvg, "gpio"), requiresConnection: true },
  { view: "info", label: "Device Info", topicId: "info", Icon: Info, requiresConnection: true },
  { view: "screen", label: "Screen mirror", topicId: "screen", Icon: Monitor, requiresConnection: true },
  { view: "cli", label: "Terminal", topicId: "cli", Icon: Terminal, requiresConnection: true, disabledOnBle: true },
];

const BOTTOM_ITEMS: RailItem[] = [
  { view: "settings", label: "Settings", topicId: "settings", Icon: flipperIcon(settingsIconSvg, "settings") },
];

function railTooltip(
  item: RailItem,
  disabled: boolean,
  isConnected: boolean,
  connectionKind: "serial" | "ble" | null,
): string {
  if (disabled) {
    if (item.disabledOnBle && connectionKind === "ble") {
      return "Terminal needs a USB cable";
    }
    if (item.requiresConnection && !isConnected) {
      return "Connect your Flipper to use this";
    }
  }
  const topic = item.topicId ? getTutorialTopic(item.topicId) : undefined;
  return topic?.tagline ?? item.label;
}

export function SideRail() {
  const activeView = useFlipperStore((s) => s.activeView);
  const setActiveView = useFlipperStore((s) => s.setActiveView);
  const isConnected = useFlipperStore((s) => s.isConnected);
  const connectionKind = useFlipperStore((s) => s.connectionKind);
  const subghzCount = useFlipperStore((s) => s.subghzEntries.length);
  const irCount = useFlipperStore((s) => s.irEntries.length);
  const nfcCount = useFlipperStore((s) => s.nfcEntries.length);
  const rfidCount = useFlipperStore((s) => s.rfidEntries.length);
  const badusbCount = useFlipperStore((s) => s.badusbEntries.length);
  const [expanded, setExpanded] = useState(false);

  const offlineLibraryHasEntries = (kind: NonNullable<RailItem["browsableOffline"]>): boolean => {
    if (kind === "subghz") return subghzCount > 0;
    if (kind === "infrared") return irCount > 0;
    if (kind === "nfc") return nfcCount > 0;
    if (kind === "rfid") return rfidCount > 0;
    return badusbCount > 0;
  };

  const itemDisabled = (item: RailItem): boolean => {
    if (item.requiresConnection && !isConnected) {
      if (item.browsableOffline && offlineLibraryHasEntries(item.browsableOffline)) {
        // Fall through to the BLE check; otherwise this item is enabled.
      } else {
        return true;
      }
    }
    if (item.disabledOnBle && connectionKind === "ble") return true;
    return false;
  };

  const renderItem = (item: RailItem) => {
    const disabled = itemDisabled(item);
    const tooltip = railTooltip(item, disabled, isConnected, connectionKind);
    return (
      <RailButton
        key={item.view}
        item={item}
        active={activeView === item.view}
        disabled={disabled}
        expanded={expanded}
        tooltip={tooltip}
        onClick={() => {
          if (!disabled) setActiveView(item.view);
        }}
      />
    );
  };

  return (
    <nav
      aria-label="Primary navigation"
      className={[
        "flex flex-col justify-between shrink-0 bg-panel border-r border-border-subtle py-2 transition-[width] duration-200 ease-out",
        expanded ? "w-48 items-stretch px-2" : "w-14 items-center",
      ].join(" ")}
    >
      <div className={expanded ? "flex flex-col gap-1" : "flex flex-col items-center gap-1"}>
        <RailToggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        {TOP_ITEMS.map(renderItem)}
      </div>
      <div className={expanded ? "flex flex-col gap-1" : "flex flex-col items-center gap-1"}>
        {BOTTOM_ITEMS.map(renderItem)}
      </div>
    </nav>
  );
}

function RailToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const label = expanded ? "Collapse menu" : "Expand menu";
  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-expanded={expanded}
      className={[
        "flex items-center rounded-md transition-colors text-muted hover:text-primary hover:bg-surface/40",
        expanded ? "justify-start gap-3 px-2 w-full h-10" : "justify-center w-10 h-10",
      ].join(" ")}
    >
      <Menu size={18} strokeWidth={1.75} />
      {expanded && <span className="text-sm"></span>}
    </button>
  );
}

function RailButton({
  item,
  active,
  disabled,
  expanded,
  tooltip,
  onClick,
}: {
  item: RailItem;
  active: boolean;
  disabled: boolean;
  expanded: boolean;
  tooltip: string;
  onClick: () => void;
}) {
  const { Icon, label } = item;

  const stateClasses = disabled
    ? "text-dim opacity-40 cursor-not-allowed"
    : active
    ? "text-accent bg-surface/60"
    : "text-muted hover:text-primary hover:bg-surface/40";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      aria-label={label}
      aria-current={active && !disabled ? "page" : undefined}
      className={[
        "relative flex items-center rounded-md transition-colors",
        expanded ? "justify-start gap-3 px-2 w-full h-10" : "justify-center w-10 h-10",
        stateClasses,
      ].join(" ")}
    >
      {active && !disabled && (
        <span
          aria-hidden
          className="absolute -left-2 top-2 bottom-2 w-[2px] rounded-r bg-accent"
        />
      )}
      <Icon size={18} strokeWidth={1.75} />
      {expanded && <span className="text-sm truncate">{label}</span>}
    </button>
  );
}
