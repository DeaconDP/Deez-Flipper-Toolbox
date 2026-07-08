import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, GraduationCap } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTutorialMode } from "../../hooks/useTutorialMode";
import { getTutorialTopic } from "../../lib/tutorialContent";

export function TutorialBanner({ topicId }: { topicId: string }) {
  const { enabled, collapsed, setCollapsed } = useTutorialMode();
  const topic = getTutorialTopic(topicId);

  if (!enabled || !topic) return null;

  const toggleCollapsed = () => {
    void setCollapsed(!collapsed);
  };

  return (
    <div className="bg-accent/5 border-b border-accent/20 shrink-0">
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-accent/10 transition-colors"
      >
        <GraduationCap size={14} className="text-accent shrink-0" />
        <span className="text-xs font-medium text-primary flex-1">{topic.title}</span>
        <span className="text-[10px] text-dim mr-1">{collapsed ? "Show" : "Hide"}</span>
        {collapsed ? (
          <ChevronDown size={14} className="text-muted shrink-0" />
        ) : (
          <ChevronUp size={14} className="text-muted shrink-0" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-3 text-xs text-muted">
          <p className="leading-relaxed">
            <span className="text-secondary font-medium">On Flipper: </span>
            {topic.flipper}
          </p>
          <p className="leading-relaxed mt-1">
            <span className="text-secondary font-medium">In this app: </span>
            {topic.inApp}
          </p>
          {topic.tips && topic.tips.length > 0 && (
            <ul className="mt-2 space-y-0.5 list-disc list-inside text-dim">
              {topic.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          )}
          {topic.legal && (
            <div className="flex items-start gap-2 mt-2 p-2 rounded bg-danger/5 border border-danger/20 text-danger/90">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{topic.legal}</span>
            </div>
          )}
          {topic.links.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {topic.links.map((link) => (
                <button
                  key={link.url}
                  type="button"
                  onClick={() => void openUrl(link.url)}
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  {link.label}
                  <ExternalLink size={10} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
