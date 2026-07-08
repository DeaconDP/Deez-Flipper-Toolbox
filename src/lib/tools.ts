import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface ToolStatus {
  name: string;
  found: boolean;
  path: string | null;
  version: string | null;
}

export interface ToolDetectionResult {
  qflipper_cli: ToolStatus;
  git: ToolStatus;
  python: ToolStatus;
  node: ToolStatus;
  ufbt: ToolStatus;
  esptool: ToolStatus;
}

export const toolsDetect = (): Promise<ToolDetectionResult> =>
  invoke("tools_detect");

export const toolsRun = (
  program: string,
  args: string[],
  cwd?: string,
): Promise<number> => invoke("tools_run", { program, args, cwd: cwd ?? null });

export const toolsResolveQflipper = (
  customPath?: string,
): Promise<string | null> =>
  invoke("tools_resolve_qflipper", { custom_path: customPath ?? null });

export const onToolOutput = (
  cb: (line: { stream: string; line: string }) => void,
) => listen<{ stream: string; line: string }>("tool-output", (e) => cb(e.payload));

export const onToolExit = (cb: (code: number) => void) =>
  listen<number>("tool-exit", (e) => cb(e.payload));

export const qflipperRun = (
  command: string,
  args: string[],
  qflipperPath?: string,
): Promise<string> =>
  invoke("qflipper_run", {
    command,
    args,
    qflipper_path: qflipperPath ?? null,
  });
