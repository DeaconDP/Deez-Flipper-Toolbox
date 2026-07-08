import type { ReactNode } from "react";
import { HelpCircle, Info } from "lucide-react";

type Variant = "info" | "tip" | "warn";

const VARIANT_CLASS: Record<Variant, string> = {
  info: "border-border-subtle bg-surface/40",
  tip: "border-accent/30 bg-accent/5",
  warn: "border-amber-500/30 bg-amber-500/5",
};

export function WifiBoardInfoPanel({
  title,
  children,
  variant = "info",
  className = "",
}: {
  title?: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  const Icon = variant === "warn" ? HelpCircle : Info;
  return (
    <div
      className={`rounded-md border p-3 text-xs text-muted leading-relaxed ${VARIANT_CLASS[variant]} ${className}`}
    >
      {(title || variant !== "info") && (
        <p className="font-medium text-secondary flex items-center gap-1.5 mb-1">
          <Icon size={14} className="shrink-0" />
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

export function WifiBoardTabIntro({
  title,
  summary,
  bullets,
}: {
  title: string;
  summary: string;
  bullets?: string[];
}) {
  return (
    <WifiBoardInfoPanel title={title} variant="tip" className="mb-1">
      <p>{summary}</p>
      {bullets && bullets.length > 0 && (
        <ul className="mt-2 space-y-1 list-disc list-inside text-dim">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
    </WifiBoardInfoPanel>
  );
}
