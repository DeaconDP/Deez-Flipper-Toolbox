import { useCallback, useEffect, useRef, useState } from "react";

import {
  marauderConsoleListPorts,
  marauderConsoleSend,
  marauderConsoleStart,
  marauderConsoleStop,
  marauderConsoleStatus,
  onMarauderOutput,
  type BoardProfile,
  type EspPortInfo,
  wifiBoardProfiles,
} from "../lib/wifiBoard";

export const COMPANION_FAP_PATH = "/ext/apps/GPIO/esp32_wifi_marauder.fap";

export interface MarauderQuickCommand {
  label: string;
  cmd: string;
  destructive?: boolean;
  requiresBt?: boolean;
}

export const MARAUDER_QUICK_GROUPS: { title: string; commands: MarauderQuickCommand[] }[] = [
  {
    title: "Info",
    commands: [
      { label: "help", cmd: "help" },
      { label: "info", cmd: "info" },
    ],
  },
  {
    title: "Scan",
    commands: [
      { label: "scanap", cmd: "scanap" },
      { label: "listap", cmd: "list -a" },
      { label: "stopscan", cmd: "stopscan" },
    ],
  },
  {
    title: "Sniff",
    commands: [
      { label: "sniffbeacon", cmd: "sniffbeacon" },
      { label: "sniffprobe", cmd: "sniffprobe" },
      { label: "sniffpwn", cmd: "sniffpwn" },
    ],
  },
  {
    title: "Monitor",
    commands: [
      { label: "channel scan", cmd: "channel -s" },
      { label: "stopscan", cmd: "stopscan" },
    ],
  },
  {
    title: "Destructive",
    commands: [
      { label: "attack menu", cmd: "attack", destructive: true },
      { label: "blespam", cmd: "blespam -t all", destructive: true, requiresBt: true },
    ],
  },
];

export function useMarauderConsole(options?: {
  preferredPort?: string | null;
  autoSelectPreferred?: boolean;
}) {
  const [ports, setPorts] = useState<EspPortInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [profiles, setProfiles] = useState<BoardProfile[]>([]);
  const logRef = useRef<HTMLPreElement>(null);

  const refreshPorts = useCallback(async () => {
    const list = await marauderConsoleListPorts();
    setPorts(list);
    if (options?.preferredPort && list.some((p) => p.name === options.preferredPort)) {
      setSelectedPort(options.preferredPort);
    } else if (list.length === 1) {
      setSelectedPort(list[0]!.name);
    }
  }, [options?.preferredPort]);

  useEffect(() => {
    void refreshPorts();
    void wifiBoardProfiles().then(setProfiles);
    void marauderConsoleStatus().then((s) => {
      setConnected(s.active);
      if (s.port) setSelectedPort(s.port);
    });
  }, [refreshPorts]);

  useEffect(() => {
    if (!options?.autoSelectPreferred || !options.preferredPort || connected) return;
    if (ports.some((p) => p.name === options.preferredPort)) {
      setSelectedPort(options.preferredPort);
    }
  }, [options?.autoSelectPreferred, options?.preferredPort, ports, connected]);

  useEffect(() => {
    const un = onMarauderOutput((text) => {
      setOutput((prev) => prev + text);
    });
    return () => {
      void un.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [output]);

  const connect = useCallback(async (portOverride?: string) => {
    const port = portOverride ?? selectedPort;
    if (!port) return;
    setBusy(true);
    setOutput("");
    try {
      await marauderConsoleStart(port);
      setConnected(true);
      setSelectedPort(port);
      setOutput(`[connected to ${port} @ 115200]\r\n`);
    } catch (e) {
      setOutput(String(e));
    } finally {
      setBusy(false);
    }
  }, [selectedPort]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      await marauderConsoleStop();
      setConnected(false);
      setOutput((p) => p + "\r\n[disconnected]\r\n");
    } finally {
      setBusy(false);
    }
  }, []);

  const sendLine = useCallback(async (line: string) => {
    if (!line.trim() || !connected) return;
    setHistory((h) => [...h.slice(-50), line]);
    setInput("");
    setOutput((p) => p + `> ${line}\r\n`);
    try {
      await marauderConsoleSend(line);
    } catch (e) {
      setOutput((p) => p + `[error] ${e}\r\n`);
    }
  }, [connected]);

  const sendWithConfirm = useCallback((cmd: string, destructive: boolean) => {
    if (destructive) {
      const ok = window.confirm(
        `Send "${cmd}"?\n\nOnly use on networks you own or have permission to test.`,
      );
      if (!ok) return;
    }
    void sendLine(cmd);
  }, [sendLine]);

  const profileHasBt = profiles.some((p) => p.has_bt);

  return {
    ports,
    selectedPort,
    setSelectedPort,
    connected,
    input,
    setInput,
    history,
    output,
    busy,
    profiles,
    profileHasBt,
    logRef,
    refreshPorts,
    connect,
    disconnect,
    sendLine,
    sendWithConfirm,
  };
}
