import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useFeatureHints } from "../../hooks/useFeatureHints";
import { getTutorialTopic } from "../../lib/tutorialContent";

export function FeatureContextBar({
  topicId,
  className = "",
}: {
  topicId: string;
  className?: string;
}) {
  const { enabled } = useFeatureHints();
  const topic = getTutorialTopic(topicId);
  const [expanded, setExpanded] = useState(false);

  if (!enabled || !topic) return null;

  const hasExamples = topic.examples && topic.examples.length > 0;

  return (
    <div
      className={`border-b border-border-subtle/60 bg-surface/30 ${className}`}
    >
      <div className="flex items-start gap-2 px-3 py-1.5">
        <p className="text-[11px] text-muted leading-relaxed flex-1">
          {topic.tagline}
        </p>
        {hasExamples && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="shrink-0 flex items-center gap-0.5 text-[10px] text-dim hover:text-secondary transition-colors"
          >
            {expanded ? "Less" : "Examples"}
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        )}
      </div>
      {expanded && hasExamples && (
        <ul className="px-3 pb-2 text-[11px] text-dim space-y-0.5 list-disc list-inside">
          {topic.examples!.map((ex) => (
            <li key={ex}>{ex}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
