import { useEffect, useState } from "react";
import { BookOpen, FolderArchive, MapPin, Radio, Settings2, Terminal } from "lucide-react";

import { MarauderCapturesView } from "./MarauderCapturesView";
import { MarauderConsoleView } from "./MarauderConsoleView";
import { WifiBoardFieldView } from "./WifiBoardFieldView";
import { WifiBoardGuideView } from "./WifiBoardGuideView";
import { WifiBoardSetupView } from "./WifiBoardSetupView";
import { FeatureContextBar } from "../ui/FeatureContextBar";
import { getTutorialTopic } from "../../lib/tutorialContent";
import { WIFI_TAB_SUMMARIES, type WifiTabId } from "../../lib/wifiBoardCopy";
import { wifiBoardFieldStatus } from "../../lib/wifiBoard";
import { useFlipperStore } from "../../store/useFlipperStore";

type WifiTab = WifiTabId;

const TABS: { id: WifiTab; label: string; Icon: typeof Radio }[] = [
  { id: "field", label: "Field", Icon: MapPin },
  { id: "setup", label: "Setup", Icon: Settings2 },
  { id: "console", label: "Console", Icon: Terminal },
  { id: "captures", label: "Captures", Icon: FolderArchive },
  { id: "guide", label: "Guide", Icon: BookOpen },
];

const TAB_TOPIC_IDS: Record<WifiTab, string> = {
  field: "wifiboard-field",
  setup: "wifiboard-setup",
  console: "wifiboard-console",
  captures: "wifiboard-captures",
  guide: "wifiboard",
};

export function WifiBoardView() {
  const [tab, setTab] = useState<WifiTab>("field");
  const isConnected = useFlipperStore((s) => s.isConnected);
  const tagline = getTutorialTopic("wifiboard")?.tagline;

  useEffect(() => {
    if (!isConnected) return;
    void wifiBoardFieldStatus()
      .then((s) => {
        if (s.companion_on_sd) setTab("field");
      })
      .catch(() => {});
  }, [isConnected]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border-subtle bg-panel px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Radio className="text-accent" size={22} />
          <div>
            <h1 className="text-lg font-semibold">WiFi Board</h1>
            {tagline && (
              <p className="text-sm text-muted">{tagline}</p>
            )}
          </div>
        </div>
        <nav className="flex gap-1 flex-wrap" aria-label="WiFi Board sections">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors ${
                tab === id
                  ? "bg-accent-dim text-white"
                  : "text-secondary hover:bg-surface border border-transparent hover:border-border-subtle"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>
        <p className="text-[11px] text-dim mt-2 leading-relaxed max-w-3xl">
          {WIFI_TAB_SUMMARIES[tab]}
        </p>
      </header>

      <FeatureContextBar topicId={TAB_TOPIC_IDS[tab]} className="shrink-0" />

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {tab === "field" && (
          <WifiBoardFieldView
            onGoToSetup={() => setTab("setup")}
            onGoToCaptures={() => setTab("captures")}
            onGoToConsole={() => setTab("console")}
          />
        )}
        {tab === "setup" && <WifiBoardSetupView onGoToField={() => setTab("field")} />}
        {tab === "console" && <MarauderConsoleView />}
        {tab === "captures" && <MarauderCapturesView />}
        {tab === "guide" && <WifiBoardGuideView onSelectTab={setTab} />}
      </div>
    </div>
  );
}
