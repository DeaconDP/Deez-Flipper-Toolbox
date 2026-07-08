import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Wrench } from "lucide-react";
import { toolsDetect, type ToolDetectionResult } from "../../lib/tools";
import { loadSettings, updateSettings } from "../../lib/settings";
import { useFlipperStore } from "../../store/useFlipperStore";
import { Spinner } from "../ui/Spinner";

export function SetupWizard() {
  const setActiveView = useFlipperStore((s) => s.setActiveView);
  const [tools, setTools] = useState<ToolDetectionResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void loadSettings().then((s) => {
      if (s.setup.completed) setDismissed(true);
    });
    void toolsDetect().then(setTools);
  }, []);

  const complete = async () => {
    await updateSettings({ setup: { completed: true } });
    setDismissed(true);
    setActiveView("dashboard");
  };

  if (dismissed) return null;

  if (!tools) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
        <div className="max-w-lg w-full rounded-lg bg-panel border border-border-subtle p-6 space-y-4 shadow-xl flex flex-col items-center">
          <Spinner />
          <p className="text-sm text-muted">Checking installed tools…</p>
        </div>
      </div>
    );
  }

  const missing = [
    !tools.qflipper_cli.found && "qFlipper-cli (firmware & internal backup)",
    !tools.git.found && "Git (FBT clone)",
    !tools.python.found && "Python 3.8+ (FBT)",
    !tools.node.found && "Node.js (JS apps)",
    !tools.esptool.found && "esptool (WiFi board flashing — optional)",
  ].filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="max-w-lg w-full rounded-lg bg-panel border border-border-subtle p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-2">
          <Wrench className="text-accent" size={20} />
          <h2 className="text-lg font-semibold">Welcome to Deez Flipper Tools</h2>
        </div>
        <p className="text-sm text-muted">
          Quick setup check. Install missing tools for full backup, firmware, and build features.
        </p>
        <ul className="space-y-2 text-sm">
          {Object.values(tools).map((t) => (
            <li key={t.name} className="flex items-center gap-2">
              {t.found ? (
                <CheckCircle2 size={16} className="text-green-500" />
              ) : (
                <span className="w-4 h-4 rounded-full border border-muted" />
              )}
              <span>{t.name}</span>
              {t.path && <span className="text-xs text-dim truncate">{t.path}</span>}
            </li>
          ))}
        </ul>
        {missing.length > 0 && (
          <div className="text-xs text-muted space-y-1">
            <p>Missing: {missing.join(", ")}</p>
            <a
              href="https://update.flipperzero.one/"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              Download qFlipper <ExternalLink size={12} />
            </a>
            {!tools.esptool.found && (
              <button
                type="button"
                className="block text-accent hover:underline"
                onClick={() => {
                  setDismissed(true);
                  setActiveView("wifiboard");
                }}
              >
                Set up WiFi dev board →
              </button>
            )}
          </div>
        )}
        <p className="text-xs text-dim">
          Hover any sidebar item to see what it does. Turn on{" "}
          <strong className="text-secondary font-medium">Tutorial</strong> from the corner button for in-depth guides.
        </p>
        <button
          type="button"
          onClick={() => void complete()}
          className="w-full py-2 rounded-md bg-accent text-black font-medium"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
