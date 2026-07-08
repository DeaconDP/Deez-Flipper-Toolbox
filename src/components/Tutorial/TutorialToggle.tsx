import { GraduationCap } from "lucide-react";
import { useTutorialMode } from "../../hooks/useTutorialMode";

export function TutorialToggle() {
  const { enabled, toggle } = useTutorialMode();

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={enabled}
      title={enabled ? "Turn off tutorial mode" : "Turn on tutorial mode"}
      className={`fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-full border shadow-lg transition-colors ${
        enabled
          ? "bg-accent/15 border-accent/50 text-accent"
          : "bg-panel border-border-subtle text-secondary hover:text-primary hover:border-accent/30"
      }`}
    >
      <GraduationCap size={16} />
      <span className="text-xs font-medium">{enabled ? "Tutorial on" : "Tutorial"}</span>
    </button>
  );
}
