import {
  Loader2,
  Play,
  Square,
  Terminal,
  Zap,
} from "lucide-react";

import {
  MARAUDER_QUICK_GROUPS,
  useMarauderConsole,
} from "../../hooks/useMarauderConsole";
import { WifiBoardTabIntro } from "./WifiBoardInfoPanel";

export function MarauderConsoleView() {
  const console = useMarauderConsole();

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 gap-3">
      <WifiBoardTabIntro
        title="Desk console (ESP USB)"
        summary="Talks directly to the ESP32 over its USB serial port at 115200 baud — not through the Flipper GPIO header. Use this for debugging at your desk. If the board is only wired to the Flipper, use Field → Launch + Screen Stream instead."
        bullets={[
          "ESP must be plugged into the PC — Flipper COM ports are excluded",
          "Ports labeled passthrough appear when dev board + qFlipper Channel 0",
          "Close this connection before flashing in Setup",
        ]}
      />

      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="text-sm bg-surface border border-border-subtle rounded px-2 py-1.5 min-w-[10rem]"
          value={console.selectedPort ?? ""}
          onChange={(e) => console.setSelectedPort(e.target.value || null)}
          disabled={console.connected}
        >
          <option value="">Select COM port…</option>
          {console.ports.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
              {p.is_devboard_passthrough
                ? " (dev board passthrough)"
                : p.is_espressif
                  ? " (Espressif)"
                  : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="text-xs px-2 py-1.5 rounded border border-border-subtle hover:bg-elevated"
          onClick={() => void console.refreshPorts()}
          disabled={console.connected}
        >
          Refresh
        </button>
        {!console.connected ? (
          <button
            type="button"
            disabled={console.busy || !console.selectedPort}
            className="text-xs px-3 py-1.5 rounded bg-accent-dim hover:bg-accent-hover text-white disabled:opacity-50 flex items-center gap-1"
            onClick={() => void console.connect()}
          >
            {console.busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Connect
          </button>
        ) : (
          <button
            type="button"
            disabled={console.busy}
            className="text-xs px-3 py-1.5 rounded border border-red-500/50 text-red-400 hover:bg-red-500/10 flex items-center gap-1"
            onClick={() => void console.disconnect()}
          >
            <Square size={14} /> Disconnect
          </button>
        )}
        {console.connected && (
          <span className="text-xs text-green-500 flex items-center gap-1">
            <Zap size={12} /> Live
          </span>
        )}
      </div>

      {MARAUDER_QUICK_GROUPS.map((group) => (
        <div key={group.title} className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-dim">{group.title}</p>
          <div className="flex flex-wrap gap-1">
            {group.commands
              .filter((c) => !c.requiresBt || console.profileHasBt)
              .map((c) => (
                <button
                  key={c.cmd}
                  type="button"
                  disabled={!console.connected}
                  className={`text-[10px] px-2 py-1 rounded border disabled:opacity-40 ${
                    c.destructive
                      ? "border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                      : "border-border-subtle hover:bg-elevated"
                  }`}
                  onClick={() =>
                    void console.sendWithConfirm(c.cmd, Boolean(c.destructive))
                  }
                >
                  {c.label}
                </button>
              ))}
          </div>
        </div>
      ))}

      <pre
        ref={console.logRef}
        className="flex-1 min-h-[200px] text-xs bg-black/50 border border-border-subtle rounded-md p-3 overflow-auto whitespace-pre-wrap font-mono"
      >
        {console.output || "Connect to an ESP32 USB port to open the Marauder CLI…"}
      </pre>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void console.sendLine(console.input);
        }}
      >
        <Terminal size={16} className="text-dim shrink-0 mt-2" />
        <input
          className="flex-1 text-sm bg-surface border border-border-subtle rounded px-2 py-1.5 font-mono"
          value={console.input}
          onChange={(e) => console.setInput(e.target.value)}
          disabled={!console.connected}
          placeholder={console.connected ? "Enter Marauder command…" : "Connect first"}
          list="marauder-history"
        />
        <datalist id="marauder-history">
          {console.history.map((h) => (
            <option key={h} value={h} />
          ))}
        </datalist>
        <button
          type="submit"
          disabled={!console.connected || !console.input.trim()}
          className="text-xs px-3 py-1.5 rounded bg-accent-dim hover:bg-accent-hover text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
